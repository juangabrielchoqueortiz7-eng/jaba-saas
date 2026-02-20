
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
                    audio: { link: audioUrl } // WhatsApp descarga el audio del link
                }),
            }
        );
        return await response.json();
    } catch (error) {
        console.error("Excepción enviando audio:", error);
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
