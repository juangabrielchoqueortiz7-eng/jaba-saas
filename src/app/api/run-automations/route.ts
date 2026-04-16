import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  asAutomationJob,
  asCredentials,
  asRecord,
  asRecordArray,
  AutomationJob,
  AutomationRecipient,
  buildContactRecipients,
  buildSubscriptionRecipients,
  DEFAULT_TARGET_TYPE,
  getTargetTags,
  resolveAutomationParam,
  SendStats,
} from '@/lib/automation-jobs'
import { runDueAutomationSequences } from '@/lib/automation-sequences'
import { getLocalTime } from '@/lib/timezone-utils'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey,
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a)
    const right = Buffer.from(b)

    if (left.length !== right.length) {
      return false
    }

    return timingSafeEqual(left, right)
  } catch {
    return false
  }
}

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
    const { data: rawJobs, error: jobsError } = await supabaseAdmin
      .from('automation_jobs')
      .select('*')
      .eq('is_active', true)

    if (jobsError) {
      console.error('[RunAutomations] Error fetching jobs:', jobsError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    const jobs = asRecordArray(rawJobs).map(asAutomationJob)
    const sequenceStats = await runDueAutomationSequences(supabaseAdmin, now)

    if (jobs.length === 0) {
      console.log('[RunAutomations] No active automation jobs')
      return NextResponse.json({
        ran: 0,
        skipped: 0,
        sent: 0,
        failed: 0,
        sequenceStats,
      })
    }

    console.log(`[RunAutomations] Found ${jobs.length} active jobs`)
    const stats = { ran: 0, skipped: 0, sent: 0, failed: 0 }

    for (const job of jobs) {
      const localTime = getLocalTime(job.timezone || 'America/La_Paz', now)
      if (job.hour === null || localTime.hour !== job.hour) {
        stats.skipped++
        continue
      }

      if (job.last_run_at && hasAlreadyRunToday(job, now)) {
        console.log(`[RunAutomations] Skipping "${job.name}" because it already ran today`)
        stats.skipped++
        continue
      }

      console.log(`[RunAutomations] Executing "${job.name}" (type: ${job.target_type}, user: ${job.user_id})`)
      stats.ran++

      try {
        const jobStats = await executeJob(job, now)
        stats.sent += jobStats.sent
        stats.failed += jobStats.failed

        await supabaseAdmin
          .from('automation_jobs')
          .update({ last_run_at: now.toISOString() })
          .eq('id', job.id)
      } catch (error) {
        console.error(`[RunAutomations] Job ${job.id} failed:`, error)
        stats.failed++
      }
    }

    console.log(`[RunAutomations] Done - ran: ${stats.ran}, skipped: ${stats.skipped}, sent: ${stats.sent}, failed: ${stats.failed}`)
    return NextResponse.json({
      ...stats,
      sequenceStats,
    })
  } catch (error) {
    console.error('[RunAutomations] Fatal error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function hasAlreadyRunToday(job: AutomationJob, now: Date): boolean {
  if (!job.last_run_at) {
    return false
  }

  const timezone = job.timezone || 'America/La_Paz'
  const todayLocal = now.toLocaleDateString('en-CA', { timeZone: timezone })
  const lastRunLocal = new Date(job.last_run_at).toLocaleDateString('en-CA', { timeZone: timezone })
  return todayLocal === lastRunLocal
}

async function executeJob(job: AutomationJob, now: Date): Promise<SendStats> {
  const credentials = await getCredentials(job.user_id)
  if (!credentials) {
    return { sent: 0, failed: 0 }
  }

  switch (job.target_type || DEFAULT_TARGET_TYPE) {
    case 'subscriptions_expiring':
      return executeSubscriptionJob(job, now, credentials)
    case 'all_contacts':
      return executeAllContactsJob(job, credentials)
    case 'tagged_contacts':
      return executeTaggedContactsJob(job, credentials)
    default:
      console.warn(`[RunAutomations] Unknown target_type: ${job.target_type}`)
      return { sent: 0, failed: 0 }
  }
}

async function getCredentials(userId: string) {
  const { data } = await supabaseAdmin
    .from('whatsapp_credentials')
    .select('access_token, phone_number_id, country_code')
    .eq('user_id', userId)
    .single()

  const credentials = asCredentials(asRecord(data))
  if (!credentials) {
    console.log(`[RunAutomations] No WhatsApp credentials for user ${userId}`)
    return null
  }

  return credentials
}

async function executeSubscriptionJob(job: AutomationJob, now: Date, credentials: NonNullable<Awaited<ReturnType<typeof getCredentials>>>) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', job.user_id)
    .eq('estado', 'ACTIVO')

  const recipients = buildSubscriptionRecipients(asRecordArray(data), job, now, credentials)

  if (recipients.length === 0) {
    console.log(`[RunAutomations] "${job.name}": 0 subs expiring`)
    return { sent: 0, failed: 0 }
  }

  console.log(`[RunAutomations] "${job.name}": ${recipients.length} subs expiring`)
  return sendToRecipients(job, credentials, recipients)
}

async function executeAllContactsJob(job: AutomationJob, credentials: NonNullable<Awaited<ReturnType<typeof getCredentials>>>) {
  const { data } = await supabaseAdmin
    .from('chats')
    .select('phone_number, contact_name, custom_fields')
    .eq('user_id', job.user_id)

  const recipients = buildContactRecipients(asRecordArray(data), credentials)
  if (recipients.length === 0) {
    console.log(`[RunAutomations] "${job.name}": 0 contacts found`)
    return { sent: 0, failed: 0 }
  }

  console.log(`[RunAutomations] "${job.name}": ${recipients.length} contacts`)
  return sendToRecipients(job, credentials, recipients)
}

async function executeTaggedContactsJob(job: AutomationJob, credentials: NonNullable<Awaited<ReturnType<typeof getCredentials>>>) {
  const tags = getTargetTags(job)
  if (tags.length === 0) {
    console.log(`[RunAutomations] "${job.name}": no tags configured`)
    return { sent: 0, failed: 0 }
  }

  const { data } = await supabaseAdmin
    .from('chats')
    .select('phone_number, contact_name, tags, custom_fields')
    .eq('user_id', job.user_id)
    .overlaps('tags', tags)

  const recipients = buildContactRecipients(asRecordArray(data), credentials)
  if (recipients.length === 0) {
    console.log(`[RunAutomations] "${job.name}": 0 contacts with tags [${tags.join(', ')}]`)
    return { sent: 0, failed: 0 }
  }

  console.log(`[RunAutomations] "${job.name}": ${recipients.length} contacts with tags [${tags.join(', ')}]`)
  return sendToRecipients(job, credentials, recipients)
}

async function sendToRecipients(
  job: AutomationJob,
  credentials: NonNullable<Awaited<ReturnType<typeof getCredentials>>>,
  recipients: AutomationRecipient[],
): Promise<SendStats> {
  const stats = { sent: 0, failed: 0 }

  for (const recipient of recipients) {
    if (!recipient.phone || recipient.phone.length < 8) {
      stats.failed++
      continue
    }

    try {
      const bodyParameters = job.template_params.map(param => ({
        type: 'text' as const,
        text: resolveAutomationParam(param.value, recipient.data),
      }))

      const components = bodyParameters.length > 0
        ? [{ type: 'body' as const, parameters: bodyParameters }]
        : []

      const result = await sendWhatsAppTemplate(
        recipient.phone,
        job.template_name,
        'es',
        components,
        credentials.access_token,
        credentials.phone_number_id,
      )

      if (result) {
        stats.sent++
        console.log(`[RunAutomations] Sent "${job.template_name}" to ${recipient.phone.slice(-4)}`)
      } else {
        stats.failed++
      }

      await delay(1500)
    } catch (error) {
      console.error(`[RunAutomations] Error sending to ${recipient.phone.slice(-4)}:`, error)
      stats.failed++
    }
  }

  return stats
}
