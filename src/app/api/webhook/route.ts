
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Token de verificación que configuraste en .env.local.
// DEBE coincidir con el que pongas en el Dashboard de Meta.
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN

// GET: Para la verificación inicial de Meta (Webhook Challenge)
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    // Check if a token and mode is in the query string of the request
    if (mode && token) {
        // Check the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED')
            // Respond with the challenge token from the request
            return new NextResponse(challenge, { status: 200 })
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            return new NextResponse('Forbidden', { status: 403 })
        }
    }

    return new NextResponse('Bad Request', { status: 400 })
}

// POST: Para recibir los mensajes de WhatsApp
export async function POST(request: Request) {
    try {
        const body = await request.json()
        // console.log('Incoming Webhook:', JSON.stringify(body, null, 2))

        // Validar si es un mensaje de WhatsApp Business API
        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                // Aquí extraemos la información del mensaje
                const value = body.entry[0].changes[0].value
                const messageObject = value.messages[0]
                const phoneNumber = messageObject.from
                const messageText = messageObject.text?.body || 'Mensaje sin texto'
                // Intentar obtener el nombre del contacto
                const contactName = value.contacts?.[0]?.profile?.name || phoneNumber

                console.log(`Mensaje recibido de ${contactName} (${phoneNumber}): ${messageText}`)

                // 1. Buscar o Crear CHAT
                const { data: existingChat } = await supabase
                    .from('chats')
                    .select('id, unread_count')
                    .eq('phone_number', phoneNumber)
                    .single()

                let chatId

                if (existingChat) {
                    chatId = existingChat.id
                    await supabase.from('chats').update({
                        last_message: messageText,
                        last_message_time: new Date().toISOString(),
                        unread_count: (existingChat.unread_count || 0) + 1
                    }).eq('id', chatId)
                } else {
                    const { data: newChat, error } = await supabase.from('chats').insert({
                        phone_number: phoneNumber,
                        contact_name: contactName,
                        last_message: messageText,
                        last_message_time: new Date().toISOString(),
                        unread_count: 1
                    }).select().single()

                    if (error) {
                        console.error('Error creating chat:', error)
                        // Si falla, no podemos guardar el mensaje
                        return new NextResponse('Error creating chat', { status: 500 })
                    }
                    chatId = newChat.id
                }

                // 2. Guardar MENSAJE
                const { error: msgError } = await supabase.from('messages').insert({
                    chat_id: chatId,
                    content: messageText,
                    is_from_me: false,
                    status: 'delivered'
                })

                if (msgError) console.error('Error saving message:', msgError)

            }

            // Retornar 200 OK inmediatamente para mantener a Meta feliz
            return new NextResponse('EVENT_RECEIVED', { status: 200 })
        } else {
            return new NextResponse('Not Found', { status: 404 })
        }
    } catch (error) {
        console.error('Error processing webhook:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
