import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'flow-media'

const ALLOWED_TYPES: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/3gpp', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/mp4'],
    document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
    ],
}

const MAX_SIZE: Record<string, number> = {
    image: 5 * 1024 * 1024,    // 5 MB
    video: 16 * 1024 * 1024,   // 16 MB
    audio: 16 * 1024 * 1024,   // 16 MB
    document: 100 * 1024 * 1024, // 100 MB
}

function detectMediaKind(mimeType: string): string | null {
    for (const [kind, types] of Object.entries(ALLOWED_TYPES)) {
        if (types.includes(mimeType)) return kind
    }
    return null
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        if (!file) {
            return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
        }

        const mimeType = file.type
        const mediaKind = detectMediaKind(mimeType)
        if (!mediaKind) {
            return NextResponse.json({
                error: `Tipo de archivo no permitido (${mimeType}). Usa imágenes, videos, audios o documentos PDF/Word.`
            }, { status: 400 })
        }

        if (file.size > MAX_SIZE[mediaKind]) {
            const maxMB = MAX_SIZE[mediaKind] / (1024 * 1024)
            return NextResponse.json({
                error: `El archivo supera el tamaño máximo de ${maxMB} MB para ${mediaKind}.`
            }, { status: 400 })
        }

        const supabaseAdmin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

        // Crear el bucket si no existe
        const { data: buckets } = await supabaseAdmin.storage.listBuckets()
        if (!buckets?.find(b => b.name === BUCKET)) {
            await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
        }

        // Ruta: flow-media/{userId}/{kind}/{timestamp}-{filename}
        const ext = file.name.split('.').pop() || 'bin'
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `${user.id}/${mediaKind}/${Date.now()}-${safeName}`

        const fileBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                upsert: false,
            })

        if (uploadError) {
            console.error('[flow-media/upload] Supabase error:', uploadError)
            return NextResponse.json({ error: 'Error subiendo el archivo: ' + uploadError.message }, { status: 500 })
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(BUCKET)
            .getPublicUrl(filePath)

        return NextResponse.json({
            url: publicUrl,
            kind: mediaKind,
            filename: file.name,
            ext,
        })
    } catch (error) {
        console.error('[flow-media/upload] Error:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
