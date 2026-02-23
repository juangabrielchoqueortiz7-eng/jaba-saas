import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsAppVideo } from '@/lib/whatsapp'

export async function POST(request: Request) {
    try {
        const { chatId, videoUrl, caption } = await request.json()

        if (!chatId || !videoUrl) {
            return NextResponse.json({ error: 'Missing chatId or videoUrl' }, { status: 400 })
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
        console.log(`[Send Video] Sending to ${chat.phone_number} via PhoneID ${creds.phone_number_id}`)

        // Ensure absolute URL (Meta API requires public absolute URLs for downloaded media)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com';
        const absoluteVideoUrl = videoUrl.startsWith('http') ? videoUrl : `${baseUrl}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;

        console.log(`[Send Video] Using absolute URL: ${absoluteVideoUrl}`)

        const whatsappResponse = await sendWhatsAppVideo(
            chat.phone_number,
            absoluteVideoUrl,
            caption || '',
            creds.access_token,
            creds.phone_number_id
        )

        if (!whatsappResponse) {
            console.error(`[Send Video] WhatsApp API returned null for chat ${chatId}`)
            return NextResponse.json({ error: 'Failed to send video to WhatsApp API' }, { status: 500 })
        }

        console.log(`[Send Video] WhatsApp API Response:`, JSON.stringify(whatsappResponse).substring(0, 200))

        // 4. Insert into Database
        const displayCaption = caption || '🎬 Video Tutorial Enviado';
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                content: displayCaption,
                media_url: absoluteVideoUrl,
                is_from_me: true,
                status: 'delivered'
            })

        if (insertError) {
            // Retry without media_url if column doesn't exist
            await supabase.from('messages').insert({
                chat_id: chatId,
                content: displayCaption,
                is_from_me: true,
                status: 'delivered'
            })
        }

        // 5. Update Chat Last Message
        await supabase
            .from('chats')
            .update({
                last_message: displayCaption,
                last_message_time: new Date().toISOString()
            })
            .eq('id', chatId)

        return NextResponse.json({ success: true, whatsapp_id: whatsappResponse.messages?.[0]?.id })

    } catch (error) {
        console.error('Error in /api/chat/send-video:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
