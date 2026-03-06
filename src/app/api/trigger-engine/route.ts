import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ============================================================
// TRIGGER ENGINE — Evalúa triggers tipo "time" cada 15 minutos
// Si un chat no responde en X minutos → ejecutar acciones
// ============================================================
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Trigger Engine] Starting...')

    try {
        const result = await processTimeTriggers()
        console.log(`[Trigger Engine] Done: ${result.executed} triggers executed, ${result.skipped} skipped`)
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Trigger Engine] Fatal error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function processTimeTriggers() {
    const results = { executed: 0, skipped: 0, errors: 0 }

    // 1. Fetch all active time-based triggers
    const { data: triggers, error } = await supabaseAdmin
        .from('triggers')
        .select(`
            *,
            trigger_actions (*),
            trigger_conditions (*)
        `)
        .eq('type', 'time')
        .eq('is_active', true)

    if (error) {
        console.error('[Trigger Engine] Error fetching triggers:', error)
        return { ...results, error: error.message }
    }

    if (!triggers || triggers.length === 0) {
        console.log('[Trigger Engine] No active time triggers')
        return results
    }

    // 2. Process each trigger
    for (const trigger of triggers) {
        try {
            // Extract wait time from description (e.g. "30" = 30 minutes)
            const waitMinutes = parseInt(trigger.description || '30') || 30
            const cutoffTime = new Date(Date.now() - waitMinutes * 60 * 1000).toISOString()

            // Get credentials for this user
            const { data: creds } = await supabaseAdmin
                .from('whatsapp_credentials')
                .select('access_token, phone_number_id, bot_name')
                .eq('user_id', trigger.user_id)
                .single()

            if (!creds?.access_token) {
                console.log(`[Trigger Engine] No credentials for user ${trigger.user_id}`)
                results.skipped++
                continue
            }

            // Find chats where last message is FROM the client (not from bot)
            // and the client hasn't gotten a response in X minutes
            const { data: candidateChats } = await supabaseAdmin
                .from('chats')
                .select('id, phone_number, contact_name, tags')
                .eq('user_id', trigger.user_id)
                .lt('last_message_time', cutoffTime)

            if (!candidateChats || candidateChats.length === 0) {
                results.skipped++
                continue
            }

            // For each chat, check if last message is from client (not from bot)
            for (const chat of candidateChats) {
                const { data: lastMsg } = await supabaseAdmin
                    .from('messages')
                    .select('is_from_me, created_at')
                    .eq('chat_id', chat.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                // Skip if last message is from bot (already responded)
                if (!lastMsg || lastMsg.is_from_me) continue

                // Skip if last message is too old (> 24 hours — can't send outside window)
                const msgAge = Date.now() - new Date(lastMsg.created_at).getTime()
                if (msgAge > 24 * 60 * 60 * 1000) continue

                // Check conditions (optional)
                if (trigger.trigger_conditions?.length > 0) {
                    const conditionsMet = trigger.trigger_conditions.every((cond: any) => {
                        switch (cond.type) {
                            case 'has_tag':
                                const tags = chat.tags || []
                                return cond.operator === 'equals'
                                    ? tags.includes(cond.value)
                                    : !tags.includes(cond.value)
                            case 'contains_words':
                                // Would need to check message content
                                return true
                            default:
                                return true
                        }
                    })
                    if (!conditionsMet) continue
                }

                // Execute actions
                for (const action of (trigger.trigger_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)) {
                    try {
                        switch (action.type) {
                            case 'send_message':
                                if (action.payload?.message) {
                                    const msg = action.payload.message
                                        .replace('{nombre}', chat.contact_name || '')
                                        .replace('{telefono}', chat.phone_number || '')
                                    await sendWhatsAppMessage(chat.phone_number, msg, creds.access_token, creds.phone_number_id)

                                    // Save message to chat
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

                            case 'add_tag':
                                if (action.payload?.tag) {
                                    const currentTags: string[] = chat.tags || []
                                    if (!currentTags.includes(action.payload.tag)) {
                                        currentTags.push(action.payload.tag)
                                        await supabaseAdmin.from('chats').update({ tags: currentTags }).eq('id', chat.id)
                                    }
                                }
                                break

                            case 'notify_admin':
                                console.log(`[Trigger Engine] 🔔 Admin notification: ${action.payload?.title || ''} - ${action.payload?.message || ''} (chat: ${chat.contact_name})`)
                                break

                            case 'toggle_bot':
                                // Toggle bot state for this chat (future implementation)
                                break
                        }
                    } catch (actionErr) {
                        console.error(`[Trigger Engine] Action error:`, actionErr)
                    }

                    await delay(1000)
                }

                results.executed++
            }
        } catch (triggerErr) {
            console.error(`[Trigger Engine] Trigger ${trigger.name} error:`, triggerErr)
            results.errors++
        }
    }

    return results
}
