import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/utils/supabase/server'
import { executeActions, ActionContext } from '@/lib/trigger-actions'
import dayjs from 'dayjs'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

// ─────────────────────────────────────────────────────────────
// POST /api/run-trigger
// Body: { triggerId }
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
    const supabase = await createUserClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { triggerId } = await request.json()
    if (!triggerId) return NextResponse.json({ error: 'Falta triggerId' }, { status: 400 })

    // Obtener trigger + acciones
    const { data: trigger, error: triggerError } = await supabaseAdmin
        .from('triggers')
        .select('*, trigger_actions (*)')
        .eq('id', triggerId)
        .eq('user_id', user.id)
        .single()

    if (triggerError || !trigger) {
        return NextResponse.json({ error: 'Disparador no encontrado' }, { status: 404 })
    }

    const { data: creds } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id, bot_name, service_name')
        .eq('user_id', user.id)
        .single()

    if (!creds?.access_token) {
        return NextResponse.json({ error: 'Configura tus credenciales de WhatsApp en Ajustes' }, { status: 400 })
    }

    const results = { executed: 0, skipped: 0, errors: 0, messages: [] as string[], action_results: [] as any[] }

    if (trigger.type === 'time') {
        const waitMinutes = parseInt(trigger.description || '30') || 30
        const cutoffTime = new Date(Date.now() - waitMinutes * 60 * 1000).toISOString()

        const { data: candidateChats } = await supabaseAdmin
            .from('chats')
            .select('id, phone_number, contact_name, tags, status, custom_fields')
            .eq('user_id', user.id)
            .lt('last_message_time', cutoffTime)

        for (const chat of (candidateChats || [])) {
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

            const { data: subscription } = await supabaseAdmin
                .from('subscriptions')
                .select('*')
                .eq('numero', chat.phone_number)
                .eq('user_id', user.id)
                .maybeSingle()

            const actionCtx: ActionContext = {
                chatId: chat.id,
                phoneNumber: chat.phone_number,
                tenantUserId: user.id,
                contactName: chat.contact_name || '',
                chatStatus: chat.status || 'lead',
                chatTags: chat.tags || [],
                chatCustomFields: chat.custom_fields || {},
                tenantToken: creds.access_token,
                tenantPhoneId: creds.phone_number_id,
                tenantName: creds.bot_name,
                tenantServiceName: creds.service_name,
                subscriptionService: subscription?.servicio,
                subscriptionEmail: subscription?.correo,
                subscriptionExpiresAt: subscription?.vencimiento,
                subscriptionStatus: subscription?.estado,
                messageText: lastMsg?.content || '',
            }

            const { results: actionResults } = await executeActions(
                trigger.trigger_actions || [],
                actionCtx,
                { logResults: true }
            )

            results.executed++
            results.messages.push(chat.phone_number)
            results.action_results.push({ phone: chat.phone_number, actions: actionResults })
        }

    } else if (trigger.type === 'scheduled') {
        let scheduleConfig: any = {}
        try { scheduleConfig = JSON.parse(trigger.description || '{}') } catch {}

        const { send_days, audience_type, audience_value } = scheduleConfig
        const today = dayjs().format('YYYY-MM-DD')

        let targetDate: string | null = null
        if (send_days === 'expiration') targetDate = today
        else if (send_days === '1_day_before') targetDate = dayjs().add(1, 'day').format('YYYY-MM-DD')
        else if (send_days === '3_days_before') targetDate = dayjs().add(3, 'day').format('YYYY-MM-DD')
        else if (send_days === '7_days_before') targetDate = dayjs().add(7, 'day').format('YYYY-MM-DD')

        let query = supabaseAdmin
            .from('subscriptions')
            .select('id, numero, correo, vencimiento, servicio, estado')
            .eq('user_id', user.id)
            .eq('estado', 'activo')

        if (audience_type === 'service' && audience_value) query = query.eq('servicio', audience_value)
        if (targetDate) query = query.eq('vencimiento', targetDate)

        const { data: subs } = await query

        if (!subs?.length) {
            results.skipped++
        } else {
            const phones = subs.map(s => s.numero)
            const { data: chats } = await supabaseAdmin
                .from('chats')
                .select('id, phone_number, contact_name, tags')
                .eq('user_id', user.id)
                .in('phone_number', phones)
            const chatByPhone = Object.fromEntries((chats || []).map(c => [c.phone_number, c]))

            const filteredSubs = audience_type === 'tag' && audience_value
                ? subs.filter(s => chatByPhone[s.numero]?.tags?.includes(audience_value))
                : subs

            for (const sub of filteredSubs) {
                const chat = chatByPhone[sub.numero]

                const actionCtx: ActionContext = {
                    chatId: chat?.id || '',
                    phoneNumber: sub.numero,
                    tenantUserId: user.id,
                    contactName: chat?.contact_name || '',
                    chatTags: chat?.tags || [],
                    tenantToken: creds.access_token,
                    tenantPhoneId: creds.phone_number_id,
                    tenantName: creds.bot_name,
                    tenantServiceName: creds.service_name,
                    subscriptionService: sub.servicio,
                    subscriptionEmail: sub.correo,
                    subscriptionExpiresAt: sub.vencimiento,
                    subscriptionStatus: sub.estado,
                }

                const { results: actionResults } = await executeActions(
                    trigger.trigger_actions || [],
                    actionCtx,
                    { logResults: true }
                )

                results.executed++
                results.messages.push(sub.numero)
                results.action_results.push({ phone: sub.numero, actions: actionResults })
            }
        }
    } else {
        return NextResponse.json({ error: `Tipo "${trigger.type}" no se puede ejecutar manualmente` }, { status: 400 })
    }

    // Actualizar last_run_at
    await supabaseAdmin
        .from('triggers')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', triggerId)

    return NextResponse.json(results)
}
