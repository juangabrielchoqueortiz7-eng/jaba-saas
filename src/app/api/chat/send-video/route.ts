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
        console.log(`[Send Video] Uploading and sending to ${chat.phone_number} via PhoneID ${creds.phone_number_id}`)

        // Intentar usar Upload Local primero y si falla enviar por URL absoluta (fallback)
        let mediaIdentifier = videoUrl;
        let absoluteVideoUrl = videoUrl;
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com';

        try {
            const { uploadMediaToWhatsApp } = await import('@/lib/whatsapp');
            const path = await import('path');

            // Si el videoUrl es local (ej. '/tutorial.mp4'), podemos ubicarlo en local o public
            if (!videoUrl.startsWith('http')) {
                const localPath = path.join(process.cwd(), 'public', videoUrl.replace(/^\//, ''));
                const mediaId = await uploadMediaToWhatsApp(creds.phone_number_id, creds.access_token, localPath, 'video/mp4');
                if (mediaId) {
                    mediaIdentifier = mediaId;
                    console.log(`[Send Video] Media uploaded successfully: ${mediaId}`);
                }
                absoluteVideoUrl = `${baseUrl}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
            }
        } catch (uploadErr) {
            console.error('[Send Video] Falló subida local, enviando por URL', uploadErr);
        }

        const whatsappResponse = await sendWhatsAppVideo(
            chat.phone_number,
            mediaIdentifier, // is mediaId if uploaded, else url
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
