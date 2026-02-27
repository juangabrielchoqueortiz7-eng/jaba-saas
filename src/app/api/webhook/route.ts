
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

// --- GLOBAL MESSAGE BUFFER ---
// Para evitar saturar a la IA si el cliente envía 5 mensajes seguidos
interface BufferedMessage {
    text: string;
    timer: NodeJS.Timeout | null;
}
const messageBuffer = new Map<string, BufferedMessage>();
// -----------------------------

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

                // --- 0. ENVIAR INDICADOR DE "ESCRIBIENDO..." ---
                try {
                    const { sendWhatsAppTyping } = await import('@/lib/whatsapp');
                    // Lo disparamos sin awaiterlo mucho para que no bloquee, o con un await rápido
                    await sendWhatsAppTyping(phoneNumber, tenantToken, phoneId);
                } catch (typingErr) {
                    console.error("[Typing Indicator] Error:", typingErr);
                }

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

                let chatId: string = '';

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
                // Descargar CUALQUIER media de WhatsApp (imagen, audio, video, documento)
                let savedMediaUrl: string | null = null
                let savedMediaType: string | null = null

                const mediaHandlers: Record<string, { id?: string, mime?: string }> = {
                    image: { id: messageObject.image?.id, mime: messageObject.image?.mime_type },
                    audio: { id: messageObject.audio?.id, mime: messageObject.audio?.mime_type },
                    video: { id: messageObject.video?.id, mime: messageObject.video?.mime_type },
                    document: { id: messageObject.document?.id, mime: messageObject.document?.mime_type },
                    sticker: { id: messageObject.sticker?.id, mime: messageObject.sticker?.mime_type },
                }

                const currentMediaHandler = mediaHandlers[messageType]
                if (currentMediaHandler?.id) {
                    try {
                        const mediaResp = await fetch(
                            `https://graph.facebook.com/v21.0/${currentMediaHandler.id}`,
                            { headers: { Authorization: `Bearer ${tenantToken}` } }
                        )
                        const mediaData = await mediaResp.json()
                        if (mediaData.url) {
                            const fileResp = await fetch(mediaData.url, {
                                headers: { Authorization: `Bearer ${tenantToken}` }
                            })
                            const fileBuffer = Buffer.from(await fileResp.arrayBuffer())

                            // Determinar extensión y carpeta
                            const extMap: Record<string, string> = {
                                image: 'jpg', audio: 'ogg', video: 'mp4',
                                document: messageObject.document?.filename?.split('.').pop() || 'pdf',
                                sticker: 'webp'
                            }
                            const contentTypeMap: Record<string, string> = {
                                image: 'image/jpeg', audio: 'audio/ogg', video: 'video/mp4',
                                document: currentMediaHandler.mime || 'application/octet-stream',
                                sticker: 'image/webp'
                            }

                            const ext = extMap[messageType] || 'bin'
                            const folder = messageType === 'image' ? 'receipts' : `media/${messageType}`
                            const fileName = `${folder}/${chatId}/${Date.now()}.${ext}`

                            const { data: uploadData } = await supabaseAdmin.storage
                                .from('sales-assets')
                                .upload(fileName, fileBuffer, {
                                    contentType: contentTypeMap[messageType] || 'application/octet-stream',
                                    upsert: true
                                })

                            if (uploadData) {
                                const { data: publicUrl } = supabaseAdmin.storage
                                    .from('sales-assets')
                                    .getPublicUrl(fileName)
                                savedMediaUrl = publicUrl.publicUrl
                                savedMediaType = messageType === 'sticker' ? 'image' : messageType
                                console.log(`[Media] ${messageType} guardado: ${savedMediaUrl}`)
                            }
                        }
                    } catch (mediaErr) {
                        console.error(`[Media] Error descargando ${messageType}:`, mediaErr)
                    }
                }

                if (chatId) {
                    const msgPayload: any = {
                        chat_id: chatId,
                        is_from_me: false,
                        content: messageText,
                        status: 'delivered'
                    }
                    if (savedMediaUrl) msgPayload.media_url = savedMediaUrl
                    if (savedMediaType) msgPayload.media_type = savedMediaType
                    if (whatsappMessageId) msgPayload.whatsapp_message_id = whatsappMessageId

                    const { error: msgError } = await supabaseAdmin.from('messages').insert(msgPayload)
                    if (msgError) {
                        console.warn("Error saving msg, retrying with basic fields:", msgError.message)
                        // Retry sin media_type por si la columna no existe aún
                        const fallbackPayload: any = {
                            chat_id: chatId,
                            is_from_me: false,
                            content: messageText,
                            status: 'delivered'
                        }
                        if (savedMediaUrl) fallbackPayload.media_url = savedMediaUrl
                        if (whatsappMessageId) fallbackPayload.whatsapp_message_id = whatsappMessageId
                        await supabaseAdmin.from('messages').insert(fallbackPayload)
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

                // --- PROCESAR RENOVACIÓN DE SUSCRIPCIÓN (renew_plan_) ---
                if (interactiveData && interactiveData.id.startsWith('renew_plan_')) {
                    const productId = interactiveData.id.replace('renew_plan_', '');
                    console.log(`[Renewal] Plan de renovación seleccionado: ${productId}`);

                    // Buscar producto
                    const { data: product } = await supabaseAdmin
                        .from('products')
                        .select('*')
                        .eq('id', productId)
                        .eq('user_id', tenantUserId)
                        .single();

                    if (!product) {
                        console.error('[Renewal] Product not found:', productId);
                        return new NextResponse('EVENT_RECEIVED', { status: 200 });
                    }

                    // Buscar suscripción existente del cliente por número de teléfono
                    const cleanPhone = phoneNumber.replace(/^591/, '');
                    const { data: subscription } = await supabaseAdmin
                        .from('subscriptions')
                        .select('*')
                        .eq('user_id', tenantUserId)
                        .eq('estado', 'ACTIVO')
                        .or(`numero.eq.${phoneNumber},numero.eq.${cleanPhone}`)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    // Usar email de la suscripción existente (sin preguntar)
                    const customerEmail = subscription?.correo || '';

                    // Crear order tipo renewal
                    const { error: orderError } = await supabaseAdmin.from('orders').insert({
                        user_id: tenantUserId,
                        chat_id: chatId,
                        phone_number: phoneNumber,
                        contact_name: contactName,
                        product: 'renewal',
                        plan: productId,
                        plan_name: product.name,
                        amount: product.price,
                        customer_email: customerEmail,
                        equipo: subscription?.equipo || '',
                        status: 'pending_payment'
                    });

                    if (orderError) {
                        console.error('[Renewal] Error creating order:', orderError);
                        return new NextResponse('EVENT_RECEIVED', { status: 200 });
                    }

                    console.log(`[Renewal] Orden creada: ${product.name} (Bs ${product.price}) para ${customerEmail || phoneNumber}`);

                    // Enviar QR de pago directamente (sin pedir email)
                    const { sendWhatsAppMessage, sendWhatsAppImage } = await import('@/lib/whatsapp');

                    const renewMsg = `✅ *¡Plan seleccionado!*\n\n` +
                        `Has elegido *${product.name}* (Bs ${product.price}) para renovar tu cuenta *${customerEmail}*.\n\n` +
                        `💳 Realiza el pago con el siguiente QR y envíanos la foto del comprobante por este medio:`;

                    await sendWhatsAppMessage(phoneNumber, renewMsg, tenantToken, phoneId);

                    // Enviar QR de pago si existe
                    if (product.qr_image_url) {
                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com';
                        const qrUrl = product.qr_image_url.startsWith('http') ? product.qr_image_url : `${baseUrl}${product.qr_image_url}`;
                        await sendWhatsAppImage(phoneNumber, qrUrl, `QR de pago - ${product.name} (Bs ${product.price})`, tenantToken, phoneId);
                    }

                    await supabaseAdmin.from('messages').insert({
                        chat_id: chatId,
                        is_from_me: true,
                        content: renewMsg,
                        status: 'delivered'
                    });

                    return new NextResponse('EVENT_RECEIVED', { status: 200 });
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

                        // AGREGAR ANÁLISIS DEL COMPROBANTE CON GEMINI
                        let extractedAmount: number | null = null;
                        try {
                            if (savedMediaUrl && process.env.GOOGLE_API_KEY) {
                                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

                                const imageResp = await fetch(savedMediaUrl);
                                const imageBuf = await imageResp.arrayBuffer();
                                const base64Image = Buffer.from(imageBuf).toString('base64');

                                const validationModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
                                const prompt = `Analiza detalladamente este comprobante de pago bancario de Bolivia (Qr, Yape, Transferencia).
Tu ÚNICO objetivo es decirme cuál es el MONTO TOTAL PAGADO en números.

Sigue estas reglas ESTRICTAS:
1. IGNORA la hora (ej. 16:35 no es 16.35, es la hora).
2. IGNORA la fecha y los números de transacción/cuenta largos.
3. Busca textos como "Monto", "Monto Pagado", "Bs", "Bs." o números grandes destacados (ej. "Bs 150", "Bs 39").
4. Solo responde con el número del monto pagado (ej. 150.00). NO devuelvas ningún otro texto, ni letras, ni símbolos. SOLO EL NÚMERO.
Si la imagen está borrosa o no encuentras ningún monto válido, responde "0".`;

                                const validationResult = await validationModel.generateContent([
                                    prompt,
                                    {
                                        inlineData: {
                                            data: base64Image,
                                            mimeType: 'image/jpeg'
                                        }
                                    }
                                ]);

                                const textResp = validationResult.response.text().trim();
                                const amountMatch = textResp.match(/\d+(?:[.,]\d+)?/);
                                if (amountMatch) {
                                    extractedAmount = parseFloat(amountMatch[0].replace(',', '.'));
                                }
                                console.log(`[Sales] Monto extraído en texto: '${textResp}' -> Parseado: ${extractedAmount} (esperado: ${activeOrder.amount})`);
                            }
                        } catch (aiError) {
                            console.error("[Sales] Error validando recibo con IA:", aiError);
                        }

                        if (extractedAmount !== null && extractedAmount < activeOrder.amount) {
                            const { sendWhatsAppMessage } = await import('@/lib/whatsapp');
                            const warningMsg = `⚠️ *Monto Incorrecto*\n\nGracias por enviar el comprobante, pero el sistema detecta que el pago indica *Bs ${extractedAmount}*, mientras que el *${activeOrder.plan_name || activeOrder.product}* tiene un costo de *Bs ${activeOrder.amount}*.\n\nPor favor, revisa el pago o si subiste la captura correcta. Tu pedido sigue en espera.`;
                            await sendWhatsAppMessage(phoneNumber, warningMsg, tenantToken, phoneId);

                            await supabaseAdmin.from('messages').insert({
                                chat_id: chatId,
                                is_from_me: true,
                                content: warningMsg,
                                status: 'delivered'
                            });

                            return new NextResponse('EVENT_RECEIVED', { status: 200 });
                        }

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

                        // --- RENOVACIÓN AUTOMÁTICA ---
                        if (activeOrder.product === 'renewal') {
                            console.log(`[Renewal] Processing auto-renewal for ${phoneNumber}`);

                            // Calcular nueva fecha de vencimiento
                            const today = new Date();
                            const planName = (activeOrder.plan_name || '').toLowerCase();
                            let monthsToAdd = 1;
                            if (planName.includes('3 mes') || planName.includes('trimestral') || planName.includes('bronce')) monthsToAdd = 3;
                            else if (planName.includes('6 mes') || planName.includes('semestral') || planName.includes('plata')) monthsToAdd = 6;
                            else if (planName.includes('9 mes') || planName.includes('oro')) monthsToAdd = 9;
                            else if (planName.includes('1 año') || planName.includes('anual') || planName.includes('premium')) monthsToAdd = 12;

                            const newExpDate = new Date(today);
                            newExpDate.setMonth(newExpDate.getMonth() + monthsToAdd);
                            const newExpStr = `${String(newExpDate.getDate()).padStart(2, '0')}/${String(newExpDate.getMonth() + 1).padStart(2, '0')}/${newExpDate.getFullYear()}`;

                            // Buscar suscripción del cliente
                            const cleanPhone = phoneNumber.replace(/^591/, '');
                            const { data: sub } = await supabaseAdmin
                                .from('subscriptions')
                                .select('*')
                                .eq('user_id', tenantUserId)
                                .or(`numero.eq.${phoneNumber},numero.eq.${cleanPhone}`)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();

                            const oldExpiration = sub?.vencimiento || 'N/A';

                            if (sub) {
                                // Auto-actualizar suscripción
                                await supabaseAdmin
                                    .from('subscriptions')
                                    .update({
                                        vencimiento: newExpStr,
                                        notified: false,
                                        notified_at: null,
                                        followup_sent: false
                                    })
                                    .eq('id', sub.id);

                                console.log(`[Renewal] ✅ Suscripción ${sub.id} actualizada: ${oldExpiration} → ${newExpStr}`);
                            }

                            // Crear registro de renovación
                            const triggeredBy = sub?.followup_sent ? 'followup' : 'reminder';
                            await supabaseAdmin.from('subscription_renewals').insert({
                                user_id: tenantUserId,
                                subscription_id: sub?.id || null,
                                order_id: activeOrder.id,
                                chat_id: chatId,
                                phone_number: phoneNumber,
                                customer_email: activeOrder.customer_email || sub?.correo || '',
                                plan_name: activeOrder.plan_name,
                                amount: activeOrder.amount,
                                old_expiration: oldExpiration,
                                new_expiration: newExpStr,
                                receipt_url: savedMediaUrl,
                                triggered_by: triggeredBy,
                                status: 'pending_review'
                            });

                            // Log
                            await supabaseAdmin.from('subscription_notification_logs').insert({
                                user_id: tenantUserId,
                                subscription_id: sub?.id || null,
                                phone_number: phoneNumber,
                                message_type: 'confirmation',
                                status: 'sent'
                            });

                            // Mensaje profesional de confirmación
                            const confirmMsg = `✅ *¡Renovación exitosa!* 🎉\n\nGracias por continuar confiando en nosotros. Tu cuenta *${activeOrder.customer_email || sub?.correo || ''}* de Canva Pro ha sido renovada con éxito.\n\n📋 *Detalle de tu renovación:*\n• Plan: ${activeOrder.plan_name}\n• Vigencia hasta: *${newExpStr}*\n• Equipo: ${activeOrder.equipo || sub?.equipo || ''}\n\nTodos tus diseños, plantillas y proyectos siguen intactos y disponibles para ti. 🎨\n\nSi tienes alguna consulta, estamos aquí para ayudarte.\n*¡Sigue creando cosas increíbles!* ✨`;

                            await sendWhatsAppMessage(phoneNumber, confirmMsg, tenantToken, phoneId);

                            await supabaseAdmin.from('messages').insert({
                                chat_id: chatId,
                                is_from_me: true,
                                content: confirmMsg,
                                status: 'delivered'
                            });

                            return new NextResponse('EVENT_RECEIVED', { status: 200 });
                        }

                        // --- FLUJO NORMAL (no renovación) ---
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

                // =================================================================================
                // 3.1 MESSAGE BUFFERING (Espera 10s por si escriben en partes)
                // =================================================================================

                // Responder inmediatamente a Meta para que no reintente
                // Iniciaremos la IA de fondo (pero cuidado con los timeouts de Vercel de 10-15s en plan Hobby)
                // Para Vercel Hobby, un timeout de 8-10s es arriesgado porque la función se apaga. 
                // Usaremos 5 segundos seguros para concadenar mensajes rápidos.

                const bufferKey = `${tenantUserId}_${chatId}`;
                let currentBuffer = messageBuffer.get(bufferKey);

                if (currentBuffer) {
                    // Si ya había mensajes, limpiamos el timer viejo y concatenamos
                    if (currentBuffer.timer) clearTimeout(currentBuffer.timer);
                    currentBuffer.text += `\n${messageText}`;
                } else {
                    // Crear nuevo buffer
                    currentBuffer = { text: messageText, timer: null };
                }

                // Asignamos el nuevo buffer al map
                messageBuffer.set(bufferKey, currentBuffer);

                // Promisify the AI process to still return a NextResponse *after* processing or backgrounding
                // In serverless, background processes might be killed, so we must `await` the timeout to ensure execution.
                console.log(`[Buffer] Mensaje de ${phoneNumber} pausado por 6s para juntar más texto... (Actual: "${currentBuffer.text.replace(/\n/g, ' ')}")`)

                await new Promise(resolve => {
                    const timer = setTimeout(async () => {
                        // Al expirar el tiempo, procesamos el buffer acumulado
                        const finalBuffer = messageBuffer.get(bufferKey);
                        messageBuffer.delete(bufferKey); // Limpiar buffer

                        if (!finalBuffer) {
                            resolve(true);
                            return;
                        }

                        const finalMessageText = finalBuffer.text;
                        console.log(`[Buffer] Ejecutando IA para ${phoneNumber} con texto consolidado: "${finalMessageText.replace(/\n/g, ' ')}"`)

                        try {
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

                            // ====== DETECTAR CLIENTE EXISTENTE (Suscripción) ======
                            const cleanPhoneForLookup = phoneNumber.replace(/^591/, '');
                            const { data: existingSub } = await supabaseAdmin
                                .from('subscriptions')
                                .select('correo, vencimiento, estado, equipo')
                                .eq('user_id', tenantUserId)
                                .or(`numero.eq.${phoneNumber},numero.eq.${cleanPhoneForLookup}`)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();

                            let subscriberContext = '';
                            if (existingSub) {
                                console.log(`[AI] Cliente EXISTENTE detectado: ${phoneNumber} → correo: ${existingSub.correo}, estado: ${existingSub.estado}`);
                                subscriberContext = `\n[CLIENTE EXISTENTE] Este cliente YA está en nuestra base de datos.
- Correo registrado: ${existingSub.correo}
- Estado de su suscripción: ${existingSub.estado}
- Vencimiento: ${existingSub.vencimiento}
- Equipo: ${existingSub.equipo || 'N/A'}
INSTRUCCIÓN: NO le pidas correo electrónico, ya lo tenemos. Si quiere renovar o comprar otro plan, usa directamente su correo "${existingSub.correo}" con la herramienta "process_email".`;

                                // Si hay un pedido pending_email y ya tenemos el correo, auto-procesarlo
                                if (activeOrder && activeOrder.status === 'pending_email' && existingSub.correo) {
                                    console.log(`[AI] Auto-procesando email para cliente existente: ${existingSub.correo}`);
                                    // Actualizar el pedido directamente con el correo conocido
                                    await supabaseAdmin.from('orders').update({
                                        customer_email: existingSub.correo,
                                        status: 'pending_payment',
                                        updated_at: new Date().toISOString()
                                    }).eq('id', activeOrder.id);

                                    // Enviar QR de pago automáticamente
                                    const { data: orderProduct } = await supabaseAdmin
                                        .from('products')
                                        .select('qr_image_url')
                                        .eq('id', activeOrder.plan)
                                        .single();

                                    if (orderProduct?.qr_image_url) {
                                        const { sendWhatsAppImage } = await import('@/lib/whatsapp');
                                        await sendWhatsAppImage(
                                            phoneNumber,
                                            orderProduct.qr_image_url,
                                            `📱 *QR de Pago*\n\nPlan: *${activeOrder.plan_name}*\nMonto: *Bs ${activeOrder.amount}*\n\nEscanea este QR para realizar el pago. Una vez hecho, envíame la foto del comprobante. ✅`,
                                            tenantToken,
                                            phoneId
                                        );
                                    }

                                    // Actualizar activeOrder en memoria para el prompt
                                    activeOrder.status = 'pending_payment';
                                    activeOrder.customer_email = existingSub.correo;
                                }
                            }

                            // Contexto del pedido activo (solo si existe)
                            let orderContext = ''
                            if (activeOrder) {
                                if (activeOrder.status === 'pending_email') {
                                    if (existingSub?.correo) {
                                        // Cliente existente: no pedir correo, usamos el que ya tenemos
                                        orderContext = `\n[PEDIDO ACTIVO] El cliente eligió "${activeOrder.plan_name}" (Bs ${activeOrder.amount}). Este cliente YA tiene correo registrado: ${existingSub.correo}. Ejecuta "process_email" con ese correo INMEDIATAMENTE sin preguntarle.`
                                    } else {
                                        orderContext = `\n[PEDIDO ACTIVO] El cliente eligió "${activeOrder.plan_name}" (Bs ${activeOrder.amount}). \nTu tarea: SI el cliente acaba de enviar un correo electrónico válido, DEBES ejecutar la herramienta "process_email" con ese correo. \nDe lo contrario, recuérdale amable y brevemente que necesitas su correo electrónico para enviarle el acceso.`
                                    }
                                } else if (activeOrder.status === 'pending_payment') {
                                    orderContext = `\n[PEDIDO ACTIVO] El cliente ya proporcionó su email (${activeOrder.customer_email}) y ya se le envió el QR de pago para "${activeOrder.plan_name}" (Bs ${activeOrder.amount}). Tu tarea: Recordarle amablemente que envíe la foto del comprobante de pago por este medio, no ofrezcas planes.`
                                }
                            }

                            // Construir system prompt de SUPER VENTAS
                            const planList = (tenantProducts || []).map((p, i) =>
                                `${i + 1}. *${p.name}* — *Bs ${p.price}*${p.description ? ' (' + p.description + ')' : ''}`
                            ).join('\n')
                            const idMapping = (tenantProducts || []).map(p =>
                                `"${p.name}" = "${p.id}"`
                            ).join('\n')

                            // Instrucciones personalizadas del Usuario
                            const customTrainingSection = aiConfig.training_prompt ? `
=============================================
🧠 ENTRENAMIENTO PERSONALIZADO DEL NEGOCIO:
(Debes seguir estas reglas de personalidad, tono y respuestas por encima de todo):
${aiConfig.training_prompt}
=============================================
` : '';

                            const salesSystemPrompt = `Eres el Asistente de Ventas Oficial del negocio.

INFORMACIÓN INTERNA DE CATÁLOGO (Solo ofrécelo si el cliente muestra verdadero interés de compra o pregunta por precios/servicios):
PLANES DISPONIBLES:
${planList}

MÉTODOS DE PAGO: QR bancario (BancoSol, Banco Unión, BNB, Tigo Money)

SERVICIOS INTEGRADOS:
1. "send_welcome_menu": Una herramienta interactiva que envía un catálogo visual de los planes por WhatsApp. ÚSALA ÚNICAMENTE cuando el cliente explícitamente diga que quiere ver los planes, precios, o esté listo para comprar un paquete. NO la uses para saludar.
2. "confirm_plan": Usa esta herramienta cuando el cliente elija claramente un plan de la lista para proceder con el pago.
3. "process_email": Ejecútala de inmediato en cuanto el cliente te escriba su correo electrónico válido.

IDs INTERNOS (NUNCA mostrar al cliente):
${idMapping}

REGLAS GLOBALES ESTRICTAS:
- Máximo 2 emojis por mensaje.
- NUNCA muestres IDs, UUIDs ni generes código.
${subscriberContext}
${orderContext}

HISTORIAL (para que sepas en qué parte del flujo estás):
${chatHistory}

${customTrainingSection}`

                            const salesFunctions: any = [
                                {
                                    name: 'send_welcome_menu',
                                    description: 'Enviar el catálogo principal de planes interactivo por WhatsApp. Úsalo ÚNICAMENTE cuando el cliente pida ver los planes, precios, paquetes o servicios. NUNCA lo uses automáticamente en el primer saludo si el cliente solo dice "Hola".',
                                    parameters: {
                                        type: SchemaType.OBJECT,
                                        properties: {}
                                    }
                                },
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
                                    description: 'Registrar email del cliente y enviar QR de pago. DEBE usarse INMEDIATAMENTE cuando el cliente te da un correo electrónico, especialmente si tienes un PEDIDO ACTIVO pendiente de email.',
                                    parameters: {
                                        type: SchemaType.OBJECT,
                                        properties: {
                                            email: {
                                                type: SchemaType.STRING,
                                                description: 'Email del cliente (ej: juan@gmail.com)'
                                            }
                                        },
                                        required: ['email']
                                    }
                                }
                            ]

                            const model = genAI.getGenerativeModel({
                                model: 'gemini-2.5-pro',
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

                                        const audioModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
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

                                    if (name === 'send_welcome_menu') {
                                        const { sendWhatsAppImage, sendWhatsAppMessage, sendWhatsAppList } = await import('@/lib/whatsapp')
                                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'

                                        // 1. Imagen de Precios Promocionales
                                        await sendWhatsAppImage(
                                            phoneNumber,
                                            `${baseUrl}/prices_promo.jpg`,
                                            '',
                                            tenantToken,
                                            phoneId
                                        )

                                        // 2. Mensaje de Texto Formal de Juan
                                        const greetingText = `¡Hola! Bienvenido mi nombre es Juan de asistente de ventas. 👋 ¿Estás listo para llevar tus diseños al nivel profesional con Canva Pro?\n\nCon Canva Pro, tendrás acceso a:\n\n✅ Miles de Plantillas Pro exclusivas\n✅ Estudio Mágico (IA para crear diseños)\n✅ Kit de Marca personalizado\n✅ Quitar fondos automáticamente\n✅ Páginas Web profesionales\n✅ 100M+ fotos, videos e ilustraciones premium\n✅ Soporte 24/7 y seguridad total`
                                        await sendWhatsAppMessage(phoneNumber, greetingText, tenantToken, phoneId)

                                        // 3. Botón / Lista de Planes
                                        const listBody = `📋 Planes de Canva Pro disponibles:\n\nElige el plan que más te convenga y disfruta de todas las herramientas premium de Canva.\n\n💡 Todos los planes incluyen acceso completo a Canva Pro.`

                                        const sections = [
                                            {
                                                title: "Planes Canva Pro",
                                                rows: (tenantProducts || []).slice(0, 10).map(p => ({
                                                    id: `product_${p.id}`,
                                                    title: p.name.substring(0, 24),
                                                    description: `Bs ${p.price} - ${p.description || ''}`.substring(0, 72)
                                                }))
                                            }
                                        ]

                                        await sendWhatsAppList(
                                            phoneNumber,
                                            listBody,
                                            "Ver Planes",
                                            sections,
                                            tenantToken,
                                            phoneId
                                        )

                                        // Guardar en DB para historial
                                        await supabaseAdmin.from('messages').insert([
                                            { chat_id: chatId, is_from_me: true, content: `📷 Imagen Promo Precios`, status: 'delivered' },
                                            { chat_id: chatId, is_from_me: true, content: greetingText, status: 'delivered' },
                                            { chat_id: chatId, is_from_me: true, content: `📋 Lista de Planes Enviada`, status: 'delivered' }
                                        ])

                                        actionExecuted = true
                                    }

                                    if (name === 'confirm_plan' && callArgs?.plan_id) {
                                        const productId = callArgs.plan_id as string
                                        const result = await confirmOrder(productId, chatId, phoneNumber, contactName, tenantUserId);
                                        if (result.success && result.product) {
                                            actionExecuted = true;
                                            if (!aiResponseText.trim()) {
                                                aiResponseText = `¡Excelente elección! 🚀 Has seleccionado el *${result.product.name}* por *Bs ${result.product.price}*.

Para continuar, necesito tu *correo electrónico*. La invitación a *Canva Pro* se envía directamente a tu email para activar tu cuenta. 📧`
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

                                                console.log(`[SALES] Producto para QR:`, JSON.stringify(orderProduct))
                                                console.log(`[SALES] QR URL:`, orderProduct?.qr_image_url || 'NO HAY QR CONFIGURADO')

                                                let qrSent = false
                                                if (orderProduct?.qr_image_url) {
                                                    try {
                                                        const { sendWhatsAppImage } = await import('@/lib/whatsapp')

                                                        // Make sure URL is absolute for Meta API
                                                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                                                        const absQrUrl = orderProduct.qr_image_url.startsWith('http')
                                                            ? orderProduct.qr_image_url
                                                            : `${baseUrl}${orderProduct.qr_image_url.startsWith('/') ? '' : '/'}${orderProduct.qr_image_url}`;

                                                        const qrResult = await sendWhatsAppImage(
                                                            phoneNumber,
                                                            absQrUrl,
                                                            `💳 *QR de pago* - ${orderProduct.name}\n💰 Monto: *Bs ${orderProduct.price}*\n\nRealiza tu pago y envíame la foto del comprobante aquí 📸`,
                                                            tenantToken,
                                                            phoneId
                                                        )
                                                        console.log(`[SALES] QR send result:`, JSON.stringify(qrResult))

                                                        if (qrResult) {
                                                            qrSent = true
                                                            console.log(`[SALES] ✅ QR enviado exitosamente para: ${orderProduct.name}`)
                                                        } else {
                                                            console.error(`[SALES] ❌ sendWhatsAppImage retornó null`)
                                                        }

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
                                                        console.error('[SALES] ❌ Error enviando QR:', qrError)
                                                    }
                                                } else {
                                                    console.error(`[SALES] ⚠️ Producto sin qr_image_url: ${pendingOrder.plan}`)
                                                }

                                                actionExecuted = true
                                                if (!aiResponseText.trim()) {
                                                    if (qrSent) {
                                                        aiResponseText = `✅ ¡Email registrado! Tu invitación a *Canva Pro* se activará en *${email}*.

Te he enviado el *QR de pago* aquí arriba ☝️ para tu *${orderProduct?.name || pendingOrder.plan_name}* (*Bs ${orderProduct?.price || pendingOrder.amount}*).

Una vez realices el pago, envíame la foto del comprobante por este chat. 📸`
                                                    } else {
                                                        aiResponseText = `✅ ¡Email registrado! Tu invitación a *Canva Pro* se activará en *${email}*.

En un momento te envío el *QR de pago* para tu *${orderProduct?.name || pendingOrder.plan_name}*. 💳`
                                                    }
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
                                if (!actionExecuted) {
                                    aiResponseText = '¡Hola! 👋 Bienvenido a JABA Marketing Digital. ¿En qué puedo ayudarte hoy?'
                                } else {
                                    // Si se ejecutó una acción pero no hay texto extra de la IA, terminamos el proceso sin enviar burbuja vacía
                                    return new NextResponse('EVENT_RECEIVED', { status: 200 })
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
                                // Generar un retraso dinámico de "escribiendo" basado en la longitud de la respuesta para sentirse más realista
                                // 35ms por letra de peso aprox, con un base de 1.5s y tope de 4.8s para evitar timeout de Vercel
                                const calcDelay = 1500 + (aiResponseText.length * 35);
                                const typingDelay = Math.min(calcDelay, 4800);
                                console.log(`[Typing Delay] Esperando ${typingDelay}ms simulando escritura humana...`);
                                await new Promise(resolve => setTimeout(resolve, typingDelay));
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

                        } catch (aiError) {
                            console.error('[AI] Error procesando consolidado:', aiError);
                        }

                        // Siempre resolver la promesa para que Vercel termine
                        resolve(true);

                    }, 6000); // <-- 6s DELAY AGREGATION
                });

                return new NextResponse('EVENT_RECEIVED', { status: 200 })

                // =============================================
                // HANDLER: Status Updates (delivered, read)
                // =============================================
            } else if (
                body.entry &&
                body.entry[0]?.changes?.[0]?.value?.statuses &&
                body.entry[0].changes[0].value.statuses[0]
            ) {
                const statusUpdate = body.entry[0].changes[0].value.statuses[0]
                const waMessageId = statusUpdate.id
                const newStatus = statusUpdate.status // 'sent', 'delivered', 'read', 'failed'

                if (waMessageId && (newStatus === 'delivered' || newStatus === 'read')) {
                    // Update message status in DB
                    const { error: updateErr } = await supabaseAdmin
                        .from('messages')
                        .update({ status: newStatus })
                        .eq('whatsapp_message_id', waMessageId)

                    if (!updateErr) {
                        console.log(`[Status] Message ${waMessageId} -> ${newStatus}`)
                    }
                }

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
