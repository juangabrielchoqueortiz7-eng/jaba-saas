
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODELS = ['gemini-2.0-flash'];

interface RetryableApiError {
    message?: string;
    status?: number;
}

function isRateLimitError(error: unknown): error is RetryableApiError {
    return typeof error === 'object'
        && error !== null
        && (
            ('message' in error && typeof error.message === 'string' && error.message.includes('429'))
            || ('status' in error && error.status === 429)
        );
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return JSON.stringify(error);
}

function getConfiguredGeminiModels(): string[] {
    const configuredModel = process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    return [configuredModel, DEFAULT_GEMINI_MODEL, ...FALLBACK_GEMINI_MODELS]
        .filter((model, index, models) => model && models.indexOf(model) === index);
}

function isMissingModelError(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes('404')
        || message.includes('not found')
        || message.includes('not supported')
        || message.includes('is not found');
}

export async function generateAIResponse(userMessage: string, systemPrompt?: string): Promise<string> {
    if (!apiKey) {
        console.error("GOOGLE_API_KEY no está configurada");
        return "Lo siento, tengo un problema de configuración. Contacta al administrador.";
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `
      ${systemPrompt || 'Eres un asistente amable.'}
      
      Mensaje del usuario:
      "${userMessage}"
    `;

    for (const modelName of getConfiguredGeminiModels()) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            if (isMissingModelError(error)) {
                console.warn(`[AI] Modelo Gemini no disponible (${modelName}). Probando fallback...`);
                continue;
            }

            console.error("Error generando respuesta de AI:", error);
            return "Lo siento, no puedo procesar tu mensaje en este momento.";
        }
    }

    return "Lo siento, el modelo de IA configurado no esta disponible en este momento.";
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
                model: DEFAULT_GEMINI_MODEL,
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
        } catch (error: unknown) {
            const isRateLimit = isRateLimitError(error);

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
            return `Error: ${getErrorMessage(error)}`;
        }
    }
    return "Error desconocido después de reintentar.";
}

// Función para generar Audio (TTS) usando Google Cloud Text-to-Speech
// Nota: Usamos la API REST directa para no depender de librerías extra pesadas por ahora.
// Se requiere GOOGLE_API_KEY con permisos de Cloud Text-to-Speech API.

export async function generateAudio(text: string, voiceId: string = 'es-US-Neural2-A'): Promise<string | null> {
    if (!apiKey) {
        console.error('[TTS] GOOGLE_API_KEY no está configurado — el audio no funcionará.');
        return null;
    }

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

        if (!response.ok) {
            const errorCode    = data?.error?.code    ?? response.status;
            const errorMessage = data?.error?.message ?? 'Respuesta no OK';
            const errorStatus  = data?.error?.status  ?? '';
            console.error(`[TTS] HTTP ${errorCode} — ${errorStatus}: ${errorMessage}`);
            if (errorCode === 403) {
                console.error('[TTS] ⚠️  Probablemente el GOOGLE_API_KEY no tiene habilitado el servicio "Cloud Text-to-Speech API". Habilítalo en Google Cloud Console → APIs y servicios → Biblioteca.');
            }
            return null;
        }

        if (data.audioContent) {
            return data.audioContent; // Base64 string
        } else {
            console.error('[TTS] Respuesta OK pero sin audioContent:', JSON.stringify(data));
            return null;
        }

    } catch (error) {
        console.error('[TTS] Error de red al llamar Google TTS:', error);
        return null;
    }
}
