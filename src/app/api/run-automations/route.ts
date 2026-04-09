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

function resolveParam(value: string, sub: any): string {
    return value
        .replace(/\{\{contact\.name\}\}/g, sub.correo || sub.numero || '')
        .replace(/\{\{subscription\.expires_at\}\}/g, sub.vencimiento || '')
        .replace(/\{\{subscription\.service\}\}/g, sub.servicio || sub.equipo || '')
}

// =============================================
// GET: Llamado por Vercel Cron una vez al día (13:00 UTC)
// Plan Hobby no permite crons frecuentes — el endpoint procesa TODOS los jobs
// cuya hora configurada coincide con la hora local actual en su timezone.
// Como se ejecuta a las 13 UTC, cubrirá usuarios en zonas horarias donde
// sea la hora configurada (ej: 9am en UTC-4 = 13 UTC).
// Para mayor cobertura, ejecuta jobs cuya hora esté dentro de ±30 min del momento actual en su tz.
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
        // 1. Obtener todos los automation_jobs activos
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
            // Verificar si la hora local del job coincide con ahora (exacta o dentro de la misma hora)
            const localTime = getLocalTime(job.timezone, now)
            if (localTime.hour !== job.hour) {
                stats.skipped++
                continue
            }

            console.log(`[RunAutomations] Executing job "${job.name}" (user: ${job.user_id}, hour: ${job.hour}, tz: ${job.timezone})`)
            stats.ran++

            try {
                await executeJob(job, now)
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

async function executeJob(job: any, now: Date) {
    // Calcular la fecha objetivo según trigger_days_before
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + job.trigger_days_before)
    const targetDateStr = toDateStr(targetDate)

    // Obtener credenciales WhatsApp del usuario
    const { data: creds } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id, country_code')
        .eq('user_id', job.user_id)
        .single()

    if (!creds?.access_token || !creds?.phone_number_id) {
        console.log(`[RunAutomations] No WhatsApp credentials for user ${job.user_id}`)
        return
    }

    const tenantCC = creds.country_code || '591'

    // Obtener suscripciones del usuario activas cuyo vencimiento coincide
    const { data: subscriptions } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', job.user_id)
        .eq('estado', 'ACTIVO')

    if (!subscriptions || subscriptions.length === 0) {
        console.log(`[RunAutomations] No active subscriptions for user ${job.user_id}`)
        return
    }

    // Filtrar suscripciones cuyo vencimiento coincide con la fecha objetivo
    const candidates = subscriptions.filter(sub => {
        const phone = (sub.numero || '').replace(/\D/g, '')
        if (phone.length < 8) return false
        const expDate = parseDate(sub.vencimiento)
        if (!expDate) return false
        return toDateStr(expDate) === targetDateStr
    })

    if (candidates.length === 0) {
        console.log(`[RunAutomations] Job "${job.name}": no subscriptions expiring on ${targetDateStr}`)
        return
    }

    console.log(`[RunAutomations] Job "${job.name}": ${candidates.length} subscriptions matching date ${targetDateStr}`)

    // Enviar plantilla a cada suscripción candidata
    const params: { label: string; value: string }[] = job.template_params || []

    for (const sub of candidates) {
        try {
            const phone = sub.numero.replace(/\D/g, '')
            const fullPhone = !phone.startsWith(tenantCC) ? tenantCC + phone : phone

            // Resolver parámetros de la plantilla con datos del suscriptor
            const bodyParameters = params.map(p => ({
                type: 'text' as const,
                text: resolveParam(p.value, sub)
            }))

            const components = bodyParameters.length > 0
                ? [{ type: 'body', parameters: bodyParameters }]
                : []

            const result = await sendWhatsAppTemplate(
                fullPhone,
                job.template_name,
                'es',
                components,
                creds.access_token,
                creds.phone_number_id
            )

            if (result) {
                console.log(`[RunAutomations] ✅ Sent "${job.template_name}" to ${fullPhone}`)
            } else {
                console.log(`[RunAutomations] ❌ Failed sending to ${fullPhone}`)
            }

            await delay(1500)
        } catch (err) {
            console.error(`[RunAutomations] Error sending to sub ${sub.id}:`, err)
        }
    }
}
