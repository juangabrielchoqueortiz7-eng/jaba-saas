import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendWhatsAppList } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Delay helper
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
async function findOrCreateChat(phoneNumber: string, userId: string, contactName?: string): Promise<string | null> {
    try {
        // Intentar con múltiples formatos de número
        const cleanNum = phoneNumber.replace(/\D/g, '')
        const withPrefix = cleanNum.startsWith('591') ? cleanNum : '591' + cleanNum
        const withoutPrefix = cleanNum.startsWith('591') ? cleanNum.slice(3) : cleanNum

        // Buscar chat existente con cualquier formato del número
        const { data: existingChat } = await supabaseAdmin
            .from('chats')
            .select('id')
            .eq('user_id', userId)
            .or(`phone_number.eq.${withPrefix},phone_number.eq.${withoutPrefix},phone_number.eq.+${withPrefix}`)
            .limit(1)
            .maybeSingle()

        if (existingChat) return existingChat.id

        // Crear nuevo chat con el formato completo (591...)
        const { data: newChat } = await supabaseAdmin
            .from('chats')
            .insert({
                phone_number: withPrefix,
                user_id: userId,
                contact_name: contactName || phoneNumber,
                last_message: 'Recordatorio enviado',
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
// GET: Llamado por Vercel Cron (9AM Bolivia)
// =============================================
export async function GET(request: Request) {
    // Verificar CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('[Cron Reminders] Unauthorized access attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron Reminders] Starting automated reminder job...')

    try {
        const result = await processReminders()
        console.log(`[Cron Reminders] Done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`)
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Cron Reminders] Fatal error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// =============================================
// POST: Llamado manualmente desde el Dashboard
// =============================================
export async function POST(request: Request) {
    // Verificar auth del usuario
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log(`[Manual Reminders] Triggered by user ${user.id}`)

    try {
        const result = await processReminders(user.id)
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Manual Reminders] Error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// =============================================
// Core Logic: Procesar y enviar recordatorios
// =============================================
async function processReminders(specificUserId?: string) {
    const today = new Date()
    const results = { sent: 0, failed: 0, skipped: 0, total: 0 }

    // 1. Obtener suscripciones candidatas
    let query = supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('estado', 'ACTIVO')
        .eq('notified', false)

    if (specificUserId) {
        query = query.eq('user_id', specificUserId)
    }

    const { data: subscriptions, error: subError } = await query

    if (subError) {
        console.error('[Reminders] Error fetching subscriptions:', subError)
        return { ...results, error: subError.message }
    }

    if (!subscriptions || subscriptions.length === 0) {
        console.log('[Reminders] No subscriptions to process')
        return results
    }

    // Filter by date: vencimiento <= 7 days from now AND not paused
    const candidates = subscriptions.filter(sub => {
        // Skip paused
        if (sub.auto_notify_paused) return false

        // Must have a phone number
        const phone = (sub.numero || '').replace(/\D/g, '')
        if (phone.length < 8) return false

        // Parse date
        const expDate = parseDate(sub.vencimiento)
        if (!expDate) return false

        // Check if expiring within 7 days or already expired
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays <= 7
    })

    results.total = candidates.length
    results.skipped = subscriptions.length - candidates.length

    if (candidates.length === 0) {
        console.log('[Reminders] No candidates after filtering')
        return results
    }

    // 2. Group by user_id for efficient processing
    const userGroups: Record<string, typeof candidates> = {}
    for (const sub of candidates) {
        if (!userGroups[sub.user_id]) userGroups[sub.user_id] = []
        userGroups[sub.user_id].push(sub)
    }

    // 3. Process each user group
    for (const [userId, userSubs] of Object.entries(userGroups)) {
        // Get WhatsApp credentials for this user
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id')
            .eq('user_id', userId)
            .single()

        if (!creds?.access_token || !creds?.phone_number_id) {
            console.log(`[Reminders] No WhatsApp credentials for user ${userId}, skipping ${userSubs.length} subs`)
            results.skipped += userSubs.length
            results.total -= userSubs.length
            continue
        }

        // Get custom messages
        const { data: settings } = await supabaseAdmin
            .from('subscription_settings')
            .select('*')
            .eq('user_id', userId)
            .single()

        // Get products/plans for this user
        const { data: products } = await supabaseAdmin
            .from('products')
            .select('id, name, description, price')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        // Build plans text
        const plansText = (products || []).map(p =>
            `• ${p.name} - ${p.price} Bs`
        ).join('\n')

        // Build WhatsApp list sections for interactive plan selection
        const listSections = products && products.length > 0 ? [{
            title: 'Planes Disponibles',
            rows: products.map(p => ({
                id: `renew_plan_${p.id}`,
                title: p.name.substring(0, 24),
                description: `Bs ${p.price}`
            }))
        }] : []

        // Default messages
        const defaultReminder = `⚠️ *Acción requerida: Tu acceso a Canva Pro necesita atención*

¡Hola! Notamos que tu suscripción venció el {vencimiento} de tu cuenta {correo}

Porque valoramos tu trabajo, hemos mantenido activo un acceso temporal para que no pierdas tu ritmo. ⏳ Sin embargo, este periodo de gracia es limitado.

📋 *Planes disponibles para renovar:*
{planes}

Por favor, renueva lo antes posible para evitar cortes definitivos y seguir disfrutando de todos los beneficios Pro. *¡Te esperamos!* ✨

Ref: {equipo}`

        const defaultExpiredGrace = `⚠️ *Acción requerida: Tu acceso a Canva Pro necesita atención*

¡Hola! Notamos que tu suscripción venció el {vencimiento} de tu cuenta {correo}

Porque valoramos tu trabajo, hemos mantenido activo un acceso temporal para que no pierdas tu ritmo. ⏳ Sin embargo, este periodo de gracia es limitado.

📋 *Planes disponibles para renovar:*
{planes}

Por favor, renueva lo antes posible para evitar cortes definitivos y seguir disfrutando de todos los beneficios Pro. *¡Te esperamos!* ✨

Ref: {equipo}`

        // Send to each subscription
        for (const sub of userSubs) {
            try {
                const phone = sub.numero.replace(/\D/g, '')
                const fullPhone = (phone.length === 8 && (phone.startsWith('6') || phone.startsWith('7')))
                    ? '591' + phone : phone

                // Choose message based on status
                const expDate = parseDate(sub.vencimiento)
                const diffDays = expDate ? Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0

                let messageTemplate: string
                if (diffDays < 0) {
                    // Already expired but ACTIVE (grace period)
                    messageTemplate = settings?.expired_grace_msg || defaultExpiredGrace
                } else {
                    // Expiring soon
                    messageTemplate = settings?.reminder_msg || defaultReminder
                }

                // Replace variables
                const message = messageTemplate
                    .replace(/{correo}/g, sub.correo || '')
                    .replace(/{vencimiento}/g, sub.vencimiento || '')
                    .replace(/{equipo}/g, sub.equipo || '')
                    .replace(/{planes}/g, plansText)

                // Send text message
                const sendResult = await sendWhatsAppMessage(fullPhone, message, creds.access_token, creds.phone_number_id)

                if (sendResult) {
                    // Extraer ID del mensaje de WhatsApp para tracking de status
                    const waMessageId = sendResult?.messages?.[0]?.id || null

                    // Buscar/crear chat para guardar mensajes en el panel
                    const chatId = await findOrCreateChat(fullPhone, userId, sub.correo || fullPhone)

                    // Guardar mensaje de texto en el panel de chat
                    if (chatId) {
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: true,
                            content: message,
                            status: 'delivered',
                            whatsapp_message_id: waMessageId
                        })

                        // Actualizar last_message del chat
                        await supabaseAdmin.from('chats').update({
                            last_message: '📤 Recordatorio de renovación enviado',
                            last_message_time: new Date().toISOString()
                        }).eq('id', chatId)
                    }

                    // Send interactive list with plans
                    if (listSections.length > 0 && listSections[0].rows.length > 0) {
                        await delay(1000)
                        await sendWhatsAppList(
                            fullPhone,
                            '👇 Selecciona el plan que deseas para renovar tu suscripción:',
                            'Ver Planes',
                            listSections,
                            creds.access_token,
                            creds.phone_number_id
                        )

                        // Guardar lista interactiva en el panel
                        if (chatId) {
                            await supabaseAdmin.from('messages').insert({
                                chat_id: chatId,
                                is_from_me: true,
                                content: '📋 Lista de Planes de Renovación Enviada',
                                status: 'delivered'
                            })
                        }
                    }

                    // Update subscription
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            notified: true,
                            notified_at: new Date().toISOString(),
                            followup_sent: false
                        })
                        .eq('id', sub.id)

                    // Log success
                    await supabaseAdmin.from('subscription_notification_logs').insert({
                        user_id: userId,
                        subscription_id: sub.id,
                        phone_number: fullPhone,
                        message_type: 'reminder',
                        status: 'sent'
                    })

                    results.sent++
                    console.log(`[Reminders] ✅ Sent to ${fullPhone} (${sub.correo})`)
                } else {
                    // Log failure
                    await supabaseAdmin.from('subscription_notification_logs').insert({
                        user_id: userId,
                        subscription_id: sub.id,
                        phone_number: fullPhone,
                        message_type: 'reminder',
                        status: 'failed',
                        error_message: 'sendWhatsAppMessage returned null'
                    })
                    results.failed++
                    console.log(`[Reminders] ❌ Failed for ${fullPhone}`)
                }

                // Rate limit delay
                await delay(2000)

            } catch (err) {
                console.error(`[Reminders] Error processing sub ${sub.id}:`, err)
                results.failed++

                await supabaseAdmin.from('subscription_notification_logs').insert({
                    user_id: userId,
                    subscription_id: sub.id,
                    phone_number: sub.numero,
                    message_type: 'reminder',
                    status: 'failed',
                    error_message: String(err)
                })
            }
        }
    }

    return results
}
