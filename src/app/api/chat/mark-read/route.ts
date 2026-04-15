import { NextResponse } from 'next/server'
import { asRecord, asRecordArray, getString } from '@/lib/automation-jobs'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function extractCredentials(value: unknown): { access_token: string; phone_number_id: string } | null {
    const record = asRecord(value)
    if (!record) {
        return null
    }

    const relation = record.whatsapp_credentials
    const nestedRecord = Array.isArray(relation)
        ? asRecordArray(relation)[0] ?? null
        : asRecord(relation)

    if (!nestedRecord) {
        return null
    }

    const accessToken = getString(nestedRecord, 'access_token')
    const phoneNumberId = getString(nestedRecord, 'phone_number_id')

    if (!accessToken || !phoneNumberId) {
        return null
    }

    return { access_token: accessToken, phone_number_id: phoneNumberId }
}

export async function POST(request: Request) {
    try {
        const body = asRecord(await request.json())
        const chatId = typeof body?.chatId === 'string' ? body.chatId : ''
        if (!chatId) return NextResponse.json({ error: 'Missing chatId' }, { status: 400 })

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)

        const [{ data: chatRow }, { data: credentialsRow }] = await Promise.all([
            admin.from('chats').select('id, user_id').eq('id', chatId).single(),
            admin.from('chats')
                .select('user_id, whatsapp_credentials(access_token, phone_number_id)')
                .eq('id', chatId)
                .single(),
        ])

        const chat = asRecord(chatRow)
        if (!chat || getString(chat, 'user_id') !== user.id) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
        }

        const credentials = extractCredentials(credentialsRow)
        if (!credentials) {
            return NextResponse.json({ error: 'No credentials' }, { status: 404 })
        }

        const { data: unreadMessages } = await admin
            .from('messages')
            .select('whatsapp_message_id')
            .eq('chat_id', chatId)
            .eq('is_from_me', false)
            .not('whatsapp_message_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10)

        const unreadMessageList = asRecordArray(unreadMessages)
        if (unreadMessageList.length === 0) {
            return NextResponse.json({ success: true, marked: 0 })
        }

        const lastWamid = getString(unreadMessageList[0], 'whatsapp_message_id')
        if (!lastWamid) {
            return NextResponse.json({ success: true, marked: 0 })
        }

        const response = await fetch(
            `https://graph.facebook.com/v21.0/${credentials.phone_number_id}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${credentials.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: lastWamid,
                }),
            },
        )

        if (!response.ok) {
            const errorPayload = await response.json()
            console.error('[mark-read] Meta API error:', errorPayload)
            return NextResponse.json({ error: 'Meta API error', detail: errorPayload }, { status: 500 })
        }

        await admin.from('chats').update({ unread_count: 0 }).eq('id', chatId)
        return NextResponse.json({ success: true, marked: 1 })
    } catch (error) {
        console.error('[mark-read] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
