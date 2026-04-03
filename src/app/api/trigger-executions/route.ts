import { NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

// GET /api/trigger-executions?triggerId=xxx&limit=30
export async function GET(request: Request) {
    const supabase = await createUserClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const triggerId = searchParams.get('triggerId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)

    if (!triggerId) {
        return NextResponse.json({ error: 'Falta triggerId' }, { status: 400 })
    }

    // Verify trigger belongs to user
    const { data: trigger } = await supabaseAdmin
        .from('triggers')
        .select('id, name, user_id')
        .eq('id', triggerId)
        .eq('user_id', user.id)
        .single()

    if (!trigger) {
        return NextResponse.json({ error: 'Disparador no encontrado' }, { status: 404 })
    }

    // Fetch executions with chat info
    const { data: executions, error } = await supabaseAdmin
        .from('trigger_executions')
        .select(`
            id,
            trigger_id,
            chat_id,
            status,
            conditions_met,
            conditions_evaluated,
            actions_executed,
            actions_failed,
            action_details,
            errors,
            created_at
        `)
        .eq('trigger_id', triggerId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching executions:', error)
        return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
    }

    // Enrich with chat data (phone + name)
    const chatIds = [...new Set((executions || []).filter(e => e.chat_id).map(e => e.chat_id))]
    let chatMap: Record<string, { phone_number: string; contact_name: string }> = {}

    if (chatIds.length > 0) {
        const { data: chats } = await supabaseAdmin
            .from('chats')
            .select('id, phone_number, contact_name')
            .in('id', chatIds)

        chatMap = Object.fromEntries((chats || []).map(c => [c.id, c]))
    }

    const enriched = (executions || []).map(e => ({
        ...e,
        chat: e.chat_id ? chatMap[e.chat_id] || null : null,
    }))

    // Summary stats
    const total = enriched.length
    const successful = enriched.filter(e => e.status === 'success').length
    const failed = enriched.filter(e => e.status === 'failed').length

    return NextResponse.json({
        executions: enriched,
        stats: { total, successful, failed },
    })
}
