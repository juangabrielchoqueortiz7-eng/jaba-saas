import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    try {
        // Verificar sesión del usuario
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // Obtener credenciales WhatsApp del usuario
        const supabaseAdmin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id, waba_id')
            .eq('user_id', user.id)
            .single()

        if (!creds?.access_token) {
            return NextResponse.json({ error: 'No hay credenciales de WhatsApp configuradas' }, { status: 400 })
        }

        if (!creds?.waba_id) {
            return NextResponse.json({
                error: 'Falta el ID de cuenta de WhatsApp Business (WABA ID). Ve a Configuración → Conexión y completa el campo "Id. cuenta de WhatsApp Business".'
            }, { status: 400 })
        }

        // Obtener plantillas del WABA directamente
        const templatesRes = await fetch(
            `https://graph.facebook.com/v21.0/${creds.waba_id}/message_templates?limit=100&fields=id,name,status,category,language,components`,
            { headers: { Authorization: `Bearer ${creds.access_token}` } }
        )
        const templatesData = await templatesRes.json()

        if (templatesData.error) {
            return NextResponse.json({ error: 'Error al obtener plantillas de Meta: ' + templatesData.error.message }, { status: 400 })
        }

        return NextResponse.json({ templates: templatesData.data || [] })
    } catch (err) {
        console.error('[meta-templates] Error:', err)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

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
            .select('access_token, waba_id')
            .eq('user_id', user.id)
            .single()

        if (!creds?.access_token || !creds?.waba_id) {
            return NextResponse.json({ error: 'Configura el WABA ID en Ajustes antes de crear plantillas.' }, { status: 400 })
        }

        const body = await request.json()
        const { name, category, language, components } = body

        if (!name || !category || !language || !components) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        const res = await fetch(
            `https://graph.facebook.com/v21.0/${creds.waba_id}/message_templates`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, category, language, components })
            }
        )
        const data = await res.json()

        if (data.error) {
            return NextResponse.json({ error: data.error.message || 'Error de Meta' }, { status: 400 })
        }

        return NextResponse.json({ success: true, template: data })
    } catch (err) {
        console.error('[meta-templates POST] Error:', err)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
