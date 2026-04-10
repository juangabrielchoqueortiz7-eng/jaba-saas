import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// PATCH: Actualizar campo personalizado
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const updates: Record<string, any> = { updated_at: new Date().toISOString() }

        if (body.description !== undefined) updates.description = body.description
        if (body.enabled !== undefined) updates.enabled = body.enabled
        if (body.field_type) {
            const validTypes = ['text', 'number', 'date', 'boolean']
            if (!validTypes.includes(body.field_type)) {
                return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
            }
            updates.field_type = body.field_type
        }

        const { data, error } = await supabase
            .from('trigger_variables')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ field: data })
    } catch {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

// DELETE: Eliminar campo personalizado
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { error } = await supabase
            .from('trigger_variables')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
