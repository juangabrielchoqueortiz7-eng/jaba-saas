import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ConditionEvaluator, { EvaluationContext } from '@/lib/trigger-conditions'
import { executeActions, ActionContext } from '@/lib/trigger-actions'
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

// delay ya no es necesario aquí — executeActions en trigger-actions.ts maneja los delays internamente

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
        .select('*, trigger_actions (*), trigger_condition_groups(id, operator, group_order, conditions:trigger_conditions(*))')
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
                    .select('is_from_me, created_at, content')
                    .eq('chat_id', chat.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (!lastMsg || lastMsg.is_from_me) continue
                const msgAge = Date.now() - new Date(lastMsg.created_at).getTime()
                if (msgAge > 24 * 60 * 60 * 1000) continue

                // Build evaluation context for this chat
                const { data: chatData } = await supabaseAdmin
                    .from('chats')
                    .select('*')
                    .eq('id', chat.id)
                    .single()

                const { count: messageCount } = await supabaseAdmin
                    .from('messages')
                    .select('*', { count: 'exact' })
                    .eq('chat_id', chat.id)

                const { data: subscription } = await supabaseAdmin
                    .from('subscriptions')
                    .select('*')
                    .eq('numero', chat.phone_number)
                    .eq('user_id', trigger.user_id)
                    .maybeSingle()

                const context: EvaluationContext = {
                    messageText: lastMsg?.content || '',
                    messageTimestamp: new Date(lastMsg?.created_at || Date.now()),
                    chatId: chat.id,
                    chatCreatedAt: chatData?.created_at ? new Date(chatData.created_at) : new Date(),
                    chatTags: chat.tags || [],
                    chatStatus: chatData?.status || 'lead',
                    chatLastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at) : undefined,
                    chatMessageCount: messageCount || 0,
                    chatCustomFields: chatData?.custom_fields || {},
                    subscriptionStatus: subscription?.estado || undefined,
                    subscriptionExpiresAt: subscription?.vencimiento ? new Date(subscription.vencimiento) : undefined,
                }

                // Check conditions using new evaluator
                let groups = trigger.trigger_condition_groups || []

                // Fallback for old condition structure
                if ((!groups || groups.length === 0) && trigger.trigger_conditions?.length > 0) {
                    groups = [{
                        id: 'migrated-group',
                        operator: 'AND',
                        group_order: 0,
                        conditions: trigger.trigger_conditions
                    }]
                }

                if (groups.length > 0) {
                    const evaluationResult = await ConditionEvaluator.evaluateAllConditionGroups(groups as any, context)
                    if (!evaluationResult.matched) continue
                }

                // Build ActionContext for this chat
                const actionCtx: ActionContext = {
                    chatId: chat.id,
                    phoneNumber: chat.phone_number,
                    tenantUserId: trigger.user_id,
                    contactName: chat.contact_name || '',
                    chatStatus: chatData?.status || 'lead',
                    chatTags: chat.tags || [],
                    chatCustomFields: chatData?.custom_fields || {},
                    tenantToken: creds.access_token,
                    tenantPhoneId: creds.phone_number_id,
                    tenantName: creds.bot_name,
                    subscriptionService: subscription?.servicio,
                    subscriptionEmail: subscription?.correo,
                    subscriptionExpiresAt: subscription?.vencimiento,
                    subscriptionStatus: subscription?.estado,
                    messageText: lastMsg?.content || '',
                    messageTimestamp: lastMsg?.created_at ? new Date(lastMsg.created_at) : new Date(),
                }

                // Execute actions
                try {
                    const { results: actionResults, failedCount } = await executeActions(
                        trigger.trigger_actions || [],
                        actionCtx,
                        { logResults: true }
                    )

                    // Log execution
                    try {
                        await supabaseAdmin.from('trigger_executions').insert({
                            trigger_id: trigger.id,
                            chat_id: chat.id,
                            status: failedCount === 0 ? 'success' : 'failed',
                            conditions_met: true,
                            conditions_evaluated: groups.length,
                            actions_executed: actionResults.filter(r => r.success).length,
                            actions_failed: failedCount,
                            action_details: actionResults.map(r => ({ type: r.actionType, success: r.success, error: r.error })),
                        })
                    } catch {
                        // Silently fail if table doesn't exist yet
                    }

                    results.executed++
                } catch (err) {
                    console.error(`[Time Trigger] Error executing actions for ${trigger.name}:`, err)
                    try {
                        await supabaseAdmin.from('trigger_executions').insert({
                            trigger_id: trigger.id,
                            chat_id: chat.id,
                            status: 'failed',
                            conditions_met: true,
                            errors: [String(err)]
                        })
                    } catch {
                        // Silently fail if table doesn't exist yet
                    }
                }
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
                .select('access_token, phone_number_id, bot_name, service_name')
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

                const actionCtx: ActionContext = {
                    chatId: chat?.id || '',
                    phoneNumber: sub.numero,
                    tenantUserId: trigger.user_id,
                    contactName,
                    chatStatus: 'customer',
                    chatTags: chat?.tags || [],
                    tenantToken: creds.access_token,
                    tenantPhoneId: creds.phone_number_id,
                    tenantName: (creds as any).bot_name,
                    tenantServiceName: (creds as any).service_name,
                    subscriptionService: sub.servicio,
                    subscriptionEmail: sub.correo,
                    subscriptionExpiresAt: sub.vencimiento,
                    subscriptionStatus: sub.estado,
                }

                try {
                    const { results: actionResults, failedCount } = await executeActions(
                        trigger.trigger_actions || [],
                        actionCtx,
                        { logResults: true }
                    )

                    // Log execution
                    try {
                        await supabaseAdmin.from('trigger_executions').insert({
                            trigger_id: trigger.id,
                            chat_id: chat?.id,
                            status: failedCount === 0 ? 'success' : 'failed',
                            conditions_met: true,
                            conditions_evaluated: 0,
                            actions_executed: actionResults.filter(r => r.success).length,
                            actions_failed: failedCount,
                            action_details: actionResults.map(r => ({ type: r.actionType, success: r.success, error: r.error })),
                        })
                    } catch {
                        // Silently fail if table doesn't exist yet
                    }

                    results.executed++
                } catch (err) {
                    console.error(`[Scheduled Trigger] Error executing actions for ${trigger.name}:`, err)
                    try {
                        await supabaseAdmin.from('trigger_executions').insert({
                            trigger_id: trigger.id,
                            chat_id: chat?.id,
                            status: 'failed',
                            conditions_met: true,
                            errors: [String(err)]
                        })
                    } catch {
                        // Silently fail if table doesn't exist yet
                    }
                }
            }
        } catch (err) {
            console.error(`[Trigger Engine] Scheduled trigger ${trigger.name} error:`, err)
            results.errors++
        }
    }

    return results
}

// executeAction ha sido reemplazado por executeActions de @/lib/trigger-actions
// que soporta 12+ tipos de acciones con patrón Factory
