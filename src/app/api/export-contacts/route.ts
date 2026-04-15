import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { asRecordArray, formatPhone, getString, type AutomationRecord } from '@/lib/automation-jobs'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
)

interface SubscriptionExportRow {
    auto_notify_paused: boolean
    correo: string
    created_at: string
    equipo: string
    estado: string
    followup_sent: boolean
    notified: boolean
    numero: string
    plan_name: string
    urgency_sent: boolean
    vencimiento: string
}

interface ChatExportRow {
    contact_name: string
    last_message_time: string
    phone_number: string
    tags: string[]
}

type ExportSheetRow = {
    'Auto-Pausa': string
    'Email/Cuenta': string
    'Equipo': string
    'Estado': string
    'Etiquetas': string
    'Followup': string
    'Nombre': string
    'Notificado': string
    'Plan': string
    'Registrado': string
    'Teléfono': string
    'Urgencia': string
    'Vencimiento': string
    'Último Mensaje': string
}

function toSubscriptionRows(records: AutomationRecord[]): SubscriptionExportRow[] {
    return records.map(record => ({
        auto_notify_paused: record.auto_notify_paused === true,
        correo: getString(record, 'correo'),
        created_at: getString(record, 'created_at'),
        equipo: getString(record, 'equipo'),
        estado: getString(record, 'estado'),
        followup_sent: record.followup_sent === true,
        notified: record.notified === true,
        numero: getString(record, 'numero'),
        plan_name: getString(record, 'plan_name'),
        urgency_sent: record.urgency_sent === true,
        vencimiento: getString(record, 'vencimiento'),
    }))
}

function toChatRows(records: AutomationRecord[]): ChatExportRow[] {
    return records.map(record => ({
        contact_name: getString(record, 'contact_name'),
        last_message_time: getString(record, 'last_message_time'),
        phone_number: getString(record, 'phone_number'),
        tags: Array.isArray(record.tags)
            ? record.tags.filter((tag): tag is string => typeof tag === 'string')
            : [],
    }))
}

function formatLocalizedDate(value: string): string {
    return value ? new Date(value).toLocaleString('es-BO') : ''
}

function extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Internal error'
}

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
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { user }, error: authError } = await anonClient.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const batchSize = 1000
        let subscriptions: SubscriptionExportRow[] = []
        let page = 0

        while (true) {
            const { data: batchRows } = await supabaseAdmin
                .from('subscriptions')
                .select('correo, numero, vencimiento, estado, equipo, plan_name, auto_notify_paused, notified, followup_sent, urgency_sent, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(page * batchSize, (page + 1) * batchSize - 1)

            const batch = toSubscriptionRows(asRecordArray(batchRows))
            if (batch.length === 0) break
            subscriptions = subscriptions.concat(batch)
            if (batch.length < batchSize) break
            page++
        }

        let chats: ChatExportRow[] = []
        page = 0

        while (true) {
            const { data: batchRows } = await supabaseAdmin
                .from('chats')
                .select('phone_number, contact_name, tags, last_message_time')
                .eq('user_id', user.id)
                .range(page * batchSize, (page + 1) * batchSize - 1)

            const batch = toChatRows(asRecordArray(batchRows))
            if (batch.length === 0) break
            chats = chats.concat(batch)
            if (batch.length < batchSize) break
            page++
        }

        const chatMap: Record<string, ChatExportRow> = {}
        for (const chat of chats) {
            const cleanPhone = chat.phone_number.replace(/\D/g, '')
            if (!cleanPhone) continue
            chatMap[cleanPhone] = chat
            if (cleanPhone.startsWith('591')) {
                chatMap[cleanPhone.slice(3)] = chat
            }
        }

        const rows: ExportSheetRow[] = subscriptions.map(subscription => {
            const phone = subscription.numero.replace(/\D/g, '')
            const normalizedPhone = formatPhone(subscription.numero, '591').replace(/^591/, '')
            const chat = chatMap[phone] || chatMap[normalizedPhone]

            return {
                'Nombre': chat?.contact_name || '',
                'Teléfono': subscription.numero || '',
                'Email/Cuenta': subscription.correo || '',
                'Plan': subscription.plan_name || '',
                'Estado': subscription.estado || '',
                'Vencimiento': subscription.vencimiento || '',
                'Equipo': subscription.equipo || '',
                'Etiquetas': (chat?.tags || []).join(', '),
                'Notificado': subscription.notified ? 'Sí' : 'No',
                'Followup': subscription.followup_sent ? 'Sí' : 'No',
                'Urgencia': subscription.urgency_sent ? 'Sí' : 'No',
                'Auto-Pausa': subscription.auto_notify_paused ? 'Sí' : 'No',
                'Último Mensaje': formatLocalizedDate(chat?.last_message_time || ''),
                'Registrado': formatLocalizedDate(subscription.created_at),
            }
        })

        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet(rows)

        const colWidths = Object.keys(rows[0] || {}).map(key => ({
            wch: Math.max(
                key.length,
                ...rows.map(row => String(row[key as keyof ExportSheetRow] || '').length),
            ) + 2,
        }))
        worksheet['!cols'] = colWidths

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contactos')
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="contactos_${new Date().toISOString().split('T')[0]}.xlsx"`,
            },
        })
    } catch (error) {
        console.error('[Export] Error:', error)
        return NextResponse.json({ error: extractErrorMessage(error) }, { status: 500 })
    }
}
