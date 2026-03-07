
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
    // --- CRM TAG HELPER ---
    async function updateChatTags(chatId: string, addTags: string[] = [], removeTags: string[] = []) {
        try {
            const { data: chat } = await supabaseAdmin.from('chats').select('tags').eq('id', chatId).single();
            let currentTags: string[] = chat?.tags || [];
            // Remove specified tags
            if (removeTags.length > 0) currentTags = currentTags.filter(t => !removeTags.includes(t));
            // Add new tags (no duplicates)
            for (const tag of addTags) {
                if (!currentTags.includes(tag)) currentTags.push(tag);
            }
            await supabaseAdmin.from('chats').update({ tags: currentTags }).eq('id', chatId);
        } catch (err) {
            console.error('[CRM Tags] Error updating tags:', err);
        }
    }

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
                    .select('user_id, access_token, bot_name, service_name, service_description, promo_image_url')
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
                const tenantBusinessName = (credentials as any).bot_name || 'Nuestro negocio'
                const tenantServiceName = (credentials as any).service_name || tenantBusinessName
                const tenantServiceDesc = (credentials as any).service_description || `el servicio de ${tenantServiceName}`
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const tenantPromoImage = (credentials as any).promo_image_url || `${baseUrl}/prices_promo.jpg`
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
                        unread_count: 1,
                        tags: ['nuevo']  // CRM: auto-tag new client
                    }).select().single()

                    if (chatError) console.error("Error creating chat:", chatError);
                    if (newChat) chatId = newChat.id
                    console.log(`[CRM] 🏷️ Auto-tagged nuevo: ${contactName}`);
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
                // 2.5. AUTO-RENOVACIÓN: Si el cliente envía imagen + tiene pedido pendiente → auto-aprobar
                // =================================================================================
                if (messageType === 'image' && chatId && savedMediaUrl) {
                    try {
                        // Buscar pedido pendiente de pago para este chat
                        const { data: pendingOrder } = await supabaseAdmin
                            .from('orders')
                            .select('*')
                            .eq('chat_id', chatId)
                            .eq('status', 'pending_payment')
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (pendingOrder) {
                            console.log(`[AUTO-RENEWAL] 🔄 Imagen recibida + pedido pendiente ${pendingOrder.id}`);

                            // ===== VERIFICAR MONTO CON IA =====
                            let amountVerified = true; // Por defecto auto-aprobar
                            let detectedAmount = 0;
                            let verificationNote = '✅ Comprobante recibido';
                            try {
                                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                                const apiKey = process.env.GOOGLE_API_KEY || '';
                                if (apiKey) {
                                    const genAI = new GoogleGenerativeAI(apiKey);
                                    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                                    const imgResp = await fetch(savedMediaUrl);
                                    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
                                    const imgBase64 = imgBuffer.toString('base64');

                                    const visionResult = await visionModel.generateContent([
                                        {
                                            inlineData: {
                                                mimeType: 'image/jpeg',
                                                data: imgBase64
                                            }
                                        },
                                        `Analiza esta imagen de un comprobante de pago boliviano. Extrae SOLO el monto total pagado en Bolivianos (Bs). Responde ÚNICAMENTE con el número, sin texto adicional. Si no puedes leer el monto, responde "0". Ejemplos: "39", "69", "170", "0"`
                                    ]);

                                    const amountText = visionResult.response.text().trim().replace(/[^0-9.]/g, '');
                                    detectedAmount = parseFloat(amountText) || 0;
                                    const expectedAmount = parseFloat(String(pendingOrder.amount)) || 0;

                                    console.log(`[AUTO-RENEWAL] Monto detectado: Bs ${detectedAmount}, esperado: Bs ${expectedAmount}`);

                                    if (detectedAmount >= expectedAmount) {
                                        verificationNote = `✅ Monto verificado: Bs ${detectedAmount}`;
                                    } else if (detectedAmount > 0 && detectedAmount < expectedAmount) {
                                        // SOLO bloquear si detectamos un monto MENOR al esperado
                                        amountVerified = false;
                                        verificationNote = `⚠️ Monto no coincide: Bs ${detectedAmount} (esperado: Bs ${expectedAmount})`;
                                    } else {
                                        verificationNote = '✅ Comprobante recibido';
                                    }
                                }
                            } catch (visionErr) {
                                console.error('[AUTO-RENEWAL] Error verificando (se auto-aprueba):', visionErr);
                                verificationNote = '✅ Comprobante recibido';
                            }

                            // Usar el email DEL PEDIDO (el que el cliente proporcionó), NO el de la primera suscripción
                            const orderEmail = pendingOrder.customer_email || '';

                            // Si el monto no coincide → marcar para revisión manual
                            if (!amountVerified) {
                                await supabaseAdmin.from('orders').update({
                                    payment_proof_url: savedMediaUrl,
                                    status: 'pending_review',
                                    updated_at: new Date().toISOString()
                                }).eq('id', pendingOrder.id);

                                const { sendWhatsAppMessage: sendWAMsg } = await import('@/lib/whatsapp');
                                const reviewMsg = `📋 *Comprobante recibido*\n\n${verificationNote}\n\nNuestro equipo verificará tu pago manualmente. Te confirmaremos la renovación en breve. ⏳`;
                                await sendWAMsg(phoneNumber, reviewMsg, tenantToken, phoneId);
                                await supabaseAdmin.from('messages').insert({
                                    chat_id: chatId, is_from_me: true, content: reviewMsg, status: 'delivered'
                                });
                                await supabaseAdmin.from('chats').update({
                                    last_message: '⚠️ Comprobante requiere revisión',
                                    last_message_time: new Date().toISOString(),
                                    tags: ['revision_pago']
                                }).eq('id', chatId);

                                return new NextResponse('EVENT_RECEIVED', { status: 200 });
                            }

                            // ===== MONTO VERIFICADO → AUTO-APROBAR =====
                            await supabaseAdmin.from('orders').update({
                                payment_proof_url: savedMediaUrl,
                                status: 'completed',
                                updated_at: new Date().toISOString()
                            }).eq('id', pendingOrder.id);

                            // Calcular nueva fecha de vencimiento según plan
                            const { data: planProduct } = await supabaseAdmin
                                .from('products')
                                .select('name, duration_months')
                                .eq('id', pendingOrder.plan)
                                .single();

                            const durationMonths = planProduct?.duration_months || 1;
                            const today = new Date();
                            const newExpDate = new Date(today);
                            newExpDate.setMonth(newExpDate.getMonth() + durationMonths);
                            const newExpiration = `${String(newExpDate.getDate()).padStart(2, '0')}/${String(newExpDate.getMonth() + 1).padStart(2, '0')}/${newExpDate.getFullYear()}`;

                            // Buscar suscripción por el correo del PEDIDO (no la primera que encuentre)
                            const cleanPhone = phoneNumber.replace(/^591/, '');
                            let subFilter = `numero.eq.${phoneNumber},numero.eq.${cleanPhone}`;
                            if (orderEmail) subFilter += `,correo.eq.${orderEmail}`;
                            console.log(`[AUTO-RENEWAL] Buscando suscripción: filter=${subFilter}, userId=${tenantUserId}`);

                            const { data: clientSub, error: subErr } = await supabaseAdmin
                                .from('subscriptions')
                                .select('id, vencimiento, correo')
                                .eq('user_id', tenantUserId)
                                .or(subFilter)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();

                            console.log(`[AUTO-RENEWAL] clientSub encontrado:`, clientSub ? `id=${clientSub.id}, correo=${clientSub.correo}` : 'NULL', subErr ? `ERROR: ${subErr.message}` : '');

                            // Si el email del pedido no coincide con la suscripción encontrada, buscar por email exacto
                            let targetSub = clientSub;
                            if (orderEmail && clientSub && clientSub.correo !== orderEmail) {
                                console.log(`[AUTO-RENEWAL] Email no coincide (${clientSub.correo} vs ${orderEmail}), buscando exacto`);
                                const { data: exactSub } = await supabaseAdmin
                                    .from('subscriptions')
                                    .select('id, vencimiento, correo')
                                    .eq('user_id', tenantUserId)
                                    .eq('correo', orderEmail)
                                    .limit(1)
                                    .maybeSingle();
                                if (exactSub) {
                                    targetSub = exactSub;
                                    console.log(`[AUTO-RENEWAL] Encontrado por email exacto: id=${exactSub.id}`);
                                }
                            }

                            if (targetSub) {
                                const { data: updatedSub, error: updateErr } = await supabaseAdmin.from('subscriptions').update({
                                    vencimiento: newExpiration,
                                    estado: 'ACTIVO',
                                    notified: false,
                                    notified_at: null,
                                    followup_sent: false,
                                    urgency_sent: false
                                }).eq('id', targetSub.id).select('id, vencimiento').single();

                                if (updateErr) {
                                    console.error(`[AUTO-RENEWAL] ❌ ERROR actualizando suscripción ${targetSub.id}:`, updateErr.message);
                                } else {
                                    console.log(`[AUTO-RENEWAL] ✅ Suscripción ${targetSub.id} (${targetSub.correo}) renovada: vencimiento=${updatedSub?.vencimiento}`);
                                }
                            } else {
                                console.error(`[AUTO-RENEWAL] ❌ No se encontró suscripción para: phone=${phoneNumber}, email=${orderEmail}, userId=${tenantUserId}`);
                            }

                            // Crear registro de renovación para auditoría
                            await supabaseAdmin.from('subscription_renewals').insert({
                                user_id: tenantUserId,
                                subscription_id: targetSub?.id || null,
                                order_id: pendingOrder.id,
                                chat_id: chatId,
                                phone_number: phoneNumber,
                                customer_email: orderEmail || targetSub?.correo || '',
                                plan_name: pendingOrder.plan_name || planProduct?.name || '',
                                amount: pendingOrder.amount,
                                old_expiration: targetSub?.vencimiento || '',
                                new_expiration: newExpiration,
                                payment_proof_url: savedMediaUrl,
                                status: 'auto_approved',
                                reviewed_at: new Date().toISOString()
                            });

                            // Enviar confirmación por WhatsApp
                            const { sendWhatsAppMessage: sendWAMsg } = await import('@/lib/whatsapp');
                            const confirmMsg = `✅ *¡Pago recibido y renovación completada!* 🎉\n\n${verificationNote}\n\nTu acceso para *${orderEmail || targetSub?.correo || ''}* ha sido renovado.\n\n📋 *Detalle:*\n• Plan: ${pendingOrder.plan_name || planProduct?.name}\n• Monto: Bs ${pendingOrder.amount}\n• Vigencia hasta: *${newExpiration}*\n\n¡Gracias por confiar en nosotros! 😊`;

                            await sendWAMsg(phoneNumber, confirmMsg, tenantToken, phoneId);

                            await supabaseAdmin.from('messages').insert({
                                chat_id: chatId, is_from_me: true, content: confirmMsg, status: 'delivered'
                            });

                            await supabaseAdmin.from('chats').update({
                                last_message: '✅ Renovación auto-aprobada',
                                last_message_time: new Date().toISOString(),
                                tags: ['pago']
                            }).eq('id', chatId);

                            return new NextResponse('EVENT_RECEIVED', { status: 200 });
                        }
                    } catch (autoRenewalErr) {
                        console.error('[AUTO-RENEWAL] Error:', autoRenewalErr);
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

                    // Buscar TODAS las suscripciones de este número (puede tener múltiples cuentas)
                    const cleanPhone = phoneNumber.replace(/^591/, '');
                    const { data: allActiveSubs } = await supabaseAdmin
                        .from('subscriptions')
                        .select('*')
                        .eq('user_id', tenantUserId)
                        .eq('estado', 'ACTIVO')
                        .or(`numero.eq.${phoneNumber},numero.eq.${cleanPhone}`)
                        .order('created_at', { ascending: false });

                    // Usar la primera activa como principal (o buscar inactiva si no hay activas)
                    let subscription = allActiveSubs?.[0] || null;
                    let isInactiveClient = false;
                    if (!subscription) {
                        const { data: inactiveSub } = await supabaseAdmin
                            .from('subscriptions')
                            .select('*')
                            .eq('user_id', tenantUserId)
                            .neq('estado', 'ACTIVO')
                            .or(`numero.eq.${phoneNumber},numero.eq.${cleanPhone}`)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        subscription = inactiveSub;
                        if (inactiveSub) isInactiveClient = true;
                    }

                    const customerEmail = subscription?.correo || '';

                    // Check if there's a pending_plan_selection order with pre-stored email
                    const { data: pendingSelection } = await supabaseAdmin
                        .from('orders')
                        .select('id, customer_email')
                        .eq('chat_id', chatId)
                        .eq('status', 'pending_plan_selection')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    // If we have a pre-selected email, use it (from the email-detection flow)
                    const finalEmail = pendingSelection?.customer_email || customerEmail;

                    // Clean up the pending_plan_selection order
                    if (pendingSelection) {
                        await supabaseAdmin.from('orders').delete().eq('id', pendingSelection.id);
                    }

                    const { sendWhatsAppMessage, sendWhatsAppImage } = await import('@/lib/whatsapp');

                    // Si es cliente INACTIVO, confirmar correo antes de proceder
                    if (isInactiveClient && customerEmail) {
                        const confirmMsg = `✅ *¡Plan seleccionado!*\n\n` +
                            `Hemos encontrado tu cuenta registrada: *${customerEmail}*\n\n` +
                            `¿Es esta la cuenta que deseas renovar con el plan *${product.name}* (Bs ${product.price})?\n\n` +
                            `Si es correcto, continúa con el pago a continuación. Si no es tu cuenta, escríbenos el correo correcto.`;
                        await sendWhatsAppMessage(phoneNumber, confirmMsg, tenantToken, phoneId);
                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId, is_from_me: true, content: confirmMsg, status: 'delivered'
                        });
                        // Crear orden en pending_payment por si confirma
                    }

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
                        customer_email: finalEmail,
                        equipo: subscription?.equipo || '',
                        status: 'pending_payment'
                    });

                    if (orderError) {
                        console.error('[Renewal] Error creating order:', orderError);
                        return new NextResponse('EVENT_RECEIVED', { status: 200 });
                    }

                    console.log(`[Renewal] Orden creada: ${product.name} (Bs ${product.price}) para ${customerEmail || phoneNumber} (inactivo: ${isInactiveClient})`);

                    // Solo enviar QR directamente si el cliente está ACTIVO (o es nuevo sin correo)
                    // Para inactivos ya se envió el mensaje de confirmación arriba
                    if (!isInactiveClient) {
                        const renewMsg = `✅ *¡Plan seleccionado!*\n\n` +
                            `Has elegido *${product.name}* (Bs ${product.price}) para renovar tu cuenta *${customerEmail || phoneNumber}*.\n\n` +
                            `💳 Realiza el pago con el siguiente QR y envíanos la foto del comprobante por este medio:`;

                        await sendWhatsAppMessage(phoneNumber, renewMsg, tenantToken, phoneId);

                        if (product.qr_image_url) {
                            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com';
                            const qrUrl = product.qr_image_url.startsWith('http') ? product.qr_image_url : `${baseUrl}${product.qr_image_url}`;
                            await sendWhatsAppImage(phoneNumber, qrUrl, `QR de pago - ${product.name} (Bs ${product.price})`, tenantToken, phoneId);
                        }

                        const baseUrl2 = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com';
                        const qrUrlForDb = product.qr_image_url ? (product.qr_image_url.startsWith('http') ? product.qr_image_url : `${baseUrl2}${product.qr_image_url}`) : null;

                        await supabaseAdmin.from('messages').insert({
                            chat_id: chatId,
                            is_from_me: true,
                            content: renewMsg,
                            status: 'delivered',
                            media_url: qrUrlForDb,
                            media_type: qrUrlForDb ? 'image' : null
                        });
                    } else if (product.qr_image_url) {
                        // Para inactivos: enviar QR después del mensaje de confirmación
                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com';
                        const qrUrl = product.qr_image_url.startsWith('http') ? product.qr_image_url : `${baseUrl}${product.qr_image_url}`;
                        await sendWhatsAppImage(phoneNumber, qrUrl, `QR de pago - ${product.name} (Bs ${product.price})`, tenantToken, phoneId);
                    }

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

                        // --- RENOVACIÓN: REVISIÓN MANUAL (ya no auto-renueva) ---
                        if (activeOrder.product === 'renewal') {
                            console.log(`[Renewal] Comprobante recibido para revisión manual de ${phoneNumber}`);

                            // PASO 1: Buscar suscripción del cliente primero (necesitamos el vencimiento actual)
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

                            // PASO 2: Calcular nueva fecha correctamente:
                            // - Si la sub sigue vigente → extender desde el vencimiento actual
                            // - Si ya venció → extender desde hoy
                            const todayBolivia = new Date(Date.now() - 4 * 60 * 60 * 1000);
                            const today = new Date(todayBolivia.getFullYear(), todayBolivia.getMonth(), todayBolivia.getDate());

                            // Obtener duration_months del producto (fuente de verdad)
                            const { data: productData } = await supabaseAdmin
                                .from('products')
                                .select('duration_months, name')
                                .eq('id', activeOrder.plan)
                                .single();

                            let monthsToAdd = productData?.duration_months || 0;
                            if (!monthsToAdd || monthsToAdd < 1) {
                                // Fallback: inferir del nombre si no está configurado en el producto
                                const planName = (activeOrder.plan_name || '').toLowerCase();
                                if (planName.includes('3 mes') || planName.includes('trimestral') || planName.includes('bronce')) monthsToAdd = 3;
                                else if (planName.includes('6 mes') || planName.includes('semestral') || planName.includes('plata')) monthsToAdd = 6;
                                else if (planName.includes('9 mes') || planName.includes('oro')) monthsToAdd = 9;
                                else if (planName.includes('1 año') || planName.includes('anual') || planName.includes('premium')) monthsToAdd = 12;
                                else monthsToAdd = 1;
                            }
                            console.log(`[Renewal] Plan "${activeOrder.plan_name}" → ${monthsToAdd} mes(es) desde producto`);

                            // Determinar fecha base: extender desde vencimiento si sigue vigente, o desde hoy si ya venció
                            let baseDate = today;
                            if (sub?.vencimiento) {
                                const partsSlash = sub.vencimiento.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                                const partsDash = sub.vencimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                                let currentExp: Date | null = null;
                                if (partsSlash) currentExp = new Date(parseInt(partsSlash[3]), parseInt(partsSlash[2]) - 1, parseInt(partsSlash[1]));
                                else if (partsDash) currentExp = new Date(parseInt(partsDash[1]), parseInt(partsDash[2]) - 1, parseInt(partsDash[3]));
                                if (currentExp && currentExp > today) {
                                    baseDate = currentExp; // Sub vigente: extender desde vencimiento
                                    console.log(`[Renewal] Sub vigente hasta ${sub.vencimiento}, extendiendo desde ahí`);
                                } else {
                                    console.log(`[Renewal] Sub vencida (${sub.vencimiento}), extendiendo desde hoy`);
                                }
                            }
                            const newExpDate = new Date(baseDate);
                            newExpDate.setMonth(newExpDate.getMonth() + monthsToAdd);
                            const newExpStr = `${String(newExpDate.getDate()).padStart(2, '0')}/${String(newExpDate.getMonth() + 1).padStart(2, '0')}/${newExpDate.getFullYear()}`;

                            // ============================================================
                            // PROTECCIÓN ANTI-DUPLICADOS
                            // ============================================================
                            // Guard 1: Si el pedido ya fue procesado antes, rechazar comprobante duplicado
                            if (activeOrder.status === 'completed') {
                                console.log(`[Renewal] ⚠️ Orden ${activeOrder.id} ya completada. Comprobante duplicado de ${phoneNumber}`);
                                const dupMsg = `ℹ️ Tu renovación para el plan *${activeOrder.plan_name}* ya fue procesada anteriormente. Si tienes dudas, comunícate con nosotros.`;
                                await sendWhatsAppMessage(phoneNumber, dupMsg, tenantToken, phoneId);
                                await supabaseAdmin.from('messages').insert({ chat_id: chatId, is_from_me: true, content: dupMsg, status: 'delivered' });
                                return new NextResponse('EVENT_RECEIVED', { status: 200 });
                            }

                            // Guard 2: Verificar si ya existe un registro de renovación para este pedido
                            const { data: existingRenewal } = await supabaseAdmin
                                .from('subscription_renewals')
                                .select('id, status')
                                .eq('order_id', activeOrder.id)
                                .maybeSingle();

                            if (existingRenewal) {
                                console.log(`[Renewal] ⚠️ Ya existe renovación ${existingRenewal.id} para orden ${activeOrder.id}. Ignorando comprobante duplicado.`);
                                const dupMsg = `ℹ️ Ya recibimos y procesamos tu comprobante para el plan *${activeOrder.plan_name}*. Si no recibiste confirmación, contáctanos.`;
                                await sendWhatsAppMessage(phoneNumber, dupMsg, tenantToken, phoneId);
                                await supabaseAdmin.from('messages').insert({ chat_id: chatId, is_from_me: true, content: dupMsg, status: 'delivered' });
                                return new NextResponse('EVENT_RECEIVED', { status: 200 });
                            }

                            // ============================================================
                            // PASO 3: RENOVACIÓN AUTOMÁTICA INMEDIATA
                            // ============================================================
                            console.log(`[Renewal] ✅ Procesando renovación automática para ${phoneNumber} → ${newExpStr}`);

                            // Obtener nombre del negocio para el mensaje
                            const { data: bizCreds } = await supabaseAdmin
                                .from('whatsapp_credentials')
                                .select('bot_name, service_name')
                                .eq('user_id', tenantUserId)
                                .single();
                            const bizName = bizCreds?.bot_name || bizCreds?.service_name || 'nuestro servicio';

                            // ACTUALIZAR la suscripción automáticamente ahora
                            let subUpdated = false;
                            if (sub?.id) {
                                const { error: updateErr } = await supabaseAdmin
                                    .from('subscriptions')
                                    .update({
                                        vencimiento: newExpStr,
                                        estado: 'ACTIVO',
                                        notified: false,
                                        notified_at: null,
                                        followup_sent: false,
                                        urgency_sent: false
                                    })
                                    .eq('id', sub.id);

                                if (!updateErr) {
                                    subUpdated = true;
                                    console.log(`[Renewal] ✅ Suscripción ${sub.id} actualizada: ${oldExpiration} → ${newExpStr} (ACTIVO)`);
                                } else {
                                    console.error(`[Renewal] ❌ Error actualizando suscripción:`, updateErr);
                                }
                            } else {
                                console.warn(`[Renewal] ⚠️ No se encontró suscripción para ${phoneNumber}. Se registra para supervisión admin.`);
                            }

                            // Actualizar orden a COMPLETED
                            await supabaseAdmin.from('orders').update({
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                                metadata: {
                                    ...(activeOrder.metadata || {}),
                                    receipt_image_url: savedMediaUrl,
                                    auto_renewed: true,
                                    renewed_at: new Date().toISOString()
                                }
                            }).eq('id', activeOrder.id);

                            // Crear registro en subscription_renewals para supervisión del admin
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
                                status: subUpdated ? 'approved' : 'pending_review', // pending_review solo si fallo
                                reviewed_at: subUpdated ? new Date().toISOString() : null
                            });

                            // Log de notificación
                            await supabaseAdmin.from('subscription_notification_logs').insert({
                                user_id: tenantUserId,
                                subscription_id: sub?.id || null,
                                phone_number: phoneNumber,
                                message_type: 'auto_renewed',
                                status: 'sent'
                            });

                            // ============================================================
                            // MENSAJE DE CONFIRMACIÓN al cliente
                            // ============================================================
                            const successMsg = subUpdated
                                ? `✅ *¡Renovación completada!* 🎉\n\nTu acceso para *${activeOrder.customer_email || sub?.correo || phoneNumber}* en *${bizName}* ha sido renovado con éxito.\n\n📋 *Detalle:*\n• Plan: ${activeOrder.plan_name}\n• Monto: Bs ${activeOrder.amount}\n• Vigencia hasta: *${newExpStr}*\n\n¡Gracias por tu preferencia! 😊`
                                : `📩 *¡Comprobante recibido!*\n\nGracias por tu pago del plan *${activeOrder.plan_name}* (Bs ${activeOrder.amount}). Tu cuenta está siendo procesada y te confirmaremos en breve. ⏳`;

                            await sendWhatsAppMessage(phoneNumber, successMsg, tenantToken, phoneId);

                            await supabaseAdmin.from('messages').insert({
                                chat_id: chatId,
                                is_from_me: true,
                                content: successMsg,
                                status: 'delivered'
                            });

                            await supabaseAdmin.from('chats').update({
                                last_message: successMsg.substring(0, 100),
                                last_message_time: new Date().toISOString()
                            }).eq('id', chatId);

                            // CRM: Auto-tag payment
                            if (chatId) {
                                await updateChatTags(chatId, ['pago'], ['renovacion_pendiente', 'vencido', 'nuevo', 'cliente_potencial']);
                                console.log(`[CRM] 🏷️ Auto-tagged pago: ${phoneNumber}`);
                            }

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

                            // ====== DETECTAR TODAS LAS SUSCRIPCIONES DEL CLIENTE ======
                            const cleanPhoneForLookup = phoneNumber.replace(/^591/, '');
                            console.log(`[AI] Buscando suscripciones: phone=${phoneNumber}, clean=${cleanPhoneForLookup}, userId=${tenantUserId}`);

                            // Buscar TODAS las suscripciones activas del número (solo con correo válido)
                            const { data: allExistingActiveSubs } = await supabaseAdmin
                                .from('subscriptions')
                                .select('correo, vencimiento, estado, equipo')
                                .eq('user_id', tenantUserId)
                                .eq('estado', 'ACTIVO')
                                .not('correo', 'is', null)
                                .neq('correo', '')
                                .or(`numero.eq.${phoneNumber},numero.eq.${cleanPhoneForLookup}`)
                                .order('created_at', { ascending: false });

                            // También buscar inactivas (solo con correo válido)
                            const { data: allExistingInactiveSubs } = await supabaseAdmin
                                .from('subscriptions')
                                .select('correo, vencimiento, estado, equipo')
                                .eq('user_id', tenantUserId)
                                .neq('estado', 'ACTIVO')
                                .not('correo', 'is', null)
                                .neq('correo', '')
                                .or(`numero.eq.${phoneNumber},numero.eq.${cleanPhoneForLookup}`)
                                .order('created_at', { ascending: false });

                            console.log(`[AI] Suscripciones encontradas: activas=${allExistingActiveSubs?.length || 0}, inactivas=${allExistingInactiveSubs?.length || 0}`);
                            if (allExistingActiveSubs?.length) console.log(`[AI] Correos activos:`, allExistingActiveSubs.map(s => s.correo));

                            const allSubs = [...(allExistingActiveSubs || []), ...(allExistingInactiveSubs || [])];
                            const existingSub = allExistingActiveSubs?.[0] || allExistingInactiveSubs?.[0] || null;
                            const existingSubIsInactive = !allExistingActiveSubs?.length && !!allExistingInactiveSubs?.length;

                            // BUG 2 FIX: Calcular estado real de la fecha de vencimiento
                            let subscriptionStatusLabel = '';
                            if (existingSub?.vencimiento) {
                                // Fecha actual en Bolivia (UTC-4)
                                const nowBolivia = new Date(Date.now() - 4 * 60 * 60 * 1000);
                                const todayBolivia = new Date(nowBolivia.getFullYear(), nowBolivia.getMonth(), nowBolivia.getDate());

                                // Parsear vencimiento DD/MM/YYYY o YYYY-MM-DD
                                let expDate: Date | null = null;
                                const partsSlash = existingSub.vencimiento.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                                const partsDash = existingSub.vencimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                                if (partsSlash) {
                                    expDate = new Date(parseInt(partsSlash[3]), parseInt(partsSlash[2]) - 1, parseInt(partsSlash[1]));
                                } else if (partsDash) {
                                    expDate = new Date(parseInt(partsDash[1]), parseInt(partsDash[2]) - 1, parseInt(partsDash[3]));
                                }

                                if (expDate) {
                                    const diffDays = Math.ceil((expDate.getTime() - todayBolivia.getTime()) / (1000 * 60 * 60 * 24));
                                    if (diffDays < 0) {
                                        subscriptionStatusLabel = `❌ VENCIDA hace ${Math.abs(diffDays)} días (venció el ${existingSub.vencimiento})`;
                                    } else if (diffDays === 0) {
                                        subscriptionStatusLabel = `⚠️ VENCE HOY (${existingSub.vencimiento}) — última oportunidad`;
                                    } else if (diffDays <= 7) {
                                        subscriptionStatusLabel = `⚠️ VIGENTE pero PRÓXIMA A VENCER en ${diffDays} días (${existingSub.vencimiento})`;
                                    } else {
                                        subscriptionStatusLabel = `✅ VIGENTE — vence en ${diffDays} días (${existingSub.vencimiento})`;
                                    }
                                } else {
                                    subscriptionStatusLabel = `Vencimiento: ${existingSub.vencimiento} (fecha no parseable)`;
                                }
                            }

                            let subscriberContext = '';
                            if (existingSub) {
                                const activeCnt = allExistingActiveSubs?.length || 0;
                                const totalCnt = allSubs.length;
                                console.log(`[AI] Cliente detectado: ${phoneNumber} → ${totalCnt} suscripciones (${activeCnt} activas)`);

                                // Construir lista de TODAS las cuentas para el contexto con DÍAS PRECALCULADOS
                                const nowBol = new Date(Date.now() - 4 * 60 * 60 * 1000);
                                const todayBol = new Date(nowBol.getFullYear(), nowBol.getMonth(), nowBol.getDate());
                                const allAccountsList = allSubs.map((s, i) => {
                                    let diasInfo = '';
                                    if (s.vencimiento) {
                                        let expD: Date | null = null;
                                        const ps = s.vencimiento.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                                        const pd = s.vencimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                                        if (ps) expD = new Date(parseInt(ps[3]), parseInt(ps[2]) - 1, parseInt(ps[1]));
                                        else if (pd) expD = new Date(parseInt(pd[1]), parseInt(pd[2]) - 1, parseInt(pd[3]));
                                        if (expD) {
                                            const diff = Math.ceil((expD.getTime() - todayBol.getTime()) / (1000 * 60 * 60 * 24));
                                            diasInfo = diff < 0 ? ` | VENCIDA hace ${Math.abs(diff)} días` : diff === 0 ? ' | VENCE HOY' : ` | Vence en ${diff} días`;
                                        }
                                    }
                                    return `  ${i + 1}. Correo: ${s.correo} | Estado: ${s.estado} | Fecha: ${s.vencimiento || 'N/A'}${diasInfo} | Equipo: ${s.equipo || 'N/A'}`;
                                }).join('\n');

                                if (existingSubIsInactive) {
                                    subscriberContext = `\n⚠️ [CLIENTE CON CUENTAS REGISTRADAS - REGLA ABSOLUTA]
Este cliente tiene ${totalCnt} cuenta(s) registrada(s) en nuestro sistema (todas INACTIVAS):
${allAccountsList}
INSTRUCCIÓN: Si el cliente quiere renovar, preséntale la lista de cuentas y pregúntale cuál desea renovar. Usa exactamente los correos de la lista de arriba. NUNCA le pidas su correo electrónico.`;
                                } else {
                                    // Tiene al menos una cuenta activa
                                    subscriberContext = `\n⚠️ [CLIENTE EXISTENTE - REGLA ABSOLUTA] Este cliente YA está en nuestra base de datos.
Total de cuentas registradas con este número: ${totalCnt} (${activeCnt} activa(s))
Lista completa de cuentas:
${allAccountsList}
- Cuenta principal activa: ${existingSub.correo} | Estado: ${subscriptionStatusLabel || existingSub.estado} | Equipo: ${existingSub.equipo || 'N/A'}
INSTRUCCIÓN CRÍTICA SOBRE FECHAS: Los días restantes ya están calculados arriba. NUNCA calcules tú los días, usa EXACTAMENTE la información que te doy. ${subscriptionStatusLabel.includes('VENCIDA') || subscriptionStatusLabel.includes('VENCE HOY') ? `La suscripción principal está VENCIDA o vence hoy. Dirígelo al proceso de renovación.` : `La suscripción principal está vigente. NO le digas que debe renovar ni que su cuenta será suspendida.`}
INSTRUCCIÓN CRÍTICA SOBRE EMAIL: NUNCA pidas correo a este cliente. Ya tenemos su correo registrado. Si quiere renovar y tiene varias cuentas, pregúntale cuál desea renovar mostrando la lista de arriba. Si elige una, usa ese correo con "process_email". Si solo tiene una cuenta activa, usa directamente "${existingSub.correo}" con "process_email" SIN preguntar.
INSTRUCCIÓN SOBRE NOTIFICACIONES: Si el cliente dice que ya pagó o que ya renovó, NO le digas que recibirá más notificaciones. Simplemente confirma que verificarás su cuenta.`;

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
                                } // end else (ACTIVO)
                            } // end if (existingSub)

                            // Contexto del pedido activo (solo si existe)
                            let orderContext = ''

                            // ============================================================
                            // DETECCIÓN DIRECTA: Si el cliente envió un correo que coincide
                            // con una de sus cuentas registradas → auto-enviar lista de planes
                            // ============================================================
                            if (!activeOrder && allSubs.length > 0) {
                                const msgLower = finalMessageText.trim().toLowerCase();
                                const matchedAccount = allSubs.find(s =>
                                    s.correo && s.correo.toLowerCase() === msgLower
                                );
                                if (matchedAccount) {
                                    console.log(`[AI] ✅ Cliente seleccionó cuenta: ${matchedAccount.correo} — enviando lista de planes`);

                                    // Enviar lista interactiva de planes
                                    if (tenantProducts && tenantProducts.length > 0) {
                                        const { sendWhatsAppList } = await import('@/lib/whatsapp');
                                        const rows = tenantProducts.slice(0, 10).map(p => ({
                                            id: `plan_${p.id}`,
                                            title: p.name.substring(0, 24),
                                            description: `Bs ${p.price}${p.description ? ' - ' + p.description.substring(0, 48) : ''}`
                                        }));

                                        try {
                                            await sendWhatsAppList(
                                                phoneNumber,
                                                `¡Perfecto! 🎯 Renovaremos la cuenta *${matchedAccount.correo}*.\n\nElige tu plan:`,
                                                'Planes Disponibles',
                                                [{ title: 'Planes', rows }],
                                                tenantToken,
                                                phoneId
                                            );

                                            // Guardar mensaje en chat
                                            await supabaseAdmin.from('messages').insert({
                                                chat_id: chatId,
                                                is_from_me: true,
                                                content: `¡Perfecto! 🎯 Renovaremos la cuenta *${matchedAccount.correo}*. Elige tu plan de la lista.`,
                                                status: 'delivered'
                                            });
                                            await supabaseAdmin.from('chats').update({
                                                last_message: `Renovaremos ${matchedAccount.correo} — planes enviados`,
                                                last_message_time: new Date().toISOString()
                                            }).eq('id', chatId);

                                            // Guardar el correo seleccionado en memoria temporal para cuando elija plan
                                            await supabaseAdmin.from('orders').insert({
                                                chat_id: chatId,
                                                user_id: tenantUserId,
                                                customer_email: matchedAccount.correo,
                                                phone_number: phoneNumber,
                                                status: 'pending_plan_selection',
                                                plan: '',
                                                plan_name: '',
                                                amount: 0
                                            });

                                            return new NextResponse('EVENT_RECEIVED', { status: 200 });
                                        } catch (listErr) {
                                            console.error('[AI] Error sending plan list:', listErr);
                                            // Fall through to AI
                                        }
                                    }
                                }
                            }
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
- NUNCA repitas saludos ni "Bienvenido" si ya hay mensajes en la conversación. Mantén un flujo natural y directo.
- Si el cliente ya está en una conversación activa, NO lo saludes de nuevo. Ve directo al punto.
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

                                        // 1. Enviar respuesta de la IA primero (respeta el entrenamiento del usuario)
                                        if (aiResponseText.trim()) {
                                            await sendWhatsAppMessage(phoneNumber, aiResponseText.trim(), tenantToken, phoneId)
                                            await supabaseAdmin.from('messages').insert({
                                                chat_id: chatId, is_from_me: true, content: aiResponseText.trim(), status: 'delivered'
                                            })
                                        }

                                        // 2. Imagen de Precios Promocionales (configurable desde panel)
                                        await sendWhatsAppImage(
                                            phoneNumber,
                                            tenantPromoImage,
                                            '',
                                            tenantToken,
                                            phoneId
                                        )

                                        // 3. Lista de Planes (sin saludo adicional)
                                        const listBody = `📋 Elige el plan que más te convenga 👇`

                                        const sections = [
                                            {
                                                title: `Planes ${tenantServiceName}`.substring(0, 24),
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
                                        const planListContent = (tenantProducts || []).map(p => `• ${p.name} — Bs ${p.price}`).join('\n')
                                        await supabaseAdmin.from('messages').insert([
                                            { chat_id: chatId, is_from_me: true, content: '', media_url: tenantPromoImage, media_type: 'image', status: 'delivered' },
                                            { chat_id: chatId, is_from_me: true, content: `📋 *Planes Enviados:*\n\n${planListContent}\n\n👆 El cliente puede elegir tocando "Ver Planes"`, status: 'delivered' }
                                        ])

                                        actionExecuted = true
                                        aiResponseText = '' // Ya se envió arriba, no duplicar
                                    }

                                    if (name === 'confirm_plan' && callArgs?.plan_id) {
                                        const productId = callArgs.plan_id as string
                                        const result = await confirmOrder(productId, chatId, phoneNumber, contactName, tenantUserId);
                                        if (result.success && result.product) {
                                            actionExecuted = true;

                                            // Buscar si hay un pedido pending_plan_selection o pending_email con email ya seleccionado
                                            const { data: existingOrder } = await supabaseAdmin
                                                .from('orders')
                                                .select('id, customer_email, status')
                                                .eq('chat_id', chatId)
                                                .in('status', ['pending_email', 'pending_payment', 'pending_plan_selection'])
                                                .order('created_at', { ascending: false })
                                                .limit(1)
                                                .maybeSingle();

                                            // Usar el email del pedido (elegido por el cliente) o el de la suscripción existente
                                            const selectedEmail = existingOrder?.customer_email || existingSub?.correo || '';

                                            if (selectedEmail) {
                                                console.log(`[SALES] Email seleccionado: ${selectedEmail} — auto-procesando`);

                                                // Actualizar el pedido con el email correcto
                                                const { data: latestOrder } = await supabaseAdmin
                                                    .from('orders')
                                                    .select('*')
                                                    .eq('chat_id', chatId)
                                                    .in('status', ['pending_email', 'pending_payment', 'pending_plan_selection'])
                                                    .order('created_at', { ascending: false })
                                                    .limit(1)
                                                    .maybeSingle();

                                                if (latestOrder) {
                                                    await supabaseAdmin.from('orders').update({
                                                        customer_email: selectedEmail,
                                                        status: 'pending_payment',
                                                        updated_at: new Date().toISOString()
                                                    }).eq('id', latestOrder.id);

                                                    // Enviar QR de pago automáticamente
                                                    const { data: qrProduct } = await supabaseAdmin
                                                        .from('products')
                                                        .select('qr_image_url')
                                                        .eq('id', productId)
                                                        .single();

                                                    if (qrProduct?.qr_image_url) {
                                                        const { sendWhatsAppImage } = await import('@/lib/whatsapp');
                                                        await sendWhatsAppImage(
                                                            phoneNumber,
                                                            qrProduct.qr_image_url,
                                                            `📱 *QR de Pago*\n\nPlan: *${result.product.name}*\nMonto: *Bs ${result.product.price}*\nCuenta: *${selectedEmail}*\n\nEscanea este QR para realizar el pago. Una vez hecho, envíame la foto del comprobante. ✅`,
                                                            tenantToken,
                                                            phoneId
                                                        );
                                                    }
                                                }

                                                if (!aiResponseText.trim()) {
                                                    aiResponseText = `¡Excelente elección! 🚀 *${result.product.name}* por *Bs ${result.product.price}* para la cuenta *${selectedEmail}*.`;
                                                }
                                            } else {
                                                // Cliente NUEVO sin correo registrado → pedir email
                                                if (!aiResponseText.trim()) {
                                                    aiResponseText = `¡Excelente elección! 🚀 Has seleccionado el *${result.product.name}* por *Bs ${result.product.price}*.\n\nPara continuar, necesito tu *correo electrónico*. El acceso a *${tenantServiceName}* se enviará directamente a tu email. 📧`
                                                }
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
                                    // Fallback sin saludo hardcodeado — usa el training prompt
                                    aiResponseText = `¿En qué puedo ayudarte? 😊`
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
                                // Capturar el WhatsApp message ID de la respuesta de la API para tracking de status
                                let sentWaId: string | null = null
                                // El resultado del último sendWhatsAppMessage se retorna como data con messages[0].id
                                // Para capturarlo, necesitamos guardar la respuesta del send

                                await supabaseAdmin.from('messages').insert({
                                    chat_id: chatId,
                                    is_from_me: true,
                                    content: aiResponseText,
                                    status: 'sent'
                                })

                                await supabaseAdmin.from('chats').update({
                                    last_message: aiResponseText.substring(0, 100),
                                    last_message_time: new Date().toISOString(),
                                    last_message_status: 'sent'
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

                if (waMessageId && (newStatus === 'sent' || newStatus === 'delivered' || newStatus === 'read')) {
                    // Update message status in DB
                    const { data: updatedMsgs, error: updateErr } = await supabaseAdmin
                        .from('messages')
                        .update({ status: newStatus })
                        .eq('whatsapp_message_id', waMessageId)
                        .select('chat_id')

                    if (!updateErr) {
                        console.log(`[Status] Message ${waMessageId} -> ${newStatus}`)

                        // Also update the chat's last_message_status for sidebar display
                        if (updatedMsgs && updatedMsgs.length > 0) {
                            await supabaseAdmin.from('chats').update({
                                last_message_status: newStatus
                            }).eq('id', updatedMsgs[0].chat_id)
                        }
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
