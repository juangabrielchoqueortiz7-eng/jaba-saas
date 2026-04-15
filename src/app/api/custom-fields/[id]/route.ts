import { NextResponse } from 'next/server'
import { asRecord } from '@/lib/automation-jobs'
import { createClient } from '@/utils/supabase/server'

type CustomFieldUpdate = Record<string, boolean | string>

// PATCH: Actualizar campo personalizado
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = asRecord(await request.json())
        const updates: CustomFieldUpdate = { updated_at: new Date().toISOString() }

        if (typeof body?.description === 'string') updates.description = body.description
        if (typeof body?.enabled === 'boolean') updates.enabled = body.enabled
        if (typeof body?.field_type === 'string') {
            const validTypes = ['text', 'number', 'date', 'boolean']
            if (!validTypes.includes(body.field_type)) {
                return NextResponse.json({ error: 'Tipo invalido' }, { status: 400 })
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
