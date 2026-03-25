import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/utils/supabase/server'
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/whatsapp'
import dayjs from 'dayjs'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function resolveVars(text: string, ctx: Record<string, string>): string {
    return (text || '')
        .replace(/\{nombre\}/g, ctx.contact_name || '')
        .replace(/\{numero\}/g, ctx.phone_number || '')
        .replace(/\{telefono\}/g, ctx.phone_number || '')
        .replace(/\{vencimiento\}/g, ctx.vencimiento || '')
        .replace(/\{correo\}/g, ctx.correo || '')
        .replace(/\{servicio\}/g, ctx.servicio || '')
}

async function executeAction(action: any, ctx: any, creds: any) {
    const { phone_number, contact_name, tags, vencimiento, correo, servicio } = ctx
    const resolve = (t: string) => resolveVars(t, { phone_number, contact_name, vencimiento, correo, servicio })

    switch (action.type) {
        case 'send_message': {
            if (!action.payload?.message) break
            const msg = resolve(action.payload.message)
            await sendWhatsAppMessage(phone_number, msg, creds.access_token, creds.phone_number_id)
            const { data: chat } = await supabaseAdmin
                .from('chats').select('id').eq('phone_number', phone_number).maybeSingle()
            if (chat) {
                await supabaseAdmin.from('messages').insert({ chat_id: chat.id, is_from_me: true, content: msg, status: 'delivered' })
                await supabaseAdmin.from('chats').update({ last_message: msg.substring(0, 100), last_message_time: new Date().toISOString() }).eq('id', chat.id)
            }
            break
        }
        case 'send_meta_template': {
            const { templateName, language, variables } = action.payload || {}
            if (!templateName) break
            const resolvedVars = (variables || []).map((v: string) => resolve(v))
            const components: any[] = resolvedVars.length > 0 ? [{
                type: 'body',
                parameters: resolvedVars.map((v: string) => ({ type: 'text', text: v || ' ' }))
            }] : []
            await sendWhatsAppTemplate(phone_number, templateName, language || 'es', components, creds.access_token, creds.phone_number_id)
            break
        }
        case 'add_tag': {
            if (!action.payload?.tag) break
            const currentTags: string[] = tags || []
            if (!currentTags.includes(action.payload.tag)) {
                const { data: chat } = await supabaseAdmin.from('chats').select('id').eq('phone_number', phone_number).maybeSingle()
                if (chat) await supabaseAdmin.from('chats').update({ tags: [...currentTags, action.payload.tag] }).eq('id', chat.id)
            }
            break
        }
    }
}

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
        .select('*, trigger_actions (*), trigger_conditions (*)')
        .eq('id', triggerId)
        .eq('user_id', user.id)
        .single()

    if (triggerError || !trigger) {
        return NextResponse.json({ error: 'Disparador no encontrado' }, { status: 404 })
    }

    const { data: creds } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id')
        .eq('user_id', user.id)
        .single()

    if (!creds?.access_token) {
        return NextResponse.json({ error: 'Configura tus credenciales de WhatsApp en Ajustes' }, { status: 400 })
    }

    const results = { executed: 0, skipped: 0, errors: 0, messages: [] as string[] }

    if (trigger.type === 'time') {
        const waitMinutes = parseInt(trigger.description || '30') || 30
        const cutoffTime = new Date(Date.now() - waitMinutes * 60 * 1000).toISOString()

        const { data: candidateChats } = await supabaseAdmin
            .from('chats')
            .select('id, phone_number, contact_name, tags')
            .eq('user_id', user.id)
            .lt('last_message_time', cutoffTime)

        for (const chat of (candidateChats || [])) {
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

            for (const action of (trigger.trigger_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)) {
                await executeAction(action, { ...chat }, creds)
                await delay(600)
            }
            results.executed++
            results.messages.push(chat.phone_number)
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
            const { data: chats } = await supabaseAdmin.from('chats').select('phone_number, contact_name, tags').eq('user_id', user.id).in('phone_number', phones)
            const chatByPhone = Object.fromEntries((chats || []).map(c => [c.phone_number, c]))

            const filteredSubs = audience_type === 'tag' && audience_value
                ? subs.filter(s => chatByPhone[s.numero]?.tags?.includes(audience_value))
                : subs

            for (const sub of filteredSubs) {
                const chat = chatByPhone[sub.numero]
                for (const action of (trigger.trigger_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)) {
                    await executeAction(action, {
                        phone_number: sub.numero,
                        contact_name: chat?.contact_name || '',
                        tags: chat?.tags || [],
                        vencimiento: sub.vencimiento,
                        correo: sub.correo,
                        servicio: sub.servicio,
                    }, creds)
                    await delay(600)
                }
                results.executed++
                results.messages.push(sub.numero)
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
