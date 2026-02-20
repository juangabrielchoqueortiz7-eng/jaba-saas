
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

// Productos se cargan dinámicamente desde la DB para cada tenant

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
    // --- HELPER FUNCTIONS ---
    async function confirmOrder(productId: string, chatId: string, phoneNumber: string, contactName: string, tenantUserId: string) {
        // Cargar producto desde la DB
        const { data: product } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('user_id', tenantUserId)
            .single();

        if (!product) return { error: 'Producto no encontrado' };

        const { error: orderError } = await supabaseAdmin.from('orders').insert({
            user_id: tenantUserId,
            chat_id: chatId,
            phone_number: phoneNumber,
            contact_name: contactName,
            product: product.name,
            plan: productId,
            plan_name: product.name,
            amount: product.price,
            status: 'pending_email'
        });

        if (orderError) return { error: orderError.message };

        console.log(`[SALES] Pedido creado: ${product.name} (Bs ${product.price}) para ${contactName}`);

        // Log en el chat para visibilidad
        await supabaseAdmin.from('chats').update({
            last_message: `✅ Nuevo pedido: ${product.name} (Bs ${product.price})`
        }).eq('id', chatId);

        return { success: true, product };
    }

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
                const whatsappMessageId = messageObject.id // ID único del mensaje de WhatsApp

                // DEDUPLICACIÓN: Verificar si ya procesamos este mensaje
                if (whatsappMessageId) {
                    const { data: existingMsg } = await supabaseAdmin
                        .from('messages')
                        .select('id')
                        .eq('whatsapp_message_id', whatsappMessageId)
                        .maybeSingle()

                    if (existingMsg) {
                        console.log(`[Dedup] Mensaje ya procesado: ${whatsappMessageId}`)
                        return new NextResponse('ALREADY_PROCESSED', { status: 200 })
                    }
                }

                // Extract content based on message type
                let messageText: string
                let isReceipt = false

                switch (messageType) {
                    case 'text':
                        messageText = messageObject.text?.body || 'Mensaje sin texto'
                        break
                    case 'image':
                        messageText = messageObject.image?.caption || '📷 Imagen'
                        isReceipt = true // Cualquier imagen se evalúa como posible comprobante
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

                // --- 1. PROCESAR RESPUESTAS INTERACTIVAS (Botones/Listas) ---
                let interactiveData = null;
                if (messageType === 'interactive') {
                    const interactive = messageObject.interactive;
                    if (interactive.type === 'button_reply') {
                        interactiveData = { id: interactive.button_reply.id, title: interactive.button_reply.title };
                    } else if (interactive.type === 'list_reply') {
                        interactiveData = { id: interactive.list_reply.id, title: interactive.list_reply.title };
                    }
                }

                // 2. Buscar o Crear CHAT (Vinculado al Tenant)
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
                // Descargar imagen de WhatsApp si es tipo imagen
                let savedMediaUrl: string | null = null
                if (messageType === 'image' && messageObject.image?.id) {
                    try {
                        // Obtener URL temporal de la imagen de WhatsApp
                        const mediaResp = await fetch(
                            `https://graph.facebook.com/v21.0/${messageObject.image.id}`,
                            { headers: { Authorization: `Bearer ${tenantToken}` } }
                        )
                        const mediaData = await mediaResp.json()
                        if (mediaData.url) {
                            // Descargar la imagen
                            const imgResp = await fetch(mediaData.url, {
                                headers: { Authorization: `Bearer ${tenantToken}` }
                            })
                            const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
                            const fileName = `receipts/${chatId}/${Date.now()}.jpg`

                            // Subir a Supabase Storage
                            const { data: uploadData } = await supabaseAdmin.storage
                                .from('sales-assets')
                                .upload(fileName, imgBuffer, {
                                    contentType: 'image/jpeg',
                                    upsert: true
                                })

                            if (uploadData) {
                                const { data: publicUrl } = supabaseAdmin.storage
                                    .from('sales-assets')
                                    .getPublicUrl(fileName)
                                savedMediaUrl = publicUrl.publicUrl
                            }
                        }
                    } catch (imgErr) {
                        console.error('[Media] Error descargando imagen:', imgErr)
                    }
                }

                if (chatId) {
                    // Intentar guardar con media_url y whatsapp_message_id
                    const msgPayload: any = {
                        chat_id: chatId,
                        is_from_me: false,
                        content: messageText,
                        status: 'delivered'
                    }
                    if (savedMediaUrl) msgPayload.media_url = savedMediaUrl
                    if (whatsappMessageId) msgPayload.whatsapp_message_id = whatsappMessageId

                    const { error: msgError } = await supabaseAdmin.from('messages').insert(msgPayload)
                    if (msgError) {
                        // Si falla por columna inexistente, intentar con campos mínimos
                        console.warn("Error saving msg, retrying with basic fields:", msgError.message)
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: false,
                            content: messageText,
                            status: 'delivered'
                        })
                    }
                }

                // =================================================================================
                // 3. EVALUACIÓN DE DISPARADORES (TRIGGERS) 🚀
                // =================================================================================

                // IMPORTANTE: NO disparar triggers en respuestas interactivas (selección de lista/botón)
                // Esto evita el loop infinito donde "Plan Plata" re-dispara el trigger de "plan"
                const skipTriggers = messageType === 'interactive' || messageType === 'button'

                // Buscar disparadores activos para este usuario
                const { data: triggers } = !skipTriggers ? await supabaseAdmin
                    .from('triggers')
                    .select('*, trigger_conditions(*), trigger_actions(*)')
                    .eq('user_id', tenantUserId)
                    .eq('is_active', true) : { data: null }

                if (triggers && triggers.length > 0) {
                    for (const trigger of triggers) {
                        let matches = true;

                        // Evaluar condiciones
                        for (const cond of trigger.trigger_conditions) {
                            if (cond.type === 'contains_words') {
                                if (!messageText.toLowerCase().includes(cond.value.toLowerCase())) matches = false;
                            } else if (cond.type === 'equals') {
                                if (messageText.toLowerCase() !== cond.value.toLowerCase()) matches = false;
                            }
                            // Agregar más tipos de condiciones según sea necesario
                        }

                        if (matches && trigger.trigger_conditions.length > 0) {
                            console.log(`[Trigger] Activado: ${trigger.name}`);
                            const { sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppMessage } = await import('@/lib/whatsapp');

                            for (const action of trigger.trigger_actions) {
                                if (action.type === 'send_message') {
                                    // Si el payload tiene botones, enviamos botones, si no, texto plano
                                    if (action.payload.buttons) {
                                        await sendWhatsAppButtons(phoneNumber, action.payload.message, action.payload.buttons, tenantToken, phoneId);
                                    } else if (action.payload.sections) {
                                        await sendWhatsAppList(phoneNumber, action.payload.message, action.payload.buttonText || 'Ver opciones', action.payload.sections, tenantToken, phoneId);
                                    } else {
                                        await sendWhatsAppMessage(phoneNumber, action.payload.message, tenantToken, phoneId);
                                    }
                                }
                                // Implementar más acciones: update_status, add_tag, etc.
                            }

                            // Si se ejecutó un disparador, podemos decidir si queremos que la IA también responda o no.
                            // Por ahora, si hay un trigger exacto, detenemos el flujo hacia la IA.
                            return new NextResponse('EVENT_RECEIVED', { status: 200 });
                        }
                    }
                }

                // --- PROCESAR SELECCIÓN DE PRODUCTO (INTERACTIVO) ---
                if (interactiveData && interactiveData.id.startsWith('product_')) {
                    const productId = interactiveData.id.replace('product_', '');
                    console.log(`[Sales] Producto seleccionado vía interactivo: ${productId}`);

                    const result = await confirmOrder(productId, chatId, phoneNumber, contactName, tenantUserId);

                    if (result.success && result.product) {
                        const { sendWhatsAppMessage } = await import('@/lib/whatsapp');
                        let responseText = `¡Excelente elección! Has seleccionado *${result.product.name}* (Bs ${result.product.price}).\n\n`;
                        responseText += `Para continuar, por favor *escríbeme tu correo electrónico*:`;

                        await sendWhatsAppMessage(phoneNumber, responseText, tenantToken, phoneId);

                        // Guardar en mensajes
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: true,
                            content: responseText,
                            status: 'delivered'
                        });

                        return new NextResponse('EVENT_RECEIVED', { status: 200 });
                    }
                }

                // --- PROCESAR COMPROBANTE DE PAGO ---
                if (isReceipt && chatId) {
                    console.log(`[Sales] Posible comprobante detectado de ${phoneNumber}`);

                    // Buscar pedido activo con status pending_payment
                    const { data: activeOrder } = await supabaseAdmin
                        .from('orders')
                        .select('*')
                        .eq('chat_id', chatId)
                        .eq('status', 'pending_payment')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (activeOrder) {
                        // Verificar que la imagen sea reciente (de hoy)
                        const now = new Date()
                        const boliviaOffset = -4 * 60 // UTC-4
                        const boliviaTime = new Date(now.getTime() + (now.getTimezoneOffset() + boliviaOffset) * 60000)
                        const todayStr = boliviaTime.toISOString().split('T')[0]

                        console.log(`[Sales] Comprobante recibido. Fecha actual (Bolivia): ${todayStr}`);

                        await supabaseAdmin.from('orders').update({
                            status: 'pending_delivery',
                            updated_at: new Date().toISOString(),
                            metadata: {
                                ...(activeOrder.metadata || {}),
                                receipt_image_url: savedMediaUrl,
                                receipt_date: todayStr,
                                receipt_time: boliviaTime.toTimeString().slice(0, 8)
                            }
                        }).eq('id', activeOrder.id);

                        const { sendWhatsAppMessage } = await import('@/lib/whatsapp');
                        const confirmationMsg = `✅ *¡Comprobante recibido!*\n\nEstamos verificando tu pago para el *${activeOrder.plan_name || activeOrder.product}* (Bs ${activeOrder.amount}).\n\nEn breve recibirás el acceso en tu correo electrónico: *${activeOrder.customer_email || '(no registrado)'}*\n\n¡Gracias por tu preferencia! 🙌`;

                        await sendWhatsAppMessage(phoneNumber, confirmationMsg, tenantToken, phoneId);

                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: true,
                            content: confirmationMsg,
                            status: 'delivered'
                        });

                        return new NextResponse('EVENT_RECEIVED', { status: 200 });
                    }
                    // Si no hay pedido pending_payment, dejamos que la IA maneje (no es comprobante relevante)
                }

                // =================================================================================
                // 3. CEREBRO IA (GEMINI) - AQUÍ OCURRE LA MAGIA 🧠✨
                // =================================================================================

                // Solo respondemos con IA a mensajes de TEXTO, AUDIO y ahora INTERACTIVO (si no fue capturado arriba)
                if (messageType !== 'text' && messageType !== 'audio' && messageType !== 'interactive') {
                    console.log(`[AI] Skipping AI response for message type: ${messageType}`)
                    return new NextResponse('EVENT_RECEIVED', { status: 200 })
                }

                // A. Buscar configuración del Asistente del Tenant (incluye training_prompt)
                const { data: aiConfig } = await supabaseAdmin
                    .from('whatsapp_credentials')
                    .select('ai_status, bot_name, welcome_message, response_delay_seconds, audio_probability, message_delivery_mode, use_emojis, audio_voice_id, reply_audio_with_audio, training_prompt')
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

                // Catálogo de planes (Movido a nivel global)

                // Buscar historial de mensajes recientes para contexto
                const { data: recentMessages } = await supabaseAdmin
                    .from('messages')
                    .select('content, is_from_me, created_at')
                    .eq('chat_id', chatId)
                    .order('created_at', { ascending: false })
                    .limit(10)

                const chatHistory = (recentMessages || [])
                    .reverse()
                    .map(m => `${m.is_from_me ? 'Tú' : 'Cliente'}: ${m.content}`)
                    .join('\n')

                // AUTO-CANCELAR pedidos viejos (más de 1 hora sin completar)
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
                await supabaseAdmin
                    .from('orders')
                    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                    .eq('chat_id', chatId)
                    .in('status', ['pending_email', 'pending_payment'])
                    .lt('created_at', oneHourAgo)

                // Buscar pedido ACTIVO reciente (solo los de la última hora)
                const { data: activeOrder } = await supabaseAdmin
                    .from('orders')
                    .select('*')
                    .eq('chat_id', chatId)
                    .in('status', ['pending_email', 'pending_payment'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                // Cargar catálogo de productos del tenant
                const { data: tenantProducts } = await supabaseAdmin
                    .from('products')
                    .select('id, name, description, price, category')
                    .eq('user_id', tenantUserId)
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true })

                // Contexto del pedido activo (solo si existe)
                let orderContext = ''
                if (activeOrder) {
                    if (activeOrder.status === 'pending_email') {
                        orderContext = `\n[PEDIDO ACTIVO] El cliente eligió "${activeOrder.plan_name}" (Bs ${activeOrder.amount}) pero AÚN NO dio su email. Tu tarea: PEDIR su correo electrónico.`
                    } else if (activeOrder.status === 'pending_payment') {
                        orderContext = `\n[PEDIDO ACTIVO] El cliente ya proporcionó su email (${activeOrder.customer_email}) y se le envió el QR de pago para "${activeOrder.plan_name}" (Bs ${activeOrder.amount}). Tu tarea: Recordarle amablemente que envíe la foto del comprobante de pago.`
                    }
                }

                // Construir system prompt de SUPER VENTAS
                const planList = (tenantProducts || []).map((p, i) =>
                    `${i + 1}. *${p.name}* — *Bs ${p.price}*${p.description ? ' (' + p.description + ')' : ''}`
                ).join('\n')
                const idMapping = (tenantProducts || []).map(p =>
                    `"${p.name}" = "${p.id}"`
                ).join('\n')

                const salesSystemPrompt = `Eres el Asistente de Ventas Senior de JABA Marketing Digital por WhatsApp.
Tu único objetivo es cerrar ventas de suscripciones Canva Pro y ofrecer servicios de diseño.
No eres solo un informante; eres un vendedor que usa escasez, urgencia y reciprocidad.

PLANES CANVA PRO:
${planList}

Beneficios Clave: Estudio Mágico (IA), Kit de Marca, Quitar fondos, Programación de contenido, 100M+ fotos/videos premium.
Garantía: Soporte 24/7 y seguridad total.

FLUJO DE VENTA:
1. BIENVENIDA: "¡Hola! Bienvenido a JABA Marketing Digital. 👋 ¿Estás listo para llevar tus diseños al nivel profesional con Canva Pro?"
2. PRESENTAR PLANES: Cuando pregunte, presenta los planes. Después: "¿Cuál se adapta mejor a tus proyectos hoy?" + "Aprovecha, solo nos quedan pocos cupos con este precio promocional 🇧🇴"
3. CONFIRMAR: Cuando elija un plan, usa la herramienta confirm_plan. Después pide el correo electrónico.
4. EMAIL: Cuando dé su email, usa la herramienta process_email. El sistema envía el QR automáticamente.
5. PAGO: "Una vez realizado el pago, envíame la foto del comprobante."

SERVICIOS ADICIONALES: Diseño de Posts para redes, Invitaciones Digitales profesionales.

IDs INTERNOS (NUNCA mostrar):
${idMapping}

REGLAS:
- Máximo 3-4 líneas por respuesta.
- Usa *negritas* para precios y beneficios. Máximo 2 emojis por mensaje.
- NUNCA muestres IDs ni generes código.
- Si dice un número (1-5), identifica el plan correspondiente y confírmalo.
- "Quiero otra cuenta" = nueva venta independiente.
${orderContext}

CONVERSACIÓN:
${chatHistory}`

                // Function declarations para Gemini
                const salesFunctions: any = [
                    {
                        name: 'confirm_plan',
                        description: 'Confirmar la compra de un plan. Usar cuando el cliente elige un plan por nombre o número.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                plan_id: {
                                    type: SchemaType.STRING,
                                    description: 'UUID del producto elegido'
                                }
                            },
                            required: ['plan_id']
                        }
                    },
                    {
                        name: 'process_email',
                        description: 'Registrar email del cliente y enviar QR de pago. Usar cuando el cliente da un correo electrónico.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                email: {
                                    type: SchemaType.STRING,
                                    description: 'Email del cliente'
                                }
                            },
                            required: ['email']
                        }
                    }
                ]

                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.0-flash',
                    tools: [{ functionDeclarations: salesFunctions }],
                    toolConfig: { functionCallingConfig: { mode: 'AUTO' as any } },
                    systemInstruction: salesSystemPrompt
                })

                // D. Preparar mensaje para Gemini (transcribir audio si es necesario)
                let aiInputText = messageText

                if (messageType === 'audio' && messageObject.audio?.id) {
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

                            const audioModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
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
                        { role: 'user', parts: [{ text: aiInputText }] }
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
                        // FILTRAR: Nunca enviar código al cliente
                        let cleanText = part.text
                        cleanText = cleanText.replace(/```[\s\S]*?```/g, '')
                        cleanText = cleanText.replace(/`[^`]+`/g, '')
                        cleanText = cleanText.replace(/^.*(?:def |import |print\(|if .*==|return\b|\.insert|\.update|\.select|tool_code|confirm_plan|process_email|function|=>).*$/gm, '')
                        cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim()
                        if (cleanText) aiResponseText += cleanText
                    }

                    if (part.functionCall) {
                        const { name, args } = part.functionCall
                        const callArgs = args as any
                        console.log(`[SALES] Function call REAL: ${name}`, JSON.stringify(callArgs))

                        if (name === 'confirm_plan' && callArgs?.plan_id) {
                            const productId = callArgs.plan_id as string
                            const result = await confirmOrder(productId, chatId, phoneNumber, contactName, tenantUserId);
                            if (result.success && result.product) {
                                actionExecuted = true;
                                if (!aiResponseText.trim()) {
                                    aiResponseText = `¡Excelente elección! 🚀 Has seleccionado el *${result.product.name}* por *Bs ${result.product.price}*.

Para activar tu cuenta, necesito tu *correo electrónico*. El acceso se envía directamente a tu email. 📧`
                                }
                            } else if (result.success) {
                                actionExecuted = true;
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
                                    // Actualizar pedido con email y cambiar status a ESPERANDO PAGO
                                    await supabaseAdmin.from('orders').update({
                                        customer_email: email,
                                        status: 'pending_payment',
                                        updated_at: new Date().toISOString()
                                    }).eq('id', pendingOrder.id)

                                    console.log(`[SALES] Email registrado: ${email} para pedido ${pendingOrder.id}`)
                                    // DEBUG: Marcar éxito en chat
                                    await supabaseAdmin.from('chats').update({
                                        last_message: `✅ Email vinculado: ${email}`
                                    }).eq('id', chatId)

                                    // Enviar QR de pago (buscar desde el producto)
                                    const { data: orderProduct } = await supabaseAdmin
                                        .from('products')
                                        .select('name, price, qr_image_url')
                                        .eq('id', pendingOrder.plan)
                                        .maybeSingle()

                                    if (orderProduct?.qr_image_url) {
                                        try {
                                            const { sendWhatsAppImage } = await import('@/lib/whatsapp')

                                            await sendWhatsAppImage(
                                                phoneNumber,
                                                orderProduct.qr_image_url,
                                                `💳 QR de pago - ${orderProduct.name}\nMonto: Bs ${orderProduct.price}\n\nRealiza tu pago y envíame la foto del comprobante 📸`,
                                                tenantToken,
                                                phoneId
                                            )
                                            console.log(`[SALES] QR enviado para producto: ${orderProduct.name}`)

                                            // Guardar mensaje de imagen QR en DB
                                            const qrMsgPayload: any = {
                                                chat_id: chatId,
                                                is_from_me: true,
                                                content: `💳 QR de pago - ${orderProduct.name} (Bs ${orderProduct.price})`,
                                                status: 'delivered'
                                            }
                                            try {
                                                qrMsgPayload.media_url = orderProduct.qr_image_url
                                                await supabaseAdmin.from('messages').insert(qrMsgPayload)
                                            } catch {
                                                delete qrMsgPayload.media_url
                                                await supabaseAdmin.from('messages').insert(qrMsgPayload)
                                            }
                                        } catch (qrError) {
                                            console.error('[SALES] Error enviando QR:', qrError)
                                        }
                                    }

                                    actionExecuted = true
                                    if (!aiResponseText.trim()) {
                                        aiResponseText = `✅ ¡Perfecto! He enviado el *QR de pago* para tu *${orderProduct?.name || pendingOrder.plan_name}*.\n\nUna vez realices el pago, envíame la foto del comprobante. Tu acceso se activará en *${email}*. 📧`
                                    }
                                } else {
                                    console.log('[SALES] Email recibido pero no hay pedido activo')
                                }
                            }
                        }
                    }
                }

                // Fallback si no hay respuesta
                if (!aiResponseText.trim()) {
                    if (actionExecuted) {
                        aiResponseText = '¡Listo! Tu solicitud ha sido procesada. ¿Necesitas algo más? 😊'
                    } else {
                        aiResponseText = '¡Hola! 👋 Bienvenido a JABA Marketing Digital. ¿En qué puedo ayudarte hoy?'
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
