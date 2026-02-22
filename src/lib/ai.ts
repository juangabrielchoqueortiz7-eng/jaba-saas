
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

export async function generateAIResponse(userMessage: string, systemPrompt?: string): Promise<string> {
    if (!apiKey) {
        console.error("GOOGLE_API_KEY no está configurada");
        return "Lo siento, tengo un problema de configuración. Contacta al administrador.";
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // Prompt enriquecido con el System Prompt del usuario
        const prompt = `
      ${systemPrompt || 'Eres un asistente amable.'}
      
      Mensaje del usuario:
      "${userMessage}"
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return text;
    } catch (error) {
        console.error("Error generando respuesta de AI:", error);
        return "Lo siento, no puedo procesar tu mensaje en este momento.";
    }
}

// New function for Chat Simulator with History
export async function generateChatResponse(history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessage: string, systemPrompt: string): Promise<string> {
    if (!apiKey) {
        console.error("GOOGLE_API_KEY no configurada");
        return "Error: API Key no configurada.";
    }

    // Retry logic for 429 errors
    let attempt = 0;
    const maxRetries = 3;
    const initialDelay = 1000;

    while (attempt < maxRetries) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-pro",
                systemInstruction: systemPrompt
            });

            const chat = model.startChat({
                history: history,
                generationConfig: {
                    maxOutputTokens: 500,
                },
            });

            const result = await chat.sendMessage(newMessage);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            const isRateLimit = error.message?.includes('429') || error.status === 429;

            if (isRateLimit && attempt < maxRetries - 1) {
                attempt++;
                const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
                console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            console.error("Error en chat simulation:", error);
            if (isRateLimit) {
                return "Estoy recibiendo muchas solicitudes. Por favor, espera unos segundos e inténtalo de nuevo. (Error 429)";
            }
            return `Error: ${error.message || JSON.stringify(error)}`;
        }
    }
    return "Error desconocido después de reintentar.";
}

// Función para generar Audio (TTS) usando Google Cloud Text-to-Speech
// Nota: Usamos la API REST directa para no depender de librerías extra pesadas por ahora.
// Se requiere GOOGLE_API_KEY con permisos de Cloud Text-to-Speech API.

export async function generateAudio(text: string, voiceId: string = 'es-US-Neural2-A'): Promise<string | null> {
    if (!apiKey) return null;

    try {
        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

        const requestBody = {
            input: { text: text },
            voice: { languageCode: 'es-US', name: voiceId },
            audioConfig: { audioEncoding: 'MP3' }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.audioContent) {
            return data.audioContent; // Base64 string
        } else {
            console.error("Google TTS Error:", JSON.stringify(data));
            return null;
        }

    } catch (error) {
        console.error("Error generando audio TTS:", error);
        return null;
    }
}
