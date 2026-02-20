
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
                    console.error(`Credenciales no encontradas para Phone ID: ${phoneId}`)
                    return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 200 })
                } else {
                    console.log(`[Webhook] Tenant Found: ${credentials.user_id}`);
                }

                const { user_id: tenantUserId, access_token: tenantToken } = credentials
                // ---------------------------

                const messageObject = value.messages[0]
                const phoneNumber = messageObject.from
                const messageType = messageObject.type || 'unknown'
                const contactName = value.contacts?.[0]?.profile?.name || phoneNumber

                // Extract content based on message type
                let messageText: string
                switch (messageType) {
                    case 'text':
                        messageText = messageObject.text?.body || 'Mensaje sin texto'
                        break
                    case 'image':
                        messageText = `📷 Imagen${messageObject.image?.caption ? ': ' + messageObject.image.caption : ''}`
                        break
                    case 'audio':
                        messageText = '🎵 Mensaje de voz'
                        break
                    case 'video':
                        messageText = `🎬 Video${messageObject.video?.caption ? ': ' + messageObject.video.caption : ''}`
                        break
                    case 'document':
                        messageText = `📎 Documento: ${messageObject.document?.filename || 'archivo'}`
                        break
                    case 'sticker':
                        messageText = '🏷️ Sticker'
                        break
                    case 'location':
                        messageText = `📍 Ubicación: ${messageObject.location?.latitude}, ${messageObject.location?.longitude}`
                        break
                    case 'contacts':
                        messageText = `👤 Contacto compartido`
                        break
                    case 'reaction':
                        messageText = `${messageObject.reaction?.emoji || '👍'} Reacción`
                        break
                    case 'button':
                        messageText = messageObject.button?.text || 'Botón presionado'
                        break
                    case 'interactive':
                        messageText = messageObject.interactive?.button_reply?.title || messageObject.interactive?.list_reply?.title || 'Respuesta interactiva'
                        break
                    default:
                        messageText = `[${messageType}] Mensaje no soportado`
                }

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
                    // Actualizamos chat y NOMBRE DE CONTACTO
                    await supabaseAdmin.from('chats').update({
                        last_message: messageText,
                        last_message_time: new Date().toISOString(),
                        unread_count: (existingChat.unread_count || 0) + 1,
                        contact_name: contactName // Sync Contact Name
                    }).eq('id', chatId)
                } else {
                    const { data: newChat, error: chatError } = await supabaseAdmin.from('chats').insert({
                        phone_number: phoneNumber,
                        user_id: tenantUserId,
                        contact_name: contactName,
                        last_message: messageText,
                        unread_count: 1
                    }).select().single()

                    if (chatError) console.error("Error creating chat:", chatError);
                    if (newChat) chatId = newChat.id
                }

                // 2. Guardar el MENSAJE (Del Usuario)
                if (chatId) {
                    const { error: msgError } = await supabaseAdmin.from('messages').insert({
                        chat_id: chatId,
                        is_from_me: false, // User sent this
                        content: messageText,
                        status: 'delivered'
                    })
                    if (msgError) {
                        console.error("Error saving user message:", msgError);
                        // DEBUG HACK: Save error to chat so we can see it
                        await supabaseAdmin.from('chats').update({
                            last_message: `ERROR SAVING MSG: ${msgError.message}`
                        }).eq('id', chatId)
                    }
                }

                // =================================================================================
                // 3. CEREBRO IA (GEMINI) - AQUÍ OCURRE LA MAGIA 🧠✨
                // =================================================================================

                // Solo respondemos con IA a mensajes de TEXTO y AUDIO
                // Imágenes, stickers, etc. se guardan pero no generan respuesta IA
                if (messageType !== 'text' && messageType !== 'audio') {
                    console.log(`[AI] Skipping AI response for message type: ${messageType}`)
                    return new NextResponse('EVENT_RECEIVED', { status: 200 })
                }

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

                // D. Generar Respuesta con Gemini (con Function Calling para ventas)
                const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai')
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

                // Catálogo de planes
                const PLANS: Record<string, { name: string, months: string, price: number, qr_file: string }> = {
                    '1m': { name: 'Básico', months: '1 mes', price: 19, qr_file: 'qr_1m.jpg' },
                    '3m': { name: 'Bronce', months: '3 meses', price: 39, qr_file: 'qr_3m.jpg' },
                    '6m': { name: 'Plata', months: '6 meses', price: 69, qr_file: 'qr_6m.jpg' },
                    '9m': { name: 'Gold', months: '9 meses', price: 99, qr_file: 'qr_9m.jpg' },
                    '1y': { name: 'Premium', months: '1 año', price: 109, qr_file: 'qr_1y.jpg' },
                }

                // Buscar historial de mensajes recientes para contexto
                const { data: recentMessages } = await supabaseAdmin
                    .from('messages')
                    .select('content, is_from_me, created_at')
                    .eq('chat_id', chatId)
                    .order('created_at', { ascending: false })
                    .limit(15)

                const chatHistory = (recentMessages || [])
                    .reverse()
                    .map(m => `${m.is_from_me ? 'Asistente' : 'Cliente'}: ${m.content}`)
                    .join('\n')

                // Buscar pedido activo de este chat
                const { data: activeOrder } = await supabaseAdmin
                    .from('orders')
                    .select('*')
                    .eq('chat_id', chatId)
                    .in('status', ['pending_email', 'pending_payment', 'pending_delivery'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                const orderContext = activeOrder
                    ? `\nPEDIDO ACTIVO: Plan ${activeOrder.plan_name} (${activeOrder.plan}) a Bs ${activeOrder.amount}. Estado: ${activeOrder.status}. Email: ${activeOrder.customer_email || 'NO proporcionado aún'}.`
                    : ''

                // System prompt con catálogo de ventas
                const salesSystemPrompt = `
Eres ${aiConfig.bot_name}, asistente de ventas de JABA Marketing Digital por WhatsApp.
${aiConfig.use_emojis ? 'Usa emojis para ser más cercano y amable.' : 'NO uses emojis.'}
Responde de forma concisa y profesional.

CATÁLOGO CANVA PRO:
- Plan Básico: 1 mes → Bs 19
- Plan Bronce: 3 meses → Bs 39
- Plan Plata: 6 meses → Bs 69
- Plan Gold: 9 meses → Bs 99
- Plan Premium: 1 año → Bs 109

Todos los planes incluyen: Miles de plantillas Pro, Estudio Mágico, Kit de Marca, Páginas Web, Soporte 24 horas.
Método de pago: QR bancario (BNB, BancoSol, Banco Unión, Tigo Money).

FLUJO DE VENTA:
1. Si el cliente pregunta por Canva Pro → presenta los planes con precios.
2. Si el cliente elige un plan → confirma la elección y pídele su correo electrónico para enviarle el acceso.
3. Si el cliente envía su correo electrónico → confirma que recibiste el email, y dile que le envías el QR de pago y que una vez realizado el pago se le enviará el acceso a su correo.
4. Si el cliente pregunta otra cosa → responde amablemente según el contexto.

INSTRUCCIONES ESPECIALES:
- Cuando el cliente CONFIRME un plan (ej: "quiero 3 meses", "el de bronce", "ese"), usa la función confirm_plan.
- Cuando el cliente envíe un email (ej: "mi correo es juan@gmail.com"), usa la función process_email.
- NO inventes funciones que no existen. Solo usa confirm_plan y process_email cuando sea apropiado.
- Si no estás seguro de qué plan quiere el cliente, pregúntale para aclarar antes de usar confirm_plan.
${orderContext}

Contexto del negocio: ${aiConfig.welcome_message || 'Venta de suscripciones Canva Pro.'}

HISTORIAL DE CONVERSACIÓN:
${chatHistory}
`

                // Function declarations para Gemini
                const salesFunctions: any = [
                    {
                        name: 'confirm_plan',
                        description: 'Se llama cuando el cliente confirma que quiere comprar un plan específico de Canva Pro. Solo llamar cuando el cliente ha expresado claramente qué plan desea.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                plan_id: {
                                    type: SchemaType.STRING,
                                    description: 'ID del plan elegido: "1m" para 1 mes, "3m" para 3 meses, "6m" para 6 meses, "9m" para 9 meses, "1y" para 1 año',
                                    enum: ['1m', '3m', '6m', '9m', '1y']
                                }
                            },
                            required: ['plan_id']
                        }
                    },
                    {
                        name: 'process_email',
                        description: 'Se llama cuando el cliente proporciona su correo electrónico para recibir el acceso a Canva Pro.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                email: {
                                    type: SchemaType.STRING,
                                    description: 'El correo electrónico del cliente'
                                }
                            },
                            required: ['email']
                        }
                    }
                ]

                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.0-flash-001',
                    tools: [{ functionDeclarations: salesFunctions }]
                })

                // D. Preparar mensaje para Gemini (transcribir audio si es necesario)
                let aiInputText = messageText

                if (messageType === 'audio' && messageObject.audio?.id) {
                    // Transcribir audio con Gemini multimodal
                    try {
                        const { getWhatsAppMediaUrl } = await import('@/lib/whatsapp')
                        const mediaUrl = await getWhatsAppMediaUrl(messageObject.audio.id, tenantToken)

                        if (mediaUrl) {
                            // Descargar el audio
                            const audioResp = await fetch(mediaUrl, {
                                headers: { Authorization: `Bearer ${tenantToken}` }
                            })
                            const audioBuffer = await audioResp.arrayBuffer()
                            const audioBase64 = Buffer.from(audioBuffer).toString('base64')
                            const mimeType = messageObject.audio.mime_type || 'audio/ogg'

                            // Usar Gemini para transcribir
                            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
                            const audioModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' }) // Use a model capable of multimodal input

                            const transcriptionResult = await audioModel.generateContent([
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: audioBase64
                                    }
                                },
                                { text: 'Transcribe este audio al español. Solo devuelve la transcripción, sin explicaciones adicionales.' }
                            ])

                            aiInputText = transcriptionResult.response.text() || messageText
                            console.log(`[AI] Audio transcrito: "${aiInputText.substring(0, 80)}..."`)
                        }
                    } catch (audioErr) {
                        console.error('[AI] Error transcribiendo audio:', audioErr)
                        aiInputText = '(El usuario envió un mensaje de voz pero no pude transcribirlo)'
                    }
                }

                const geminiResult = await model.generateContent({
                    contents: [
                        { role: 'user', parts: [{ text: salesSystemPrompt + '\n\nMensaje actual del cliente: ' + aiInputText }] }
                    ]
                })

                const response = geminiResult.response
                const candidate = response.candidates?.[0]
                const parts = candidate?.content?.parts || []

                let aiResponseText = ''
                let actionExecuted = false

                // Procesar partes de la respuesta (texto + function calls)
                for (const part of parts) {
                    if (part.text) {
                        aiResponseText += part.text
                    }

                    if (part.functionCall) {
                        const { name, args } = part.functionCall
                        const callArgs = args as any // Avoid TS errors on dynamic properties
                        console.log(`[SALES] Function call: ${name}`, JSON.stringify(callArgs))

                        if (name === 'confirm_plan' && callArgs?.plan_id) {
                            const planId = callArgs.plan_id as string
                            const plan = PLANS[planId]

                            if (plan && chatId) {
                                // Crear pedido en estado pending_email
                                const { error: orderError } = await supabaseAdmin.from('orders').insert({
                                    user_id: tenantUserId,
                                    chat_id: chatId,
                                    phone_number: phoneNumber,
                                    contact_name: contactName,
                                    product: 'canva_pro',
                                    plan: planId,
                                    plan_name: plan.name,
                                    amount: plan.price,
                                    status: 'pending_email'
                                })
                                if (orderError) {
                                    console.error('[SALES] Error creando pedido:', orderError)
                                    // DEBUG: Guardar error en chat para visibilidad
                                    await supabaseAdmin.from('chats').update({
                                        last_message: `❌ Error Pedido: ${orderError.message}`
                                    }).eq('id', chatId)
                                } else {
                                    console.log(`[SALES] Pedido creado: Plan ${plan.name} para ${contactName}`)
                                    // DEBUG: Marcar éxito en chat
                                    await supabaseAdmin.from('chats').update({
                                        last_message: `✅ Pedido Creado: ${plan.name}`
                                    }).eq('id', chatId)
                                    actionExecuted = true
                                }
                            }
                        }

                        if (name === 'process_email' && callArgs?.email) {
                            const email = callArgs.email as string

                            if (chatId) {
                                // Buscar pedido activo más reciente para este chat
                                const { data: pendingOrder } = await supabaseAdmin
                                    .from('orders')
                                    .select('*')
                                    .eq('chat_id', chatId)
                                    .in('status', ['pending_email', 'pending_payment'])
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle()

                                if (pendingOrder) {
                                    // Actualizar pedido con email y cambiar status
                                    await supabaseAdmin.from('orders').update({
                                        customer_email: email,
                                        status: 'pending_delivery',
                                        updated_at: new Date().toISOString()
                                    }).eq('id', pendingOrder.id)

                                    console.log(`[SALES] Email registrado: ${email} para pedido ${pendingOrder.id}`)
                                    // DEBUG: Marcar éxito en chat
                                    await supabaseAdmin.from('chats').update({
                                        last_message: `✅ Email vinculado: ${email}`
                                    }).eq('id', chatId)

                                    // Enviar QR de pago
                                    const plan = PLANS[pendingOrder.plan]
                                    if (plan) {
                                        try {
                                            const { sendWhatsAppImage } = await import('@/lib/whatsapp')
                                            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                                            const qrUrl = `${supabaseUrl}/storage/v1/object/public/sales-assets/qr/${plan.qr_file}`

                                            await sendWhatsAppImage(
                                                phoneNumber,
                                                qrUrl,
                                                `💳 QR de pago - Plan ${plan.name} (${plan.months})\nMonto: Bs ${plan.price}\nPagar a: Choque Ortiz Juan Gabriel`,
                                                tenantToken,
                                                phoneId
                                            )
                                            console.log(`[SALES] QR enviado: ${plan.qr_file}`)

                                            // Guardar mensaje de imagen QR en DB
                                            await supabaseAdmin.from('messages').insert({
                                                chat_id: chatId,
                                                is_from_me: true,
                                                content: `📸 QR de pago enviado - Plan ${plan.name} (Bs ${plan.price})`,
                                                status: 'delivered'
                                            })
                                        } catch (qrError) {
                                            console.error('[SALES] Error enviando QR:', qrError)
                                        }
                                    }

                                    actionExecuted = true
                                } else {
                                    console.log('[SALES] Email recibido pero no hay pedido activo')
                                    // DEBUG: Marcar fallo en chat
                                    await supabaseAdmin.from('chats').update({
                                        last_message: `⚠️ Email recibido pero SIN PEDIDO ACTIVO`
                                    }).eq('id', chatId)
                                }
                            }
                        }
                    }
                }

                // Si no hubo texto en la respuesta de Gemini, generar uno por defecto
                if (!aiResponseText.trim()) {
                    if (actionExecuted) {
                        aiResponseText = 'Procesando tu solicitud...'
                    } else {
                        // Fallback: generar respuesta simple sin function calling
                        const { generateAIResponse } = await import('@/lib/ai')
                        aiResponseText = await generateAIResponse(aiInputText, salesSystemPrompt)
                    }
                }

                // E. Decidir si respondemos con AUDIO o TEXTO
                const randomChance = Math.random() * 100
                const shouldSendAudio = randomChance <= (aiConfig.audio_probability || 0)

                // Importar helpers de envío
                const { sendWhatsAppMessage, sendWhatsAppAudio } = await import('@/lib/whatsapp')
                const { generateAudio } = await import('@/lib/ai')

                if (shouldSendAudio) {
                    // --- FLUJO DE RESPUESTA DE AUDIO ---
                    try {
                        const voiceId = aiConfig.audio_voice_id || 'es-US-Neural2-A';
                        const audioBase64 = await generateAudio(aiResponseText, voiceId);

                        if (audioBase64) {
                            const audioBuffer = Buffer.from(audioBase64, 'base64');
                            const fileName = `audio/${chatId}/${Date.now()}.mp3`;
                            const bucketName = 'audio-messages';

                            let { error: uploadError } = await supabaseAdmin.storage
                                .from(bucketName)
                                .upload(fileName, audioBuffer, {
                                    contentType: 'audio/mpeg',
                                    upsert: false
                                });

                            if (uploadError && uploadError.message.includes('bucket not found')) {
                                console.log("Bucket no encontrado, intentando crear...");
                                await supabaseAdmin.storage.createBucket(bucketName, { public: true });
                                const retry = await supabaseAdmin.storage.from(bucketName).upload(fileName, audioBuffer, { contentType: 'audio/mpeg' });
                                uploadError = retry.error;
                            }

                            if (uploadError) throw new Error(`Error subiendo audio: ${uploadError.message}`);

                            const { data: { publicUrl } } = supabaseAdmin.storage
                                .from(bucketName)
                                .getPublicUrl(fileName);

                            await sendWhatsAppAudio(phoneNumber, publicUrl, tenantToken, phoneId);
                        } else {
                            throw new Error('Fallo generación de audio (vacío)');
                        }
                    } catch (e) {
                        console.error("Error flujo audio:", e);
                        await sendWhatsAppMessage(phoneNumber, aiResponseText, tenantToken, phoneId)
                    }
                } else {
                    // --- FLUJO DE RESPUESTA DE TEXTO ---
                    await sendWhatsAppMessage(phoneNumber, aiResponseText, tenantToken, phoneId)
                }

                // Guardar mensaje de IA en DB
                if (chatId) {
                    await supabaseAdmin.from('messages').insert({
                        chat_id: chatId,
                        is_from_me: true,
                        content: aiResponseText,
                        status: 'delivered'
                    })

                    await supabaseAdmin.from('chats').update({
                        last_message: aiResponseText.substring(0, 100),
                        last_message_time: new Date().toISOString()
                    }).eq('id', chatId)
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
