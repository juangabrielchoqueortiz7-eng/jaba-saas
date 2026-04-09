// Nota: Este endpoint es específico para negocios de suscripción.
// Para automatizaciones generales (cualquier negocio) usar /api/run-automations

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendWhatsAppList, sendWhatsAppTemplate } from '@/lib/whatsapp'
import { getUsersToExecuteNow } from '@/lib/db/scheduling'

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

// Obtener saludo según hora del tenant
function getTenantGreeting(tz: string = 'America/La_Paz'): string {
    const tenantTime = new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
    const hour = tenantTime.getHours()

    if (hour >= 6 && hour < 12) return 'Buenos días'
    if (hour >= 12 && hour < 19) return 'Buenas tardes'
    return 'Buenas noches'
}

// Buscar o crear chat
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
// GET: Cron 13:00 UTC (9AM Bolivia, día siguiente)
// Último aviso de urgencia (~48 horas después del reminder)
// NOTA: Se ejecuta siempre a las 13:00 UTC, pero solo procesa usuarios
// cuya zona horaria local coincida con su hora configurada de urgency
// =============================================
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || !timingSafeCompare(authHeader ?? '', `Bearer ${cronSecret}`)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron Urgency] Starting urgency reminder job at', new Date().toISOString())

    try {
        // Obtener usuarios que deben ejecutar urgency AHORA según su zona horaria configurada
        const usersToExecute = await getUsersToExecuteNow('urgency')

        if (usersToExecute.length === 0) {
            console.log('[Cron Urgency] No users with urgency_hour matching current time in their timezone')
            return NextResponse.json({ sent: 0, failed: 0, skipped: 0, userCount: 0 })
        }

        console.log(`[Cron Urgency] Found ${usersToExecute.length} users to execute urgency for`)

        // Procesar urgency solo para los usuarios que coinciden
        const specificUserIds = usersToExecute.map(u => u.user_id)
        const result = await processUrgency(specificUserIds)
        console.log(`[Cron Urgency] Done: ${result.sent} sent, ${result.failed} failed`)
        return NextResponse.json({ ...result, usersProcessed: usersToExecute.length })
    } catch (error) {
        console.error('[Cron Urgency] Fatal error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function processUrgency(specificUserIds?: string[]) {
    const results = { sent: 0, failed: 0, skipped: 0, total: 0 }

    // Buscar suscripciones que ya recibieron reminder + followup pero NO urgency
    let query = supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('estado', 'ACTIVO')
        .eq('notified', true)
        .eq('followup_sent', true)
        .eq('urgency_sent', false)

    // Si se pasan user IDs específicos (desde cron con timezone), filtrar por esos
    if (specificUserIds && specificUserIds.length > 0) {
        query = query.in('user_id', specificUserIds)
    } else if (specificUserIds && specificUserIds.length === 0) {
        // Si se pasan user IDs pero la lista está vacía, no procesar nada
        return results
    }

    const { data: subscriptions, error } = await query

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
    const today = new Date()
    const candidates = subscriptions.filter(sub => {
        if (sub.auto_notify_paused) return false

        const phone = (sub.numero || '').replace(/\D/g, '')
        if (phone.length < 8) return false

        // CRITICAL: Verificar que la fecha de vencimiento es cercana (dentro de 7 días)
        // Si el admin actualizó manualmente a fecha lejana, NO enviar urgency
        const expDate = parseDate(sub.vencimiento)
        if (expDate) {
            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays > 7) {
                console.log(`[Urgency] ⏭️ Skip ${redactEmail(sub.correo)}: vence ${sub.vencimiento} (${diffDays} días) — fecha lejana`)
                return false
            }
        }

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

    // Group by user
    const userGroups: Record<string, typeof candidates> = {}
    for (const sub of candidates) {
        if (!userGroups[sub.user_id]) userGroups[sub.user_id] = []
        userGroups[sub.user_id].push(sub)
    }

    for (const [userId, userSubs] of Object.entries(userGroups)) {
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
            console.log(`[Urgency] Auto notifications disabled for user ${userId}, skipping`)
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

        const tenantCurrency = (creds as any)?.currency_symbol || 'Bs'
        const tenantCC = (creds as any)?.country_code || '591'
        const tenantTz = (creds as any)?.timezone || 'America/La_Paz'
        const greeting = getTenantGreeting(tenantTz)

        const listSections = products && products.length > 0 ? [{
            title: 'Planes Disponibles',
            rows: products.map(p => ({
                id: `renew_plan_${p.id}`,
                title: p.name.substring(0, 24),
                description: `${tenantCurrency} ${p.price}`
            }))
        }] : []

        for (const sub of userSubs) {
            try {
                const phone = sub.numero.replace(/\D/g, '')
                const fullPhone = !phone.startsWith(tenantCC) ? tenantCC + phone : phone

                const serviceName = (creds as any)?.service_name || (creds as any)?.bot_name || 'nuestro servicio'

                // Mensaje de urgencia profesional y amigable con saludo dinámico
                const urgencyMessage = `⏰ *${greeting}*

Te escribimos por última vez porque tu acceso a ${serviceName} de la cuenta *${sub.correo}* está a punto de ser suspendido.

Entendemos que a veces se nos pasan las cosas, por eso queremos darte esta última oportunidad de mantener tu cuenta activa con todo tu contenido intacto. 📂

👉 Renueva en los próximos minutos seleccionando tu plan y tu acceso seguirá activo sin interrupciones.

De lo contrario, tu cuenta será suspendida y tu contenido quedará inaccesible temporalmente.

¡Estamos aquí para ayudarte! 💬

Ref: ${sub.equipo || ''}`

                // URL de imagen de precios desde config del tenant
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const imageUrl = (creds as any)?.promo_image_url || `${baseUrl}/prices_promo.jpg`

                // Seleccionar template según servicio del suscriptor
                const templateConfig = (settings as any)?.template_config || {}
                const servicio = (sub.servicio || serviceName || 'Servicio') as string
                const templateName = templateConfig?.[servicio]?.urgency
                    || (Object.values(templateConfig || {}) as any[])?.[0]?.urgency
                    || 'ultimo_aviso_renovacion_v1'

                // Enviar TEMPLATE de Meta (requerido para clientes fuera de ventana 24h)
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
                    console.log(`[Urgency] ✅ Sent to ${redactPhone(fullPhone)} (${redactEmail(sub.correo)})`)
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
                    console.log(`[Urgency] ❌ Failed for ${redactPhone(fullPhone)}`)
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
