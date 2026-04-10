import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET: Listar campos personalizados del usuario
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('trigger_variables')
            .select('*')
            .eq('user_id', user.id)
            .eq('category', 'custom')
            .order('field_name', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ fields: data || [] })
    } catch {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

// POST: Crear campo personalizado
export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { field_name, field_type, description } = body

        // Validar nombre: solo letras minúsculas, números y guion bajo
        if (!field_name || !/^[a-z][a-z0-9_]*$/.test(field_name)) {
            return NextResponse.json(
                { error: 'El nombre del campo debe empezar con letra minúscula y solo contener letras, números y guion bajo (ej: fecha_cita, tipo_plan)' },
                { status: 400 }
            )
        }

        if (field_name.length > 50) {
            return NextResponse.json({ error: 'El nombre no puede tener más de 50 caracteres' }, { status: 400 })
        }

        // Validar tipo
        const validTypes = ['text', 'number', 'date', 'boolean']
        if (!field_type || !validTypes.includes(field_type)) {
            return NextResponse.json({ error: `Tipo inválido. Debe ser: ${validTypes.join(', ')}` }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('trigger_variables')
            .insert({
                user_id: user.id,
                field_name,
                field_type,
                category: 'custom',
                description: description || null,
                enabled: true,
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: `Ya existe un campo con el nombre "${field_name}"` }, { status: 409 })
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ field: data }, { status: 201 })
    } catch {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
