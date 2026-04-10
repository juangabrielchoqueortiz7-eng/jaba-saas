import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'
import { getLocalTime } from '@/lib/timezone-utils'

function timingSafeCompare(a: string, b: string): boolean {
    try {
        const bA = Buffer.from(a), bB = Buffer.from(b)
        if (bA.length !== bB.length) return false
        const { timingSafeEqual } = require('crypto')
        return timingSafeEqual(bA, bB)
    } catch { return false }
}

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (parts) {
        return new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]))
    }
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
}

function toDateStr(date: Date): string {
    return date.toISOString().split('T')[0]
}

// Resolver variables dinámicas en los parámetros de la plantilla
// Funciona tanto con datos de suscripción como con datos de contacto/chat
function resolveParam(value: string, data: Record<string, any>): string {
    const todayStr = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const nowStr = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

    return value
        // Variables de contacto (genéricas — disponibles para cualquier negocio)
        .replace(/\{\{contact\.name\}\}/g, data.contact_name || data.correo || data.numero || '')
        .replace(/\{\{contact\.phone\}\}/g, data.phone_number || data.numero || '')
        // Variables de negocio
        .replace(/\{\{business\.name\}\}/g, data.business_name || data.service_name || data.bot_name || '')
        // Variables de suscripción (para negocios que las usan)
        .replace(/\{\{subscription\.expires_at\}\}/g, data.vencimiento || '')
        .replace(/\{\{subscription\.service\}\}/g, data.servicio || data.equipo || '')
        .replace(/\{\{subscription\.plan\}\}/g, data.plan_name || data.servicio || '')
        .replace(/\{\{subscription\.email\}\}/g, data.correo || '')
        // Campos personalizados: {{custom.CAMPO}}
        .replace(/\{\{custom\.(\w+)\}\}/g, (_, field) => String(data.custom_fields?.[field] ?? ''))
        // Variables de fecha/hora
        .replace(/\{\{today\}\}/g, todayStr)
        .replace(/\{\{now\}\}/g, nowStr)
        // Variable genérica catch-all
        .replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, key) => {
            const parts = key.split('.')
            let val: any = data
            for (const p of parts) { val = val?.[p] }
            return typeof val === 'string' ? val : ''
        })
}

