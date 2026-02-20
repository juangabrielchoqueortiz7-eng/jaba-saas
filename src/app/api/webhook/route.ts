
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Token de verificación que configuraste en .env.local.
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN

// Configurar Cliente Supabase Admin para bypass RLS
// INTENTO DE BYPASS: Usamos una variable nueva para asegurar que no hay cache
const SERVICE_ROLE_KEY = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
console.log(`[Webhook] Init Admin Client. Service Role Key present? ${!!SERVICE_ROLE_KEY}`)

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Fallback if service key missing (but ideally service key)
)

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

        // Validar si es un mensaje de WhatsApp Business API
        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const value = body.entry[0].changes[0].value
                const metadata = value.metadata
                const phoneId = metadata?.phone_number_id

                if (!phoneId) {
                    console.error('Webhook recibido sin phone_number_id metadata')
                    return new NextResponse('NO_METADATA', { status: 200 })
                }

                console.log(`[Webhook] Received Event for Phone ID: ${phoneId}`);

                // --- MULTI-TENANT LOOKUP ---
                // Buscamos de quién es este número de teléfono
                // --- MULTI-TENANT LOOKUP ---
                // Simplificamos la query para evitar problemas de tipos o sintaxis .or()
                const { data: credentialsList, error: credError } = await supabaseAdmin
                    .from('whatsapp_credentials')
                    .select('user_id, access_token')
                    .eq('phone_number_id', String(phoneId))

                const credentials = credentialsList?.[0] || null

                if (credError) {
                    console.error("Error looking up credentials:", credError);
                }

                if (!credentials) {
                    // Deep Debug
                    const keyLen = SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.length : 0;
                    const { count, error: countError } = await supabaseAdmin.from('whatsapp_credentials').select('*', { count: 'exact', head: true });

                    console.error(`Credenciales no encontradas para Phone ID: ${phoneId}`)
                    // Si no reconocemos el número, ignoramos (retornamos 200 para que Meta no reintente)
                    return NextResponse.json({
                        error: 'TENANT_NOT_FOUND',
                        debug_phone_id: phoneId,
                        debug_key_present: !!SERVICE_ROLE_KEY,
                        debug_key_len: keyLen,
                        debug_key_start: SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.substring(0, 5) : 'N/A',
                        debug_key_end: SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.substring(SERVICE_ROLE_KEY.length - 5) : 'N/A',
                        debug_url_present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                        debug_db_count: count,
                        debug_db_error: countError,
                        debug_env: process.env.NODE_ENV
                    }, { status: 200 })
                } else {
                    console.log(`[Webhook] Tenant Found: ${credentials.user_id}`);
                }

                const { user_id: tenantUserId, access_token: tenantToken } = credentials
                // ---------------------------

                const messageObject = value.messages[0]
                const phoneNumber = messageObject.from
                const messageText = messageObject.text?.body || 'Mensaje sin texto'
                const contactName = value.contacts?.[0]?.profile?.name || phoneNumber

                console.log(`[Tenant: ${tenantUserId}] Mensaje de ${contactName}: ${messageText}`)

                // 1. Buscar o Crear CHAT (Vinculado al Tenant)
                const { data: existingChat } = await supabaseAdmin
                    .from('chats')
                    .select('id, unread_count')
                    .eq('phone_number', phoneNumber)
                    .eq('user_id', tenantUserId)
                    .maybeSingle()

                let chatId

                if (existingChat) {
                    chatId = existingChat.id
                    // Actualizamos chat
                    await supabaseAdmin.from('chats').update({
                        last_message: messageText,
                        last_message_time: new Date().toISOString(),
                        unread_count: (existingChat.unread_count || 0) + 1
                    }).eq('id', chatId)
                } else {
                    const { data: newChat } = await supabaseAdmin.from('chats').insert({
                        phone_number: phoneNumber,
                        user_id: tenantUserId,
                        name: contactName,
                        last_message: messageText,
                        unread_count: 1,
                        status: 'active'
                    }).select().single()

                    if (newChat) chatId = newChat.id
                }

                // 2. Guardar el MENSAJE (Del Usuario)
                if (chatId) {
                    await supabaseAdmin.from('messages').insert({
                        chat_id: chatId,
                        sender: 'user',
                        content: messageText,
                        type: 'text',
                        status: 'delivered'
                    })
                }

                // =================================================================================
                // 3. CEREBRO IA (GEMINI) - AQUÍ OCURRE LA MAGIA 🧠✨
                // =================================================================================

                // A. Buscar configuración del Asistente del Tenant
                const { data: aiConfig } = await supabaseAdmin
                    .from('whatsapp_credentials')
                    .select('ai_status, bot_name, welcome_message, response_delay_seconds, audio_probability, message_delivery_mode, use_emojis, audio_voice_id, reply_audio_with_audio')
                    .eq('user_id', tenantUserId)
                    .single()

                // Si no hay config o está "dormido", no hacemos nada más.
                if (!aiConfig || aiConfig.ai_status === 'sleep') {
                    return new NextResponse('OK', { status: 200 })
                }

                // C. Esperar el delay configurado
                const delayMs = (aiConfig.response_delay_seconds || 2) * 1000
                await new Promise(resolve => setTimeout(resolve, delayMs))

                // D. Generar Respuesta con Gemini
                const { generateAIResponse, generateAudio } = await import('@/lib/ai')

                // Construir Prompt del Sistema
                const systemPrompt = `
                    Eres ${aiConfig.bot_name}, un asistente virtual profesional y amable.
                    Tu objetivo es ayudar al usuario basándote en el contexto.
                    Instrucciones de estilo:
                    - ${aiConfig.use_emojis ? 'Usa emojis ocasionalmente para ser más empático.' : 'NO uses emojis, mantén un tono sobrio.'}
                    - Responde de manera concisa y directa.
                    - Contexto del negocio: ${aiConfig.welcome_message || 'Atención al cliente general.'}
                `

                const aiResponseText = await generateAIResponse(messageText, systemPrompt)

                // E. Decidir si respondemos con AUDIO o TEXTO
                const randomChance = Math.random() * 100
                const shouldSendAudio = randomChance <= (aiConfig.audio_probability || 0)

                // Importar helper de envío
                const { sendWhatsAppMessage, sendWhatsAppAudio } = await import('@/lib/whatsapp')

                if (shouldSendAudio) {
                    // --- FLUJO DE RESPUESTA DE AUDIO ---
                    try {
                        const voiceId = aiConfig.audio_voice_id || 'es-US-Neural2-A';
                        const audioBase64 = await generateAudio(aiResponseText, voiceId);

                        if (audioBase64) {
                            // Convertir Base64 a Buffer para subir
                            const audioBuffer = Buffer.from(audioBase64, 'base64');
                            const fileName = `audio/${chatId}/${Date.now()}.mp3`;
                            const bucketName = 'audio-messages';

                            // Intentar subir
                            // Nota: El bucket debe existir y ser público.
                            // Si no existe, el primer upload fallará si no tenemos lógica de creación.
                            // Pro-tip: Intentamos crear el bucket si falla (o asumimos que existe).

                            let { error: uploadError } = await supabaseAdmin.storage
                                .from(bucketName)
                                .upload(fileName, audioBuffer, {
                                    contentType: 'audio/mpeg',
                                    upsert: false
                                });

                            if (uploadError && uploadError.message.includes('bucket not found')) {
                                // Intentamos crear el bucket (Solo funcionará con Service Role Key)
                                console.log("Bucket no encontrado, intentando crear...");
                                await supabaseAdmin.storage.createBucket(bucketName, { public: true });
                                // Reintentar subida
                                const retry = await supabaseAdmin.storage.from(bucketName).upload(fileName, audioBuffer, { contentType: 'audio/mpeg' });
                                uploadError = retry.error;
                            }

                            if (uploadError) {
                                throw new Error(`Error subiendo audio: ${uploadError.message}`);
                            }

                            // Obtener URL Pública
                            const { data: { publicUrl } } = supabaseAdmin.storage
                                .from(bucketName)
                                .getPublicUrl(fileName);

                            console.log(`[AI] Audio subido: ${publicUrl}`);

                            // Enviar Audio Real a WhatsApp
                            await sendWhatsAppAudio(phoneNumber, publicUrl, tenantToken, phoneId);

                        } else {
                            throw new Error('Fallo generación de audio (vacío)');
                        }
                    } catch (e) {
                        console.error("Error flujo audio:", e);
                        // Fallback a texto si falla el audio
                        await sendWhatsAppMessage(phoneNumber, `(No pude enviar audio, aquí el texto): ${aiResponseText}`, tenantToken, phoneId)
                    }

                    if (chatId) {
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            sender: 'ai',
                            content: aiResponseText,
                            type: 'audio',
                            status: 'sent'
                        })
                    }

                } else {
                    // --- FLUJO DE RESPUESTA DE TEXTO ---
                    await sendWhatsAppMessage(phoneNumber, aiResponseText, tenantToken, phoneId)

                    if (chatId) {
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            sender: 'ai',
                            content: aiResponseText,
                            type: 'text',
                            status: 'sent'
                        })
                    }
                }

                console.log(`[AI] Respondió a ${phoneNumber}: "${aiResponseText.substring(0, 50)}..."`)

                return new NextResponse('EVENT_RECEIVED', { status: 200 })

            } else {
                return new NextResponse('Not Found', { status: 404 })
            }
        } else {
            return new NextResponse('OK', { status: 200 })
        }
    } catch (error) {
        console.error('Error processing webhook:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
