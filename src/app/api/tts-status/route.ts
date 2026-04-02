import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * GET /api/tts-status
 *
 * Tests whether Google Cloud Text-to-Speech is reachable and the API key
 * has the "Cloud Text-to-Speech API" service enabled.
 *
 * Returns:
 *   { ok: true }  — TTS is working
 *   { ok: false, error: string, hint?: string }  — TTS is not working
 */
export async function GET() {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
        return NextResponse.json({
            ok: false,
            error: 'GOOGLE_API_KEY no está configurado en el servidor.',
            hint: 'Agrega la variable GOOGLE_API_KEY en tu .env.local y en las variables de entorno de Vercel.',
        })
    }

    try {
        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text: 'Hola' },
                voice: { languageCode: 'es-US', name: 'es-US-Neural2-A' },
                audioConfig: { audioEncoding: 'MP3' },
            }),
            // Short timeout — we just want to test reachability
            signal: AbortSignal.timeout(8000),
        })

        const data = await res.json()

        if (!res.ok) {
            const code    = data?.error?.code    ?? res.status
            const message = data?.error?.message ?? 'Error desconocido'
            const status  = data?.error?.status  ?? ''

            let hint: string | undefined
            if (code === 403) {
                hint = 'El GOOGLE_API_KEY no tiene habilitado "Cloud Text-to-Speech API". Ve a Google Cloud Console → APIs y servicios → Biblioteca y actívalo para tu proyecto.'
            } else if (code === 400) {
                hint = 'Petición inválida. Verifica que el API key sea correcto y pertenezca a un proyecto de Google Cloud activo.'
            } else if (code === 429) {
                hint = 'Cuota de TTS agotada. Revisa los límites de tu proyecto en Google Cloud Console.'
            }

            return NextResponse.json({ ok: false, error: `${code} — ${status}: ${message}`, hint })
        }

        if (!data.audioContent) {
            return NextResponse.json({
                ok: false,
                error: 'La API respondió OK pero no devolvió audioContent.',
                hint: 'Esto es inesperado. Verifica los logs del servidor para más detalles.',
            })
        }

        return NextResponse.json({ ok: true })

    } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout')
        return NextResponse.json({
            ok: false,
            error: isTimeout ? 'Tiempo de espera agotado al conectar con Google TTS.' : (err.message || 'Error de red'),
            hint: isTimeout ? 'El servidor no pudo alcanzar texttospeech.googleapis.com. Revisa la conectividad de red de Vercel.' : undefined,
        })
    }
}
