import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsAppVideo } from '@/lib/whatsapp'
import { logger, redactId, redactPhone, redactUrl } from '@/lib/logger'

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
            logger.error('[Send Video] Error fetching credentials', credError)
            return NextResponse.json({ error: 'WhatsApp Credentials not found for this tenant' }, { status: 404 })
        }

        // 3. Send to WhatsApp Graph API
        logger.info('[Send Video] Sending WhatsApp video', {
            phone: redactPhone(chat.phone_number),
            phoneNumberId: redactId(creds.phone_number_id),
        })

        // Ensure absolute URL (Meta API requires public absolute URLs for downloaded media)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com';
        let absoluteVideoUrl = videoUrl.startsWith('http') ? videoUrl : `${baseUrl}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;

        // HARD FIX: If it's the tutorial video, use the reliable Supabase Storage URL explicitly
        if (videoUrl === '/tutorial.mp4' || videoUrl === 'tutorial.mp4') {
            absoluteVideoUrl = 'https://mnepydxofhcgbykpcyfc.supabase.co/storage/v1/object/public/sales-assets/tutorial.mp4';
        }

        logger.debug('[Send Video] Using media URL', { url: redactUrl(absoluteVideoUrl) })

        const whatsappResponse = await sendWhatsAppVideo(
            chat.phone_number,
            absoluteVideoUrl,
            caption || '',
            creds.access_token,
            creds.phone_number_id
        )

        if (!whatsappResponse) {
            logger.error('[Send Video] WhatsApp API returned null', { chatId: redactId(chatId) })
            return NextResponse.json({ error: 'Failed to send video to WhatsApp API' }, { status: 500 })
        }

        logger.debug('[Send Video] WhatsApp API response received', {
            whatsappId: redactId(whatsappResponse.messages?.[0]?.id),
        })

        // 4. Insert into Database
        const displayCaption = caption || 'Video tutorial enviado'
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
        logger.error('[Send Video] Unexpected route error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
