import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendWhatsAppList, sendWhatsAppTemplate } from '@/lib/whatsapp'

// Helpers para ocultar datos sensibles en logs
function redactPhone(phone: string) { return phone ? '***' + phone.slice(-4) : '***' }
function redactEmail(email: string) { if (!email) return '***'; const [u, d] = email.split('@'); return u.slice(0, 2) + '***@' + (d || '***') }
function timingSafeCompare(a: string, b: string): boolean {
    try { const bA = Buffer.from(a), bB = Buffer.from(b); if (bA.length !== bB.length) return false; const { timingSafeEqual } = require('crypto'); return timingSafeEqual(bA, bB) } catch { return false }
}

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Parse DD/MM/YYYY date strings
function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (parts) {
        return new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]))
    }
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
}

// Buscar o crear chat para que los mensajes aparezcan en el panel
async function findOrCreateChat(phoneNumber: string, userId: string, contactName?: string, countryCode: string = '591'): Promise<string | null> {
    try {
        const cleanNum = phoneNumber.replace(/\D/g, '')
        const withPrefix = cleanNum.startsWith(countryCode) ? cleanNum : countryCode + cleanNum
        const withoutPrefix = cleanNum.startsWith(countryCode) ? cleanNum.slice(countryCode.length) : cleanNum

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

    if (!cronSecret || !timingSafeCompare(authHeader ?? '', `Bearer ${cronSecret}`)) {
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
    const today = new Date()
    const candidates = subscriptions.filter(sub => {
        if (sub.auto_notify_paused) return false

        const phone = (sub.numero || '').replace(/\D/g, '')
        if (phone.length < 8) return false

        // CRITICAL: Verificar que la fecha de vencimiento es cercana (dentro de 7 días)
        // Si el admin actualizó manualmente a fecha lejana, NO enviar followup
        const expDate = parseDate(sub.vencimiento)
        if (expDate) {
            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays > 7) {
                console.log(`[Followup] ⏭️ Skip ${redactEmail(sub.correo)}: vence ${sub.vencimiento} (${diffDays} días) — fecha lejana`)
                return false
            }
        }

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
            .select('access_token, phone_number_id, bot_name, service_name, promo_image_url, timezone, currency_symbol, country_code')
            .eq('user_id', userId)
            .single()

        if (!creds?.access_token || !creds?.phone_number_id) {
            results.skipped += userSubs.length
            continue
        }

        const { data: settings } = await supabaseAdmin
            .from('subscription_settings')
            .select('enable_auto_notifications, template_config')
            .eq('user_id', userId)
            .single()

        if (settings && settings.enable_auto_notifications === false) {
            console.log(`[Followup] Auto notifications disabled for user ${userId}, skipping`)
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

        const tenantCC = (creds as any)?.country_code || '591'
        const listSections = products && products.length > 0 ? [{
            title: 'Planes Disponibles',
            rows: products.map(p => ({
                id: `renew_plan_${p.id}`,
                title: p.name.substring(0, 24),
                description: `${(creds as any)?.currency_symbol || 'Bs'} ${p.price}`
            }))
        }] : []

        for (const sub of userSubs) {
            try {
                const phone = sub.numero.replace(/\D/g, '')
                const fullPhone = !phone.startsWith(tenantCC) ? tenantCC + phone : phone

                const serviceName = (creds as any)?.service_name || (creds as any)?.bot_name || 'nuestro servicio'

                // Mensaje de remarketing profesional (genérico para cualquier negocio)
                const followupMessage = `🔔 *Último aviso sobre tu cuenta de ${serviceName}*

Hola, te escribimos nuevamente porque notamos que tu suscripción de la cuenta *${sub.correo}* aún no ha sido renovada.

Queremos ser transparentes contigo: para mantener la calidad del servicio, necesitamos procesar las renovaciones pendientes. *Tu acceso será suspendido en las próximas horas si no se realiza la renovación.*

📦 No pierdas tu contenido ni tu historial. Todo lo que has creado merece seguir disponible para ti.

Renueva ahora y sigue disfrutando de ${serviceName} sin límites ✨

Ref: ${sub.equipo || ''}`

                // URL de imagen de precios desde config del tenant
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const imageUrl = (creds as any)?.promo_image_url || `${baseUrl}/prices_promo.jpg`

                // Seleccionar template según servicio del suscriptor
                const templateConfig = (settings as any)?.template_config || {}
                const servicio = (sub.servicio || serviceName) as string
                const templateName = templateConfig?.[servicio]?.followup
                    || (Object.values(templateConfig || {}) as any[])?.[0]?.followup
                    || 'remarketing_suscripcion_v1'

                // Send TEMPLATE message (requerido para clientes fuera de ventana 24h)
                const sendResult = await sendWhatsAppTemplate(
                    fullPhone,
                    templateName,
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
                    // Extraer ID del mensaje de WhatsApp para tracking de status
                    const waMessageId = sendResult?.messages?.[0]?.id || null

                    // Buscar/crear chat para guardar mensajes en el panel
                    const chatId = await findOrCreateChat(fullPhone, userId, sub.correo || fullPhone)

                    // Guardar mensaje en el panel de chat
                    if (chatId) {
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: true,
                            content: followupMessage,
                            status: 'delivered',
                            whatsapp_message_id: waMessageId
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
                    console.log(`[Followup] ✅ Remarketing sent to ${redactPhone(fullPhone)}`)
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
