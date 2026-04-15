import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { asRecord } from '@/lib/automation-jobs'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type TagAction = 'add' | 'remove'

// POST: Agregar o quitar tags de un chat
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No token' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const anonClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { user }, error: authError } = await anonClient.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const body = asRecord(await request.json())
        const chat_id = typeof body?.chat_id === 'string' ? body.chat_id : ''
        const action = body?.action === 'add' || body?.action === 'remove' ? body.action as TagAction : null
        const tag = typeof body?.tag === 'string' ? body.tag : ''

        if (!chat_id || !action || !tag) {
            return NextResponse.json({ error: 'Missing chat_id, action, or tag' }, { status: 400 })
        }

        // Verificar que el chat pertenece al usuario
        const { data: chat, error: fetchError } = await supabase
            .from('chats')
            .select('id, tags')
            .eq('id', chat_id)
            .eq('user_id', user.id)
            .single()

        if (fetchError || !chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
        }

        let currentTags: string[] = chat.tags || []

        if (action === 'add' && !currentTags.includes(tag)) {
            currentTags.push(tag)
        } else if (action === 'remove') {
            currentTags = currentTags.filter(t => t !== tag)
        }

        await supabase.from('chats').update({ tags: currentTags }).eq('id', chat_id)

        return NextResponse.json({ success: true, tags: currentTags })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error'
        console.error('[Chat Tags] Error:', error)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
