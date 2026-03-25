import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const supabaseAdmin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('access_token, app_id')
            .eq('user_id', user.id)
            .single()

        if (!creds?.access_token || !creds?.app_id) {
            return NextResponse.json({ error: 'Configura el App ID en Ajustes para subir imágenes.' }, { status: 400 })
        }

        // Leer el archivo del form
        const formData = await request.formData()
        const file = formData.get('image') as File | null
        if (!file) {
            return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 })
        }

        const fileBytes = await file.arrayBuffer()
        const fileLength = fileBytes.byteLength
        const fileType = file.type || 'image/jpeg'
        const fileName = file.name || 'template_image.jpg'

        // Paso 1: Crear sesión de subida en Meta
        const sessionRes = await fetch(
            `https://graph.facebook.com/v21.0/${creds.app_id}/uploads?file_length=${fileLength}&file_type=${encodeURIComponent(fileType)}&file_name=${encodeURIComponent(fileName)}&messaging_product=whatsapp`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${creds.access_token}` }
            }
        )
        const sessionData = await sessionRes.json()

        if (sessionData.error) {
            return NextResponse.json({ error: 'Error creando sesión de subida: ' + sessionData.error.message }, { status: 400 })
        }

        const uploadSessionId = sessionData.id
        if (!uploadSessionId) {
            return NextResponse.json({ error: 'No se pudo iniciar la sesión de subida' }, { status: 400 })
        }

        // Paso 2: Subir los bytes del archivo
        const uploadRes = await fetch(
            `https://graph.facebook.com/v21.0/${uploadSessionId}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                    'Content-Type': fileType,
                    'file_offset': '0'
                },
                body: fileBytes
            }
        )
        const uploadData = await uploadRes.json()

        if (uploadData.error) {
            return NextResponse.json({ error: 'Error subiendo imagen: ' + uploadData.error.message }, { status: 400 })
        }

        const handle = uploadData.h
        if (!handle) {
            return NextResponse.json({ error: 'Meta no devolvió el handle de la imagen' }, { status: 400 })
        }

        return NextResponse.json({ handle })
    } catch (err) {
        console.error('[upload-image] Error:', err)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
