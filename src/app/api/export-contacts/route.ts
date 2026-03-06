import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: Exportar contactos a Excel
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No token' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const anonClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { user }, error: authError } = await anonClient.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        // Obtener suscripciones
        const { data: subs } = await supabaseAdmin
            .from('subscriptions')
            .select('correo, numero, vencimiento, estado, equipo, plan_name, auto_notify_paused, notified, followup_sent, urgency_sent, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        // Obtener chats con tags
        const { data: chats } = await supabaseAdmin
            .from('chats')
            .select('phone_number, contact_name, tags, last_message_time')
            .eq('user_id', user.id)

        // Crear mapa de chats por teléfono
        const chatMap: Record<string, any> = {}
        for (const chat of chats || []) {
            const clean = (chat.phone_number || '').replace(/\D/g, '')
            chatMap[clean] = chat
            // Also store without 591 prefix
            if (clean.startsWith('591')) chatMap[clean.slice(3)] = chat
        }

        // Construir filas para Excel
        const rows = (subs || []).map(sub => {
            const phone = (sub.numero || '').replace(/\D/g, '')
            const chat = chatMap[phone] || chatMap[phone.startsWith('591') ? phone.slice(3) : phone]
            return {
                'Nombre': chat?.contact_name || '',
                'Teléfono': sub.numero || '',
                'Email/Cuenta': sub.correo || '',
                'Plan': sub.plan_name || '',
                'Estado': sub.estado || '',
                'Vencimiento': sub.vencimiento || '',
                'Equipo': sub.equipo || '',
                'Etiquetas': (chat?.tags || []).join(', '),
                'Notificado': sub.notified ? 'Sí' : 'No',
                'Followup': sub.followup_sent ? 'Sí' : 'No',
                'Urgencia': sub.urgency_sent ? 'Sí' : 'No',
                'Auto-Pausa': sub.auto_notify_paused ? 'Sí' : 'No',
                'Último Mensaje': chat?.last_message_time ? new Date(chat.last_message_time).toLocaleString('es-BO') : '',
                'Registrado': sub.created_at ? new Date(sub.created_at).toLocaleString('es-BO') : ''
            }
        })

        // Generar Excel
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(rows)

        // Auto-width columns
        const colWidths = Object.keys(rows[0] || {}).map(key => ({
            wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] || '').length).slice(0, 50)) + 2
        }))
        ws['!cols'] = colWidths

        XLSX.utils.book_append_sheet(wb, ws, 'Contactos')
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="contactos_${new Date().toISOString().split('T')[0]}.xlsx"`
            }
        })
    } catch (err: any) {
        console.error('[Export] Error:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}
