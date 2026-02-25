import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendWhatsAppList } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Buscar o crear chat para que los mensajes aparezcan en el panel
async function findOrCreateChat(phoneNumber: string, userId: string, contactName?: string): Promise<string | null> {
    try {
        const cleanNum = phoneNumber.replace(/\D/g, '')
        const withPrefix = cleanNum.startsWith('591') ? cleanNum : '591' + cleanNum
        const withoutPrefix = cleanNum.startsWith('591') ? cleanNum.slice(3) : cleanNum

        const { data: existingChat } = await supabaseAdmin
            .from('chats')
            .select('id')
            .eq('user_id', userId)
            .or(`phone_number.eq.${withPrefix},phone_number.eq.${withoutPrefix},phone_number.eq.+${withPrefix}`)
            .limit(1)
            .maybeSingle()

        if (existingChat) return existingChat.id

        const { data: newChat } = await supabaseAdmin
            .from('chats')
            .insert({
                phone_number: withPrefix,
                user_id: userId,
                contact_name: contactName || phoneNumber,
                last_message: 'Remarketing enviado',
                unread_count: 0
            })
            .select('id')
            .single()

        return newChat?.id || null
    } catch (err) {
        console.error('[Chat] Error finding/creating chat:', err)
        return null
    }
}

// =============================================
// GET: Cron 6PM Bolivia - Remarketing follow-up
// =============================================
export async function GET(request: Request) {
    // Verificar CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron Followup] Starting remarketing follow-up job...')

    try {
        const result = await processFollowups()
        console.log(`[Cron Followup] Done: ${result.sent} sent, ${result.failed} failed`)
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Cron Followup] Fatal error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function processFollowups() {
    const results = { sent: 0, failed: 0, skipped: 0, total: 0 }

    // Buscar suscripciones que fueron notificadas pero no renovaron ni recibieron followup
    const { data: subscriptions, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('estado', 'ACTIVO')
        .eq('notified', true)
        .eq('followup_sent', false)

    if (error) {
        console.error('[Followup] Error fetching:', error)
        return { ...results, error: error.message }
    }

    if (!subscriptions || subscriptions.length === 0) {
        console.log('[Followup] No subscriptions need followup')
        return results
    }

    // Filter: must have been notified at least 9 hours ago AND not paused
    const nineHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000)
    const candidates = subscriptions.filter(sub => {
        if (sub.auto_notify_paused) return false

        const phone = (sub.numero || '').replace(/\D/g, '')
        if (phone.length < 8) return false

        // Must have notified_at and it must be >= 9h ago
        if (!sub.notified_at) return false
        const notifiedAt = new Date(sub.notified_at)
        return notifiedAt <= nineHoursAgo
    })

    results.total = candidates.length
    results.skipped = subscriptions.length - candidates.length

    if (candidates.length === 0) {
        console.log('[Followup] No candidates after 9h filter')
        return results
    }

    // Group by user
    const userGroups: Record<string, typeof candidates> = {}
    for (const sub of candidates) {
        if (!userGroups[sub.user_id]) userGroups[sub.user_id] = []
        userGroups[sub.user_id].push(sub)
    }

    for (const [userId, userSubs] of Object.entries(userGroups)) {
        // Get WhatsApp credentials
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id')
            .eq('user_id', userId)
            .single()

        if (!creds?.access_token || !creds?.phone_number_id) {
            results.skipped += userSubs.length
            continue
        }

        // Get products for interactive list
        const { data: products } = await supabaseAdmin
            .from('products')
            .select('id, name, description, price')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        const listSections = products && products.length > 0 ? [{
            title: 'Planes Disponibles',
            rows: products.map(p => ({
                id: `renew_plan_${p.id}`,
                title: p.name.substring(0, 24),
                description: `Bs ${p.price}`
            }))
        }] : []

        for (const sub of userSubs) {
            try {
                const phone = sub.numero.replace(/\D/g, '')
                const fullPhone = (phone.length === 8 && (phone.startsWith('6') || phone.startsWith('7')))
                    ? '591' + phone : phone

                // Mensaje de remarketing profesional
                const followupMessage = `🔔 *Último aviso sobre tu cuenta Canva Pro*

Hola, te escribimos nuevamente porque notamos que tu suscripción de la cuenta *${sub.correo}* aún no ha sido renovada.

Queremos ser transparentes contigo: para mantener la calidad del servicio, necesitamos procesar las renovaciones pendientes. *Tu acceso será suspendido en las próximas horas si no se realiza la renovación.*

🎨 No pierdas tus proyectos, plantillas guardadas ni tu historial de diseños. Todo lo que has creado merece seguir disponible para ti.

Renueva ahora y sigue creando sin límites ✨

Ref: ${sub.equipo || ''}`

                const sendResult = await sendWhatsAppMessage(fullPhone, followupMessage, creds.access_token, creds.phone_number_id)

                if (sendResult) {
                    // Buscar/crear chat para guardar mensajes en el panel
                    const chatId = await findOrCreateChat(fullPhone, userId, sub.correo || fullPhone)

                    // Guardar mensaje en el panel de chat
                    if (chatId) {
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: true,
                            content: followupMessage,
                            status: 'delivered'
                        })

                        await supabaseAdmin.from('chats').update({
                            last_message: '⚠️ Remarketing de renovación enviado',
                            last_message_time: new Date().toISOString()
                        }).eq('id', chatId)
                    }

                    // Send interactive list
                    if (listSections.length > 0 && listSections[0].rows.length > 0) {
                        await delay(1000)
                        await sendWhatsAppList(
                            fullPhone,
                            '👇 Selecciona tu plan para renovar ahora mismo:',
                            'Renovar Ahora',
                            listSections,
                            creds.access_token,
                            creds.phone_number_id
                        )

                        if (chatId) {
                            await supabaseAdmin.from('messages').insert({
                                chat_id: chatId,
                                is_from_me: true,
                                content: '📋 Lista de Planes (Remarketing) Enviada',
                                status: 'delivered'
                            })
                        }
                    }

                    // Update
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({ followup_sent: true })
                        .eq('id', sub.id)

                    // Log
                    await supabaseAdmin.from('subscription_notification_logs').insert({
                        user_id: userId,
                        subscription_id: sub.id,
                        phone_number: fullPhone,
                        message_type: 'followup',
                        status: 'sent'
                    })

                    results.sent++
                    console.log(`[Followup] ✅ Remarketing sent to ${fullPhone}`)
                } else {
                    await supabaseAdmin.from('subscription_notification_logs').insert({
                        user_id: userId,
                        subscription_id: sub.id,
                        phone_number: fullPhone,
                        message_type: 'followup',
                        status: 'failed',
                        error_message: 'sendWhatsAppMessage returned null'
                    })
                    results.failed++
                }

                await delay(2000)
            } catch (err) {
                console.error(`[Followup] Error for sub ${sub.id}:`, err)
                results.failed++
            }
        }
    }

    return results
}