// =============================================
// GET: Llamado por Vercel Cron una vez al día (13:00 UTC)
// Procesa TODOS los automation_jobs activos cuya hora local coincida.
// Soporta 3 tipos de audiencia:
//   - subscriptions_expiring: suscripciones por vencer en X días
//   - all_contacts: todos los contactos/chats del usuario
//   - tagged_contacts: contactos con tags específicos
// =============================================
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || !timingSafeCompare(authHeader ?? '', `Bearer ${cronSecret}`)) {
        console.log('[RunAutomations] Unauthorized access attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    console.log(`[RunAutomations] Starting at ${now.toISOString()}`)

    try {
        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from('automation_jobs')
            .select('*')
            .eq('is_active', true)

        if (jobsError) {
            console.error('[RunAutomations] Error fetching jobs:', jobsError)
            return NextResponse.json({ error: 'DB error' }, { status: 500 })
        }

        if (!jobs || jobs.length === 0) {
            console.log('[RunAutomations] No active automation jobs')
            return NextResponse.json({ ran: 0, skipped: 0, sent: 0, failed: 0 })
        }

        console.log(`[RunAutomations] Found ${jobs.length} active jobs`)
        const stats = { ran: 0, skipped: 0, sent: 0, failed: 0 }

        for (const job of jobs) {
            const localTime = getLocalTime(job.timezone || 'America/La_Paz', now)
            if (localTime.hour !== job.hour) {
                stats.skipped++
                continue
            }

            // Evitar doble ejecución: si ya corrió hoy en la zona horaria del job, saltar
            if (job.last_run_at) {
                const tz = job.timezone || 'America/La_Paz'
                const todayLocal = now.toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
                const lastRunLocal = new Date(job.last_run_at).toLocaleDateString('en-CA', { timeZone: tz })
                if (todayLocal === lastRunLocal) {
                    console.log(`[RunAutomations] Skipping "${job.name}" — ya ejecutado hoy (${todayLocal})`)
                    stats.skipped++
                    continue
                }
            }

            const targetType = job.target_type || 'subscriptions_expiring'
            console.log(`[RunAutomations] Executing "${job.name}" (type: ${targetType}, user: ${job.user_id})`)
            stats.ran++

            try {
                const jobStats = await executeJob(job, now)
                stats.sent += jobStats.sent
                stats.failed += jobStats.failed

                await supabaseAdmin
                    .from('automation_jobs')
                    .update({ last_run_at: now.toISOString() })
                    .eq('id', job.id)
            } catch (err) {
                console.error(`[RunAutomations] Job ${job.id} failed:`, err)
                stats.failed++
            }
        }

        console.log(`[RunAutomations] Done — ran: ${stats.ran}, skipped: ${stats.skipped}, sent: ${stats.sent}, failed: ${stats.failed}`)
        return NextResponse.json(stats)
    } catch (error) {
        console.error('[RunAutomations] Fatal error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// =============================================
// Ejecutar un job según su target_type
// =============================================
async function executeJob(job: any, now: Date): Promise<{ sent: number; failed: number }> {
    const creds = await getCredentials(job.user_id)
    if (!creds) return { sent: 0, failed: 0 }

    const targetType = job.target_type || 'subscriptions_expiring'

    switch (targetType) {
        case 'subscriptions_expiring':
            return await executeSubscriptionJob(job, now, creds)
        case 'all_contacts':
            return await executeAllContactsJob(job, creds)
        case 'tagged_contacts':
            return await executeTaggedContactsJob(job, creds)
        default:
            console.warn(`[RunAutomations] Unknown target_type: ${targetType}`)
            return { sent: 0, failed: 0 }
    }
}

async function getCredentials(userId: string) {
    const { data } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id, country_code')
        .eq('user_id', userId)
        .single()
    if (!data?.access_token || !data?.phone_number_id) {
        console.log(`[RunAutomations] No WhatsApp credentials for user ${userId}`)
        return null
    }
    return data
}

// ── TARGET: Suscripciones por vencer ──────────────────────────────────────
async function executeSubscriptionJob(job: any, now: Date, creds: any): Promise<{ sent: number; failed: number }> {
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + (job.trigger_days_before ?? 0))
    const targetDateStr = toDateStr(targetDate)
    const tenantCC = creds.country_code || '591'

    const { data: subscriptions } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', job.user_id)
        .eq('estado', 'ACTIVO')

    if (!subscriptions?.length) return { sent: 0, failed: 0 }

    const candidates = subscriptions.filter(sub => {
        const phone = (sub.numero || '').replace(/\D/g, '')
        if (phone.length < 8) return false
        const expDate = parseDate(sub.vencimiento)
        if (!expDate) return false
        return toDateStr(expDate) === targetDateStr
    })

    if (!candidates.length) {
        console.log(`[RunAutomations] "${job.name}": 0 subs expiring on ${targetDateStr}`)
        return { sent: 0, failed: 0 }
    }

    console.log(`[RunAutomations] "${job.name}": ${candidates.length} subs expiring on ${targetDateStr}`)
    return await sendToRecipients(job, creds, candidates.map(sub => ({
        phone: formatPhone(sub.numero, tenantCC),
        data: sub,
    })))
}

// ── TARGET: Todos los contactos ───────────────────────────────────────────
async function executeAllContactsJob(job: any, creds: any): Promise<{ sent: number; failed: number }> {
    const tenantCC = creds.country_code || '591'

    const { data: chats } = await supabaseAdmin
        .from('chats')
        .select('phone_number, contact_name, custom_fields')
        .eq('user_id', job.user_id)

    if (!chats?.length) {
        console.log(`[RunAutomations] "${job.name}": 0 contacts found`)
        return { sent: 0, failed: 0 }
    }

    console.log(`[RunAutomations] "${job.name}": ${chats.length} contacts`)
    return await sendToRecipients(job, creds, chats.map(c => ({
        phone: formatPhone(c.phone_number, tenantCC),
        data: { contact_name: c.contact_name, phone_number: c.phone_number, numero: c.phone_number, custom_fields: c.custom_fields || {} },
    })))
}

// ── TARGET: Contactos con tags específicos ────────────────────────────────
async function executeTaggedContactsJob(job: any, creds: any): Promise<{ sent: number; failed: number }> {
    const tenantCC = creds.country_code || '591'
    const targetConfig = job.target_config || {}
    const tags: string[] = targetConfig.tags || []

    if (tags.length === 0) {
        console.log(`[RunAutomations] "${job.name}": no tags configured`)
        return { sent: 0, failed: 0 }
    }

    // Obtener chats que tengan al menos uno de los tags
    const { data: chats } = await supabaseAdmin
        .from('chats')
        .select('phone_number, contact_name, tags, custom_fields')
        .eq('user_id', job.user_id)
        .overlaps('tags', tags)

    if (!chats?.length) {
        console.log(`[RunAutomations] "${job.name}": 0 contacts with tags [${tags.join(', ')}]`)
        return { sent: 0, failed: 0 }
    }

    console.log(`[RunAutomations] "${job.name}": ${chats.length} contacts with tags [${tags.join(', ')}]`)
    return await sendToRecipients(job, creds, chats.map(c => ({
        phone: formatPhone(c.phone_number, tenantCC),
        data: { contact_name: c.contact_name, phone_number: c.phone_number, numero: c.phone_number, custom_fields: c.custom_fields || {} },
    })))
}

// ── Envío unificado ───────────────────────────────────────────────────────
async function sendToRecipients(
    job: any,
    creds: any,
    recipients: Array<{ phone: string; data: Record<string, any> }>
): Promise<{ sent: number; failed: number }> {
    const stats = { sent: 0, failed: 0 }
    const params: { label: string; value: string }[] = job.template_params || []

    for (const { phone, data } of recipients) {
        if (!phone || phone.length < 8) { stats.failed++; continue }

        try {
            const bodyParameters = params.map(p => ({
                type: 'text' as const,
                text: resolveParam(p.value, data),
            }))

            const components = bodyParameters.length > 0
                ? [{ type: 'body', parameters: bodyParameters }]
                : []

            const result = await sendWhatsAppTemplate(
                phone,
                job.template_name,
                'es',
                components,
                creds.access_token,
                creds.phone_number_id
            )

            if (result) {
                stats.sent++
                console.log(`[RunAutomations] ✅ "${job.template_name}" → ${phone.slice(-4)}`)
            } else {
                stats.failed++
            }

            await delay(1500)
        } catch (err) {
            console.error(`[RunAutomations] Error sending to ${phone.slice(-4)}:`, err)
            stats.failed++
        }
    }

    return stats
}

function formatPhone(phone: string, countryCode: string): string {
    const clean = (phone || '').replace(/\D/g, '')
    return clean.startsWith(countryCode) ? clean : countryCode + clean
}
