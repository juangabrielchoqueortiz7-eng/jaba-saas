import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/whatsapp'
import dayjs from 'dayjs'

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

// ============================================================
// TRIGGER ENGINE — Ejecuta triggers tipo "time" y "scheduled"
// Corre diariamente via cron de Vercel
// ============================================================
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || !timingSafeCompare(authHeader ?? '', `Bearer ${cronSecret}`)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Trigger Engine] Starting...')

    try {
        const [timeResult, scheduledResult] = await Promise.all([
            processTimeTriggers(),
            processScheduledTriggers(),
        ])
        const result = {
            time: timeResult,
            scheduled: scheduledResult,
        }
        console.log('[Trigger Engine] Done:', JSON.stringify(result))
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Trigger Engine] Fatal error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// ─────────────────────────────────────────────────────────────
// TIME TRIGGERS — Si cliente no responde en X minutos
// ─────────────────────────────────────────────────────────────
async function processTimeTriggers() {
    const results = { executed: 0, skipped: 0, errors: 0 }

    const { data: triggers, error } = await supabaseAdmin
        .from('triggers')
        .select('*, trigger_actions (*), trigger_conditions (*)')
        .eq('type', 'time')
        .eq('is_active', true)

    if (error || !triggers?.length) return results

    for (const trigger of triggers) {
        try {
            const waitMinutes = parseInt(trigger.description || '30') || 30
            const cutoffTime = new Date(Date.now() - waitMinutes * 60 * 1000).toISOString()

            const { data: creds } = await supabaseAdmin
                .from('whatsapp_credentials')
                .select('access_token, phone_number_id, bot_name')
                .eq('user_id', trigger.user_id)
                .single()

            if (!creds?.access_token) { results.skipped++; continue }

            const { data: candidateChats } = await supabaseAdmin
                .from('chats')
                .select('id, phone_number, contact_name, tags')
                .eq('user_id', trigger.user_id)
                .lt('last_message_time', cutoffTime)

            if (!candidateChats?.length) { results.skipped++; continue }

            for (const chat of candidateChats) {
                const { data: lastMsg } = await supabaseAdmin
                    .from('messages')
                    .select('is_from_me, created_at')
                    .eq('chat_id', chat.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (!lastMsg || lastMsg.is_from_me) continue
                const msgAge = Date.now() - new Date(lastMsg.created_at).getTime()
                if (msgAge > 24 * 60 * 60 * 1000) continue

                // Check conditions
                if (trigger.trigger_conditions?.length > 0) {
                    const met = trigger.trigger_conditions.every((cond: any) => {
                        if (cond.type === 'has_tag') {
                            const tags = chat.tags || []
                            return cond.operator === 'equals' ? tags.includes(cond.value) : !tags.includes(cond.value)
                        }
                        return true
                    })
                    if (!met) continue
                }

                // Execute actions
                for (const action of (trigger.trigger_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)) {
                    await executeAction(action, chat, creds)
                    await delay(1000)
                }
                results.executed++
            }
        } catch (err) {
            console.error(`[Trigger Engine] Time trigger ${trigger.name} error:`, err)
            results.errors++
        }
    }

    return results
}

// ─────────────────────────────────────────────────────────────
// SCHEDULED TRIGGERS — Envíos programados a suscripciones
// ─────────────────────────────────────────────────────────────
async function processScheduledTriggers() {
    const results = { executed: 0, skipped: 0, errors: 0 }
    const today = dayjs().format('YYYY-MM-DD')

    const { data: triggers, error } = await supabaseAdmin
        .from('triggers')
        .select('*, trigger_actions (*)')
        .eq('type', 'scheduled')
        .eq('is_active', true)

    if (error || !triggers?.length) return results

    for (const trigger of triggers) {
        try {
            let scheduleConfig: any = {}
            try { scheduleConfig = JSON.parse(trigger.description || '{}') } catch {}

            const { send_days, audience_type, audience_value } = scheduleConfig
            if (!send_days) { results.skipped++; continue }

            // Calcular qué fecha de vencimiento buscar
            let targetDate: string | null = null
            if (send_days === 'expiration') {
                targetDate = today
            } else if (send_days === '1_day_before') {
                targetDate = dayjs().add(1, 'day').format('YYYY-MM-DD')
            } else if (send_days === '3_days_before') {
                targetDate = dayjs().add(3, 'day').format('YYYY-MM-DD')
            } else if (send_days === '7_days_before') {
                targetDate = dayjs().add(7, 'day').format('YYYY-MM-DD')
            }
            // send_days === 'daily': targetDate remains null (no date filter)

            // Obtener credenciales WhatsApp del usuario
            const { data: creds } = await supabaseAdmin
                .from('whatsapp_credentials')
                .select('access_token, phone_number_id')
                .eq('user_id', trigger.user_id)
                .single()

            if (!creds?.access_token || !creds?.phone_number_id) {
                console.log(`[Trigger Engine] No credentials for user ${trigger.user_id}`)
                results.skipped++
                continue
            }

            // Construir query de suscripciones
            let query = supabaseAdmin
                .from('subscriptions')
                .select('id, numero, correo, vencimiento, servicio, estado, equipo')
                .eq('user_id', trigger.user_id)
                .eq('estado', 'activo')

            // Filtro de audiencia
            if (audience_type === 'service' && audience_value) {
                query = query.eq('servicio', audience_value)
            }

            // Filtro de fecha
            if (targetDate) {
                query = query.eq('vencimiento', targetDate)
            }

            const { data: subscriptions } = await query

            if (!subscriptions?.length) {
                results.skipped++
                continue
            }

            // Obtener nombre de contacto desde chats (si existe)
            const phones = subscriptions.map(s => s.numero)
            const { data: chats } = await supabaseAdmin
                .from('chats')
                .select('phone_number, contact_name, tags')
                .eq('user_id', trigger.user_id)
                .in('phone_number', phones)

            const chatByPhone = Object.fromEntries((chats || []).map(c => [c.phone_number, c]))

            // Filtro por tag de chat (si aplica)
            const filteredSubs = audience_type === 'tag' && audience_value
                ? subscriptions.filter(sub => {
                    const chat = chatByPhone[sub.numero]
                    return chat?.tags?.includes(audience_value)
                })
                : subscriptions

            // Ejecutar acciones para cada suscripción
            for (const sub of filteredSubs) {
                const chat = chatByPhone[sub.numero]
                const contactName = chat?.contact_name || ''
                const enrichedSub = { ...sub, contact_name: contactName }

                for (const action of (trigger.trigger_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)) {
                    await executeAction(action, {
                        phone_number: sub.numero,
                        contact_name: contactName,
                        tags: chat?.tags || [],
                        vencimiento: sub.vencimiento,
                        correo: sub.correo,
                        servicio: sub.servicio,
                    }, creds)
                    await delay(500)
                }
                results.executed++
            }
        } catch (err) {
            console.error(`[Trigger Engine] Scheduled trigger ${trigger.name} error:`, err)
            results.errors++
        }
    }

    return results
}

// ─────────────────────────────────────────────────────────────
// Ejecuta una acción individual
// ─────────────────────────────────────────────────────────────
async function executeAction(action: any, ctx: any, creds: any) {
    const { phone_number, contact_name, tags, vencimiento, correo, servicio } = ctx

    // Resolver variables de plantilla
    function resolveVars(text: string): string {
        return (text || '')
            .replace(/\{nombre\}/g, contact_name || '')
            .replace(/\{numero\}/g, phone_number || '')
            .replace(/\{telefono\}/g, phone_number || '')
            .replace(/\{vencimiento\}/g, vencimiento || '')
            .replace(/\{correo\}/g, correo || '')
            .replace(/\{servicio\}/g, servicio || '')
    }

    try {
        switch (action.type) {
            case 'send_message': {
                if (!action.payload?.message) break
                const msg = resolveVars(action.payload.message)
                await sendWhatsAppMessage(phone_number, msg, creds.access_token, creds.phone_number_id)
                // Save to messages if chat exists
                const { data: chat } = await supabaseAdmin
                    .from('chats')
                    .select('id')
                    .eq('phone_number', phone_number)
                    .maybeSingle()
                if (chat) {
                    await supabaseAdmin.from('messages').insert({
                        chat_id: chat.id,
                        is_from_me: true,
                        content: msg,
                        status: 'delivered'
                    })
                    await supabaseAdmin.from('chats').update({
                        last_message: msg.substring(0, 100),
                        last_message_time: new Date().toISOString()
                    }).eq('id', chat.id)
                }
                break
            }

            case 'send_meta_template': {
                const { templateName, language, variables } = action.payload || {}
                if (!templateName) break

                // Construir componentes de Meta con las variables resueltas
                const resolvedVars: string[] = (variables || []).map((v: string) => resolveVars(v))
                const components: any[] = []
                if (resolvedVars.length > 0) {
                    components.push({
                        type: 'body',
                        parameters: resolvedVars.map((v: string) => ({ type: 'text', text: v }))
                    })
                }

                await sendWhatsAppTemplate(
                    phone_number,
                    templateName,
                    language || 'es',
                    components,
                    creds.access_token,
                    creds.phone_number_id
                )
                console.log(`[Trigger Engine] Template "${templateName}" sent to ${redactPhone(phone_number)}`)
                break
            }

            case 'add_tag': {
                if (!action.payload?.tag) break
                const currentTags: string[] = tags || []
                if (!currentTags.includes(action.payload.tag)) {
                    const { data: chat } = await supabaseAdmin
                        .from('chats')
                        .select('id')
                        .eq('phone_number', phone_number)
                        .maybeSingle()
                    if (chat) {
                        await supabaseAdmin.from('chats').update({
                            tags: [...currentTags, action.payload.tag]
                        }).eq('id', chat.id)
                    }
                }
                break
            }

            case 'notify_admin':
                console.log(`[Trigger Engine] 🔔 ${action.payload?.title || ''}: ${action.payload?.message || ''} (${redactPhone(phone_number)})`)
                break

            case 'toggle_bot':
                // Reservado para implementación futura
                break
        }
    } catch (err) {
        console.error(`[Trigger Engine] executeAction(${action.type}) error:`, err)
    }
}
