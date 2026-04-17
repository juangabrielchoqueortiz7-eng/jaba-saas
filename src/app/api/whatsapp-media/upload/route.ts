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
            .select('access_token, phone_number_id')
            .eq('user_id', user.id)
            .single()

        if (!creds?.access_token || !creds?.phone_number_id) {
            return NextResponse.json({ error: 'Configura tus credenciales de WhatsApp antes de subir archivos.' }, { status: 400 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        if (!file) {
            return NextResponse.json({ error: 'No se recibio ningun archivo' }, { status: 400 })
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Por ahora las automatizaciones aceptan imagenes para el encabezado.' }, { status: 400 })
        }

        const metaForm = new FormData()
        metaForm.append('messaging_product', 'whatsapp')
        metaForm.append('type', file.type)
        metaForm.append('file', file, file.name || 'automation-header.jpg')

        const uploadRes = await fetch(
            `https://graph.facebook.com/v21.0/${creds.phone_number_id}/media`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${creds.access_token}` },
                body: metaForm,
            },
        )
        const uploadData = await uploadRes.json()

        if (!uploadRes.ok || uploadData.error) {
            return NextResponse.json({
                error: uploadData.error?.message || 'Meta no pudo subir la imagen',
            }, { status: 400 })
        }

        if (!uploadData.id) {
            return NextResponse.json({ error: 'Meta no devolvio el identificador de la imagen' }, { status: 400 })
        }

        return NextResponse.json({ mediaId: uploadData.id })
    } catch (error) {
        console.error('[whatsapp-media/upload] Error:', error)
        return NextResponse.json({ error: 'Error interno subiendo imagen' }, { status: 500 })
    }
}
