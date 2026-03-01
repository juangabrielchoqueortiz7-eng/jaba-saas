import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendWhatsAppList, sendWhatsAppTemplate } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Obtener saludo según hora de Bolivia (UTC-4)
function getBoliviaGreeting(): string {
    const now = new Date()
    const boliviaOffset = -4 * 60 // UTC-4
    const boliviaTime = new Date(now.getTime() + (now.getTimezoneOffset() + boliviaOffset) * 60000)
    const hour = boliviaTime.getHours()

    if (hour >= 6 && hour < 12) return 'Buenos días'
    if (hour >= 12 && hour < 19) return 'Buenas tardes'
    return 'Buenas noches'
}

// Buscar o crear chat
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
                last_message: 'Último aviso enviado',
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
// GET: Cron - Último aviso de urgencia (2 días después del remarketing)
// =============================================
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron Urgency] Starting urgency reminder job...')

    try {
        const result = await processUrgency()
        console.log(`[Cron Urgency] Done: ${result.sent} sent, ${result.failed} failed`)
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Cron Urgency] Fatal error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function processUrgency() {
    const results = { sent: 0, failed: 0, skipped: 0, total: 0 }

    // Buscar suscripciones que ya recibieron reminder + followup pero NO urgency
    const { data: subscriptions, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('estado', 'ACTIVO')
        .eq('notified', true)
        .eq('followup_sent', true)
        .eq('urgency_sent', false)

    if (error) {
        console.error('[Urgency] Error fetching:', error)
        return { ...results, error: error.message }
    }

    if (!subscriptions || subscriptions.length === 0) {
        console.log('[Urgency] No subscriptions need urgency message')
        return results
    }

    // Filter: followup must have been sent at least 48 hours ago AND not paused
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const candidates = subscriptions.filter(sub => {
        if (sub.auto_notify_paused) return false

        const phone = (sub.numero || '').replace(/\D/g, '')
        if (phone.length < 8) return false

        // Must have notified_at and it must be >= 48h ago
        if (!sub.notified_at) return false
        const notifiedAt = new Date(sub.notified_at)
        return notifiedAt <= twoDaysAgo
    })

    results.total = candidates.length
    results.skipped = subscriptions.length - candidates.length

    if (candidates.length === 0) {
        console.log('[Urgency] No candidates after 48h filter')
        return results
    }

    const greeting = getBoliviaGreeting()

    // Group by user
    const userGroups: Record<string, typeof candidates> = {}
    for (const sub of candidates) {
        if (!userGroups[sub.user_id]) userGroups[sub.user_id] = []
        userGroups[sub.user_id].push(sub)
    }

    for (const [userId, userSubs] of Object.entries(userGroups)) {
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

                // Mensaje de urgencia profesional y amigable con saludo dinámico
                const urgencyMessage = `⏰ *${greeting}*

Te escribimos por última vez porque tu acceso a Canva Pro de la cuenta *${sub.correo}* está a punto de ser suspendido.

Entendemos que a veces se nos pasan las cosas, por eso queremos darte esta última oportunidad de mantener tu cuenta activa con todos tus diseños intactos. 🎨

👉 Renueva en los próximos minutos seleccionando tu plan y tu acceso seguirá activo sin interrupciones.

De lo contrario, tu cuenta será suspendida y tus diseños quedarán inaccesibles temporalmente.

¡Estamos aquí para ayudarte! 💬

Ref: ${sub.equipo || ''}`

                // URL base para la imagen de precios
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const imageUrl = `${baseUrl}/prices_promo.jpg`

                // Enviar TEMPLATE de Meta (requerido para clientes fuera de ventana 24h)
                const sendResult = await sendWhatsAppTemplate(
                    fullPhone,
                    'ultimo_aviso_renovacion_v1',
                    'es',
                    [
                        {
                            type: 'header',
                            parameters: [
                                {
                                    type: 'image',
                                    image: { link: imageUrl }
                                }
                            ]
                        },
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: sub.correo || 'tu cuenta' },
                                { type: 'text', text: sub.equipo || 'S/N' }
                            ]
                        }
                    ],
                    creds.access_token,
                    creds.phone_number_id
                )

                if (sendResult) {
                    const waMessageId = sendResult?.messages?.[0]?.id || null
                    const chatId = await findOrCreateChat(fullPhone, userId, sub.correo || fullPhone)

                    // Guardar mensaje en chat
                    if (chatId) {
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: true,
                            content: urgencyMessage,
                            status: 'delivered',
                            whatsapp_message_id: waMessageId
                        })

                        await supabaseAdmin.from('chats').update({
                            last_message: '⏰ Último aviso de renovación enviado',
                            last_message_time: new Date().toISOString()
                        }).eq('id', chatId)
                    }

                    // Enviar lista interactiva de planes
                    if (listSections.length > 0 && listSections[0].rows.length > 0) {
                        await delay(1000)
                        await sendWhatsAppList(
                            fullPhone,
                            '👇 Selecciona tu plan para renovar ahora mismo y evitar la suspensión:',
                            'Renovar Ahora',
                            listSections,
                            creds.access_token,
                            creds.phone_number_id
                        )

                        if (chatId) {
                            await supabaseAdmin.from('messages').insert({
                                chat_id: chatId,
                                is_from_me: true,
                                content: '📋 Lista de Planes (Último Aviso) Enviada',
                                status: 'delivered'
                            })
                        }
                    }

                    // Marcar como enviado
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({ urgency_sent: true })
                        .eq('id', sub.id)

                    // Log
                    await supabaseAdmin.from('subscription_notification_logs').insert({
                        user_id: userId,
                        subscription_id: sub.id,
                        phone_number: fullPhone,
                        message_type: 'urgency',
                        status: 'sent'
                    })

                    results.sent++
                    console.log(`[Urgency] ✅ Sent to ${fullPhone} (${sub.correo})`)
                } else {
                    await supabaseAdmin.from('subscription_notification_logs').insert({
                        user_id: userId,
                        subscription_id: sub.id,
                        phone_number: fullPhone,
                        message_type: 'urgency',
                        status: 'failed',
                        error_message: 'sendWhatsAppTemplate returned null'
                    })
                    results.failed++
                    console.log(`[Urgency] ❌ Failed for ${fullPhone}`)
                }

                await delay(2000)
            } catch (err) {
                console.error(`[Urgency] Error for sub ${sub.id}:`, err)
                results.failed++
            }
        }
    }

    return results
}
