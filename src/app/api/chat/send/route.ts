
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export async function POST(request: Request) {
    try {
        const { chatId, content } = await request.json()

        if (!chatId || !content) {
            return NextResponse.json({ error: 'Missing chatId or content' }, { status: 400 })
        }

        const supabase = await createClient()

        // 1. Get Chat Details (Phone Number + Tenant User ID)
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('phone_number, user_id, contact_name')
            .eq('id', chatId)
            .single()

        if (chatError || !chat) {
            return NextResponse.json({ error: 'Chat not found or permission denied' }, { status: 404 })
        }

        // 2. Get Tenant Credentials (WhatsApp Token)
        // We need to use the Service Role to get credentials if the user is not the owner (But here the user IS the owner/admin)
        // However, RLS might hide credentials. Let's assume the user has access to their own credentials via RLS.
        const { data: creds, error: credError } = await supabase
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id')
            .eq('user_id', chat.user_id)
            .single()

        if (credError || !creds) {
            console.error("Error fetching credentials:", credError);
            return NextResponse.json({ error: 'WhatsApp Credentials not found for this tenant' }, { status: 404 })
        }

        // 3. Send to WhatsApp Graph API
        const whatsappResponse = await sendWhatsAppMessage(
            chat.phone_number,
            content,
            creds.access_token,
            creds.phone_number_id
        )

        if (!whatsappResponse) {
            return NextResponse.json({ error: 'Failed to send message to WhatsApp API' }, { status: 500 })
        }

        // 4. Insert into Database
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                content: content,
                is_from_me: true,
                status: 'sent'
            })

        if (insertError) {
            console.error("Error saving message to DB:", insertError)
            return NextResponse.json({ error: 'Message sent but failed to save to DB' }, { status: 500 })
        }

        // 5. Update Chat Last Message
        await supabase
            .from('chats')
            .update({
                last_message: content,
                last_message_time: new Date().toISOString()
            })
            .eq('id', chatId)

        return NextResponse.json({ success: true, whatsapp_id: whatsappResponse.messages?.[0]?.id })

    } catch (error) {
        console.error('Error in /api/chat/send:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
