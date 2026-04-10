import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (parts) return new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]))
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
}

function toDateStr(date: Date): string {
    return date.toISOString().split('T')[0]
}

function resolveParam(value: string, data: Record<string, any>): string {
    const todayStr = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const nowStr = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

    return value
        .replace(/\{\{contact\.name\}\}/g, data.contact_name || data.correo || data.numero || '')
        .replace(/\{\{contact\.phone\}\}/g, data.phone_number || data.numero || '')
        .replace(/\{\{business\.name\}\}/g, data.business_name || data.service_name || data.bot_name || '')
        .replace(/\{\{subscription\.expires_at\}\}/g, data.vencimiento || '')
        .replace(/\{\{subscription\.service\}\}/g, data.servicio || data.equipo || '')
        .replace(/\{\{subscription\.plan\}\}/g, data.plan_name || data.servicio || '')
        .replace(/\{\{subscription\.email\}\}/g, data.correo || '')
        .replace(/\{\{custom\.(\w+)\}\}/g, (_, field) => String(data.custom_fields?.[field] ?? ''))
        .replace(/\{\{today\}\}/g, todayStr)
        .replace(/\{\{now\}\}/g, nowStr)
        .replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, key) => {
            const parts = key.split('.')
            let val: any = data
            for (const p of parts) { val = val?.[p] }
            return typeof val === 'string' ? val : ''
        })
}

function formatPhone(phone: string, countryCode: string): string {
    const clean = (phone || '').replace(/\D/g, '')
    return clean.startsWith(countryCode) ? clean : countryCode + clean
}

// POST: Ejecutar una automatización individual manualmente
export async function POST(request: Request) {
    try {
        // Verificar autenticación del usuario via cookie/session
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const token = authHeader.slice(7)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
        }

        const { jobId } = await request.json()
        if (!jobId) {
            return NextResponse.json({ error: 'Falta jobId' }, { status: 400 })
        }

        // Obtener el job y verificar que pertenece al usuario
        const { data: job, error: jobError } = await supabaseAdmin
            .from('automation_jobs')
            .select('*')
            .eq('id', jobId)
            .eq('user_id', user.id)
            .single()

        if (jobError || !job) {
            return NextResponse.json({ error: 'Automatización no encontrada' }, { status: 404 })
        }

        // Obtener credenciales WhatsApp
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id, country_code')
            .eq('user_id', user.id)
            .single()

        if (!creds?.access_token || !creds?.phone_number_id) {
            return NextResponse.json({ error: 'Sin credenciales de WhatsApp configuradas' }, { status: 400 })
        }

        const now = new Date()
        const targetType = job.target_type || 'subscriptions_expiring'
        const tenantCC = creds.country_code || '591'
        let recipients: Array<{ phone: string; data: Record<string, any> }> = []

        // Obtener destinatarios según tipo
        if (targetType === 'subscriptions_expiring') {
            const targetDate = new Date(now)
            targetDate.setDate(targetDate.getDate() + (job.trigger_days_before ?? 0))
            const targetDateStr = toDateStr(targetDate)

            const { data: subs } = await supabaseAdmin
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('estado', 'ACTIVO')

            recipients = (subs || []).filter(sub => {
                const phone = (sub.numero || '').replace(/\D/g, '')
                if (phone.length < 8) return false
                const expDate = parseDate(sub.vencimiento)
                if (!expDate) return false
                return toDateStr(expDate) === targetDateStr
            }).map(sub => ({
                phone: formatPhone(sub.numero, tenantCC),
                data: sub,
            }))
        } else if (targetType === 'all_contacts') {
            const { data: chats } = await supabaseAdmin
                .from('chats')
                .select('phone_number, contact_name, custom_fields')
                .eq('user_id', user.id)

            recipients = (chats || []).map(c => ({
                phone: formatPhone(c.phone_number, tenantCC),
                data: { contact_name: c.contact_name, phone_number: c.phone_number, numero: c.phone_number, custom_fields: c.custom_fields || {} },
            }))
        } else if (targetType === 'tagged_contacts') {
            const tags: string[] = (job.target_config || {}).tags || []
            if (tags.length === 0) {
                return NextResponse.json({ error: 'No hay etiquetas configuradas', sent: 0, failed: 0 })
            }

            const { data: chats } = await supabaseAdmin
                .from('chats')
                .select('phone_number, contact_name, tags, custom_fields')
                .eq('user_id', user.id)
                .overlaps('tags', tags)

            recipients = (chats || []).map(c => ({
                phone: formatPhone(c.phone_number, tenantCC),
                data: { contact_name: c.contact_name, phone_number: c.phone_number, numero: c.phone_number, custom_fields: c.custom_fields || {} },
            }))
        }

        if (recipients.length === 0) {
            return NextResponse.json({
                message: 'No hay destinatarios que coincidan con los criterios',
                sent: 0,
                failed: 0,
                recipients: 0,
            })
        }

        // Enviar a todos los destinatarios
        const params: { label: string; value: string }[] = job.template_params || []
        let sent = 0, failed = 0

        for (const { phone, data } of recipients) {
            if (!phone || phone.length < 8) { failed++; continue }
            try {
                const bodyParameters = params.map(p => ({
                    type: 'text' as const,
                    text: resolveParam(p.value, data),
                }))
                const components = bodyParameters.length > 0
                    ? [{ type: 'body', parameters: bodyParameters }]
                    : []

                const result = await sendWhatsAppTemplate(
                    phone, job.template_name, 'es', components,
                    creds.access_token, creds.phone_number_id
                )
                if (result) sent++
                else failed++
                await delay(1500)
            } catch {
                failed++
            }
        }

        // Actualizar last_run_at
        await supabaseAdmin
            .from('automation_jobs')
            .update({ last_run_at: now.toISOString() })
            .eq('id', job.id)

        return NextResponse.json({
            message: `Enviado: ${sent}, Fallido: ${failed}`,
            sent,
            failed,
            recipients: recipients.length,
        })
    } catch (error: any) {
        console.error('[RunSingleAutomation] Error:', error)
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
}
