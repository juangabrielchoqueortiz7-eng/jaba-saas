import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { chatId } = await request.json()
        if (!chatId) return NextResponse.json({ error: 'Missing chatId' }, { status: 400 })

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)

        // Obtener credenciales del tenant y los wamids de mensajes no leídos del cliente
        const [{ data: chat }, { data: creds }] = await Promise.all([
            admin.from('chats').select('user_id').eq('id', chatId).single(),
            admin.from('chats')
                .select('user_id, whatsapp_credentials(access_token, phone_number_id)')
                .eq('id', chatId)
                .single()
        ])

        const credentials = (creds as any)?.whatsapp_credentials
        if (!credentials?.access_token || !credentials?.phone_number_id) {
            return NextResponse.json({ error: 'No credentials' }, { status: 404 })
        }

        // Obtener los últimos mensajes del cliente con wamid (solo los recientes sin leer)
        const { data: unreadMsgs } = await admin
            .from('messages')
            .select('whatsapp_message_id')
            .eq('chat_id', chatId)
            .eq('is_from_me', false)
            .not('whatsapp_message_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10)

        if (!unreadMsgs || unreadMsgs.length === 0) {
            return NextResponse.json({ success: true, marked: 0 })
        }

        // Marcar cada mensaje como leído en la API de Meta
        // Solo necesitamos marcar el último — WhatsApp marca todos los anteriores automáticamente
        const lastWamid = unreadMsgs[0].whatsapp_message_id
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${credentials.phone_number_id}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${credentials.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: lastWamid,
                }),
            }
        )

        if (!response.ok) {
            const err = await response.json()
            console.error('[mark-read] Meta API error:', err)
            return NextResponse.json({ error: 'Meta API error', detail: err }, { status: 500 })
        }

        // Actualizar unread_count a 0
        await admin.from('chats').update({ unread_count: 0 }).eq('id', chatId)

        return NextResponse.json({ success: true, marked: 1 })
    } catch (error) {
        console.error('[mark-read] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
