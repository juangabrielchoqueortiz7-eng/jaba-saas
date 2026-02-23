
/**
 * Envía un mensaje de texto a un usuario de WhatsApp mediante la Graph API de Meta.
 * @param to Número de teléfono del destinatario (con código de país, sin signos +)
 * @param body Texto del mensaje a enviar
 * @param token (Opcional) Token de acceso. Si no se da, usa ENV.
 * @param phoneNumberId (Opcional) ID del teléfono emisor. Si no se da, usa ENV.
 * @returns Respuesta de la API de Meta
 */
export async function sendWhatsAppMessage(to: string, body: string, token?: string, phoneNumberId?: string) {
    const apiToken = token || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) {
        console.error("ERROR: Faltan credenciales (Token o PhoneID) para enviar mensaje.");
        return null;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: to,
                    text: { body: body },
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Error enviando mensaje a WhatsApp:", JSON.stringify(data, null, 2));
            return null;
        }

        return data;
    } catch (error) {
        console.error("Excepción enviando mensaje:", error);
        return null;
    }
}

export async function sendWhatsAppAudio(to: string, audioUrl: string, token?: string, phoneNumberId?: string) {
    const apiToken = token || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) return null;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: to,
                    type: "audio",
                    audio: { link: audioUrl }
                }),
            }
        );
        return await response.json();
    } catch (error) {
        console.error("Excepción enviando audio:", error);
        return null;
    }
}

/**
 * Envía una imagen a un usuario de WhatsApp mediante la Graph API de Meta.
 * @param to Número de teléfono del destinatario
 * @param imageUrl URL pública de la imagen
 * @param caption Texto opcional debajo de la imagen
 * @param token Token de acceso
 * @param phoneNumberId ID del teléfono emisor
 */
export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string, token?: string, phoneNumberId?: string) {
    const apiToken = token || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) {
        console.error("ERROR: Faltan credenciales para enviar imagen.");
        return null;
    }

    try {
        const imagePayload: Record<string, string> = { link: imageUrl };
        if (caption) imagePayload.caption = caption;

        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: to,
                    type: "image",
                    image: imagePayload
                }),
            }
        );

        const data = await response.json();
        if (!response.ok) {
            console.error("Error enviando imagen a WhatsApp:", JSON.stringify(data, null, 2));
            return null;
        }
        return data;
    } catch (error) {
        console.error("Excepción enviando imagen:", error);
        return null;
    }
}

/**
 * Envía un video a un usuario de WhatsApp mediante la Graph API de Meta.
 * @param to Número de teléfono del destinatario
 * @param videoUrl URL pública del video (máximo 16MB recomendado para envío rápido)
 * @param caption Texto opcional debajo del video
 * @param token Token de acceso
 * @param phoneNumberId ID del teléfono emisor
 */
export async function sendWhatsAppVideo(to: string, videoUrl: string, caption?: string, token?: string, phoneNumberId?: string) {
    const apiToken = token || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) {
        console.error("ERROR: Faltan credenciales para enviar video.");
        return null;
    }

    try {
        const videoPayload: Record<string, string> = {};
        // Si no empieza con http, asumimos que es un media_id
        if (videoUrl.startsWith('http')) {
            videoPayload.link = videoUrl;
        } else {
            videoPayload.id = videoUrl;
        }
        if (caption) videoPayload.caption = caption;

        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: to,
                    type: "video",
                    video: videoPayload
                }),
            }
        );

        const data = await response.json();
        if (!response.ok) {
            console.error("Error enviando video a WhatsApp:", JSON.stringify(data, null, 2));
            return null;
        }
        return data;
    } catch (error) {
        console.error("Excepción enviando video:", error);
        return null;
    }
}

/**
 * Sube un archivo local a WhatsApp y retorna su media_id
 */
export async function uploadMediaToWhatsApp(phoneId: string, token: string, filePath: string, mimeType: string): Promise<string | null> {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: mimeType });

        const formData = new FormData();
        formData.append('messaging_product', 'whatsapp');
        formData.append('file', blob, path.basename(filePath));

        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/media`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("Error subiendo media a WhatsApp:", JSON.stringify(data, null, 2));
            return null;
        }
        return data.id; // Retorna el media_id
    } catch (error) {
        console.error("Excepción subiendo media:", error);
        return null;
    }
}

export async function getWhatsAppMediaUrl(mediaId: string, token: string): Promise<string | null> {
    try {
        // 1. Obtener URL de descarga
        const response = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        return data.url || null; // URL temporal de descarga
    } catch (error) {
        console.error("Error obteniendo URL de media:", error);
        return null;
    }
}

export async function downloadWhatsAppMedia(url: string, token: string): Promise<ArrayBuffer | null> {
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return await response.arrayBuffer();
    } catch (error) {
        console.error("Error descargando media:", error);
        return null;
    }
}

/**
 * Envía un mensaje interactivo con botones a un usuario de WhatsApp.
 * @param to Número de teléfono
 * @param body Texto del mensaje
 * @param buttons Lista de botones (máximo 3) [{ id: 'btn1', title: 'Botón 1' }]
 * @param token Token de acceso
 * @param phoneNumberId ID del teléfono
 */
export async function sendWhatsAppButtons(to: string, body: string, buttons: { id: string, title: string }[], token?: string, phoneNumberId?: string) {
    const apiToken = token || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) return null;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: to,
                    type: "interactive",
                    interactive: {
                        type: "button",
                        body: { text: body },
                        action: {
                            buttons: buttons.map(btn => ({
                                type: "reply",
                                reply: { id: btn.id, title: btn.title }
                            }))
                        }
                    }
                }),
            }
        );
        return await response.json();
    } catch (error) {
        console.error("Excepción enviando botones:", error);
        return null;
    }
}

/**
 * Envía un mensaje interactivo con una lista a un usuario de WhatsApp.
 * @param to Número de teléfono
 * @param body Texto del mensaje
 * @param buttonText Texto del botón de la lista
 * @param sections Secciones y filas de la lista
 */
export async function sendWhatsAppList(to: string, body: string, buttonText: string, sections: any[], token?: string, phoneNumberId?: string) {
    const apiToken = token || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) return null;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: to,
                    type: "interactive",
                    interactive: {
                        type: "list",
                        body: { text: body },
                        action: {
                            button: buttonText,
                            sections: sections
                        }
                    }
                }),
            }
        );
        return await response.json();
    } catch (error) {
        console.error("Excepción enviando lista:", error);
        return null;
    }
}

/**
 * Envía una plantilla oficial de Meta.
 * @param to Número de teléfono
 * @param templateName Nombre de la plantilla aprobada en Meta
 * @param languageCode Código de idioma (ej: 'es')
 * @param components Parámetros dinámicos para la plantilla
 */
export async function sendWhatsAppTemplate(to: string, templateName: string, languageCode: string = 'es', components: any[] = [], token?: string, phoneNumberId?: string) {
    const apiToken = token || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) return null;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: to,
                    type: "template",
                    template: {
                        name: templateName,
                        language: { code: languageCode },
                        components: components
                    }
                }),
            }
        );
        return await response.json();
    } catch (error) {
        console.error("Excepción enviando plantilla:", error);
        return null;
    }
}
