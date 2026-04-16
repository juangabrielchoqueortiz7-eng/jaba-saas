import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { uploadWhatsAppMedia, sendWhatsAppMedia } from '@/lib/whatsapp'
import { logger, redactId } from '@/lib/logger'

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const chatId = formData.get('chatId') as string
        const file = formData.get('file') as File
        const caption = formData.get('caption') as string || ''

        if (!chatId || !file) {
            return NextResponse.json({ error: 'Missing chatId or file' }, { status: 400 })
        }

        const supabase = await createClient()

        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('phone_number, user_id, contact_name')
            .eq('id', chatId)
            .single()

        if (chatError || !chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
        }

        const { data: creds, error: credError } = await supabase
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id')
            .eq('user_id', chat.user_id)
            .single()

        if (credError || !creds) {
            return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
        }

        let mediaType: 'image' | 'video' | 'document' | 'audio' = 'document'
        if (file.type.startsWith('image/')) mediaType = 'image'
        else if (file.type.startsWith('video/')) mediaType = 'video'
        else if (file.type.startsWith('audio/')) mediaType = 'audio'

        const mediaId = await uploadWhatsAppMedia(file, creds.access_token, creds.phone_number_id)

        if (!mediaId) {
            return NextResponse.json({ error: 'Failed to upload media to Meta' }, { status: 500 })
        }

        const whatsappResponse = await sendWhatsAppMedia(
            chat.phone_number,
            mediaId,
            mediaType,
            caption,
            file.name,
            creds.access_token,
            creds.phone_number_id
        )
        const whatsappMessageId = whatsappResponse?.messages?.[0]?.id

        if (!whatsappResponse || whatsappResponse.error || !whatsappMessageId) {
            logger.error('[SendMedia] Failed to send media message', {
                mediaId: redactId(mediaId),
                error: whatsappResponse?.error,
            })
            return NextResponse.json({ error: 'Failed to send media message' }, { status: 500 })
        }

        let contentText = `Archivo enviado: ${file.name}`
        if (mediaType === 'image') contentText = 'Imagen enviada'
        if (mediaType === 'video') contentText = 'Video enviado'
        if (mediaType === 'audio') contentText = 'Audio enviado'
        if (caption) contentText += `\n${caption}`

        const { data: message, error: insertError } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                content: contentText,
                is_from_me: true,
                status: 'sent',
                media_type: mediaType,
                whatsapp_message_id: whatsappMessageId,
            })
            .select('id, content, is_from_me, created_at, status, media_type, media_url')
            .single()

        if (insertError) {
            logger.error('[SendMedia] Error saving media message to DB', insertError)
            return NextResponse.json({ error: 'Media sent but failed to save to DB' }, { status: 500 })
        }

        await supabase
            .from('chats')
            .update({
                last_message: contentText,
                last_message_time: new Date().toISOString(),
                last_message_status: 'sent',
            })
            .eq('id', chatId)

        return NextResponse.json({ success: true, mediaId, message, whatsapp_id: whatsappMessageId })
    } catch (error) {
        logger.error('[SendMedia] Unexpected route error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
