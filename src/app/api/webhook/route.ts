
import { NextResponse } from 'next/server'

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
        console.log('Incoming Webhook:', JSON.stringify(body, null, 2))

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
                const messageObject = body.entry[0].changes[0].value.messages[0]
                const phoneNumber = messageObject.from
                const messageText = messageObject.text?.body || 'Mensaje sin texto'
                const messageType = messageObject.type

                console.log(`Mensaje recibido de ${phoneNumber}: ${messageText}`)

                // TODO: Aquí procesaremos el mensaje con IA más adelante
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
