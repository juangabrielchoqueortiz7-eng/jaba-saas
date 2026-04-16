import type { SupabaseClient } from '@supabase/supabase-js'
import { isBusinessType, type BusinessType } from './business-config'
import { normalizeBusinessGoalsForBusinessType, type BusinessGoal } from './business-goals'
import {
  AUTOMATION_SEQUENCE_KEYS,
  getAutomationSequenceSetting,
  renderAutomationSequenceTemplate,
  type AutomationSequenceKey,
} from './automation-sequence-config'
import { sendWhatsAppMessage } from './whatsapp'

type SequenceStatus = 'active' | 'paused' | 'completed' | 'cancelled'
type OrderKind = 'sale' | 'renewal'

interface SequenceContext {
  businessType: BusinessType
  goals: BusinessGoal[]
  serviceName: string
  paymentMethods: string
  currencySymbol: string
  planName: string
  amount: number
  customerEmail?: string | null
  contactName?: string | null
  triggerText?: string | null
  orderKind: OrderKind
  sequenceSettings?: unknown
}

interface SequenceRecord {
  id: string
  user_id: string
  chat_id: string
  order_id: string | null
  sequence_key: AutomationSequenceKey
  status: SequenceStatus
  current_step: number
  scheduled_for: string
  reply_cutoff_at: string | null
  context: unknown
}

interface RunnerStats {
  ran: number
  sent: number
  completed: number
  cancelled: number
  failed: number
}

interface SyncOrderFollowupInput {
  userId: string
  chatId: string
  orderId: string
  orderStatus: string | null | undefined
  orderKind: OrderKind
  businessType: unknown
  goals: unknown
  serviceName?: string | null
  paymentMethods?: string | null
  currencySymbol?: string | null
  planName?: string | null
  amount?: number | string | null
  customerEmail?: string | null
  replyCutoffAt?: string | null
  sequenceSettings?: unknown
}

interface SyncChatFollowupInput {
  userId: string
  chatId: string
  sequenceKey: Extract<AutomationSequenceKey, 'lead_capture_followup' | 'booking_confirmation_reminder' | 'support_escalation_sla'>
  businessType: unknown
  goals: unknown
  serviceName?: string | null
  paymentMethods?: string | null
  currencySymbol?: string | null
  contactName?: string | null
  triggerText?: string | null
  replyCutoffAt?: string | null
  sequenceSettings?: unknown
}

const MINUTE_MS = 60_000

function addDelay(base: Date, delayMs: number): string {
  return new Date(base.getTime() + delayMs).toISOString()
}

function normalizeCurrencySymbol(value?: string | null): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : 'Bs'
}

function normalizeServiceName(value?: string | null): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : 'tu servicio'
}

function normalizePaymentMethods(value?: string | null): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : 'los medios de pago disponibles'
}

function normalizeSequenceContext(input: SyncOrderFollowupInput): SequenceContext {
  const businessType = isBusinessType(input.businessType) ? input.businessType : 'subscriptions'
  const goals = normalizeBusinessGoalsForBusinessType(businessType, input.goals)
  const amount = typeof input.amount === 'number'
    ? input.amount
    : Number.parseFloat(String(input.amount ?? 0))

  return {
    businessType,
    goals,
    serviceName: normalizeServiceName(input.serviceName),
    paymentMethods: normalizePaymentMethods(input.paymentMethods),
    currencySymbol: normalizeCurrencySymbol(input.currencySymbol),
    planName: input.planName?.trim() || 'tu plan',
    amount: Number.isFinite(amount) ? amount : 0,
    customerEmail: input.customerEmail?.trim() || null,
    contactName: null,
    triggerText: null,
    orderKind: input.orderKind,
    sequenceSettings: input.sequenceSettings,
  }
}

function normalizeChatSequenceContext(input: SyncChatFollowupInput): SequenceContext {
  const businessType = isBusinessType(input.businessType) ? input.businessType : 'subscriptions'
  return {
    businessType,
    goals: normalizeBusinessGoalsForBusinessType(businessType, input.goals),
    serviceName: normalizeServiceName(input.serviceName),
    paymentMethods: normalizePaymentMethods(input.paymentMethods),
    currencySymbol: normalizeCurrencySymbol(input.currencySymbol),
    planName: input.sequenceKey === 'booking_confirmation_reminder'
      ? 'reserva o cita'
      : input.sequenceKey === 'support_escalation_sla'
        ? 'caso de soporte'
        : 'consulta',
    amount: 0,
    customerEmail: null,
    contactName: input.contactName?.trim() || null,
    triggerText: input.triggerText?.trim() || null,
    orderKind: 'sale',
    sequenceSettings: input.sequenceSettings,
  }
}

function parseSequenceContext(value: unknown): SequenceContext {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<SequenceContext>
    : {}
  const businessType = isBusinessType(record.businessType) ? record.businessType : 'subscriptions'

  return {
    businessType,
    goals: normalizeBusinessGoalsForBusinessType(businessType, record.goals),
    serviceName: normalizeServiceName(record.serviceName),
    paymentMethods: normalizePaymentMethods(record.paymentMethods),
    currencySymbol: normalizeCurrencySymbol(record.currencySymbol),
    planName: typeof record.planName === 'string' && record.planName.trim().length > 0
      ? record.planName.trim()
      : 'tu plan',
    amount: typeof record.amount === 'number' && Number.isFinite(record.amount) ? record.amount : 0,
    customerEmail: typeof record.customerEmail === 'string' && record.customerEmail.trim().length > 0
      ? record.customerEmail.trim()
      : null,
    contactName: typeof record.contactName === 'string' && record.contactName.trim().length > 0
      ? record.contactName.trim()
      : null,
    triggerText: typeof record.triggerText === 'string' && record.triggerText.trim().length > 0
      ? record.triggerText.trim()
      : null,
    orderKind: record.orderKind === 'renewal' ? 'renewal' : 'sale',
    sequenceSettings: record.sequenceSettings,
  }
}

function getExpectedOrderStatus(sequenceKey: AutomationSequenceKey): string | null {
  if (sequenceKey === 'sales_pending_email_followup') {
    return 'pending_email'
  }

  if (sequenceKey === 'sales_pending_payment_followup' || sequenceKey === 'renewal_pending_payment_followup') {
    return 'pending_payment'
  }

  return null
}

function getSequenceKey(orderKind: OrderKind, orderStatus: string | null | undefined): AutomationSequenceKey | null {
  if (orderKind === 'sale' && orderStatus === 'pending_email') {
    return 'sales_pending_email_followup'
  }

  if (orderStatus === 'pending_payment') {
    return orderKind === 'renewal'
      ? 'renewal_pending_payment_followup'
      : 'sales_pending_payment_followup'
  }

  return null
}

function getSequenceDelays(sequenceKey: AutomationSequenceKey, context: SequenceContext): number[] {
  const setting = getAutomationSequenceSetting(context.sequenceSettings, sequenceKey)
  return [setting.firstDelayMinutes * MINUTE_MS, setting.secondDelayMinutes * MINUTE_MS]
}

function buildSequenceMessage(sequenceKey: AutomationSequenceKey, stepIndex: number, context: SequenceContext): string {
  const setting = getAutomationSequenceSetting(context.sequenceSettings, sequenceKey)
  const template = stepIndex === 0 ? setting.firstMessage : setting.secondMessage
  return renderAutomationSequenceTemplate(template, context)
}

export async function cancelActiveSequencesForChat(
  supabaseAdmin: SupabaseClient,
  chatId: string,
  reason: string,
): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('automation_sequences')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: reason,
    })
    .eq('chat_id', chatId)
    .eq('status', 'active')
    .in('sequence_key', AUTOMATION_SEQUENCE_KEYS)
    .select('id')

  if (error) {
    console.error('[AutomationSequences] Error cancelling chat sequences:', error)
    return 0
  }

  return data?.length ?? 0
}

export async function cancelSequencesForOrder(
  supabaseAdmin: SupabaseClient,
  orderId: string,
  reason: string,
): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('automation_sequences')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: reason,
    })
    .eq('order_id', orderId)
    .eq('status', 'active')
    .select('id')

  if (error) {
    console.error('[AutomationSequences] Error cancelling order sequences:', error)
    return 0
  }

  return data?.length ?? 0
}

export async function syncOrderFollowupSequence(
  supabaseAdmin: SupabaseClient,
  input: SyncOrderFollowupInput,
): Promise<void> {
  const sequenceKey = getSequenceKey(input.orderKind, input.orderStatus)
  if (!sequenceKey) {
    await cancelSequencesForOrder(supabaseAdmin, input.orderId, 'order_state_not_followup')
    return
  }

  const now = new Date()
  const context = normalizeSequenceContext(input)
  const sequenceSetting = getAutomationSequenceSetting(context.sequenceSettings, sequenceKey)
  if (!sequenceSetting.enabled) {
    await cancelSequencesForOrder(supabaseAdmin, input.orderId, 'sequence_disabled')
    return
  }

  const nextRunAt = addDelay(now, sequenceSetting.firstDelayMinutes * MINUTE_MS)

  const { data: activeSequences, error: activeError } = await supabaseAdmin
    .from('automation_sequences')
    .select('id, sequence_key, current_step, scheduled_for')
    .eq('order_id', input.orderId)
    .eq('status', 'active')

  if (activeError) {
    console.error('[AutomationSequences] Error loading active sequences for order:', activeError)
    return
  }

  const matchingSequence = (activeSequences ?? []).find(
    (sequence) => sequence.sequence_key === sequenceKey,
  )
  const staleSequenceIds = (activeSequences ?? [])
    .filter((sequence) => sequence.sequence_key !== sequenceKey)
    .map((sequence) => sequence.id)

  if (staleSequenceIds.length > 0) {
    await supabaseAdmin
      .from('automation_sequences')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancel_reason: 'order_state_changed',
      })
      .in('id', staleSequenceIds)
  }

  if (matchingSequence) {
    await supabaseAdmin
      .from('automation_sequences')
      .update({
        context,
      })
      .eq('id', matchingSequence.id)
    return
  }

  const { error: insertError } = await supabaseAdmin
    .from('automation_sequences')
    .insert({
      user_id: input.userId,
      chat_id: input.chatId,
      order_id: input.orderId,
      sequence_key: sequenceKey,
      status: 'active',
      current_step: 0,
      scheduled_for: nextRunAt,
      reply_cutoff_at: input.replyCutoffAt || now.toISOString(),
      context,
    })

  if (insertError) {
    console.error('[AutomationSequences] Error creating sequence:', insertError)
  }
}

export async function syncChatFollowupSequence(
  supabaseAdmin: SupabaseClient,
  input: SyncChatFollowupInput,
): Promise<void> {
  const now = new Date()
  const context = normalizeChatSequenceContext(input)
  const sequenceSetting = getAutomationSequenceSetting(context.sequenceSettings, input.sequenceKey)

  if (!sequenceSetting.enabled) {
    return
  }

  const { data: activeSequences, error: activeError } = await supabaseAdmin
    .from('automation_sequences')
    .select('id, sequence_key, order_id')
    .eq('chat_id', input.chatId)
    .eq('status', 'active')
    .in('sequence_key', AUTOMATION_SEQUENCE_KEYS)

  if (activeError) {
    console.error('[AutomationSequences] Error loading active chat sequences:', activeError)
    return
  }

  const hasOrderFollowup = (activeSequences ?? []).some((sequence) => Boolean(sequence.order_id))
  if (hasOrderFollowup) {
    return
  }

  const matchingSequence = (activeSequences ?? []).find(
    (sequence) => sequence.sequence_key === input.sequenceKey,
  )

  if (matchingSequence) {
    await supabaseAdmin
      .from('automation_sequences')
      .update({
        context,
        scheduled_for: addDelay(now, sequenceSetting.firstDelayMinutes * MINUTE_MS),
        reply_cutoff_at: input.replyCutoffAt || now.toISOString(),
      })
      .eq('id', matchingSequence.id)
    return
  }

  const { error: insertError } = await supabaseAdmin
    .from('automation_sequences')
    .insert({
      user_id: input.userId,
      chat_id: input.chatId,
      order_id: null,
      sequence_key: input.sequenceKey,
      status: 'active',
      current_step: 0,
      scheduled_for: addDelay(now, sequenceSetting.firstDelayMinutes * MINUTE_MS),
      reply_cutoff_at: input.replyCutoffAt || now.toISOString(),
      context,
    })

  if (insertError) {
    console.error('[AutomationSequences] Error creating chat sequence:', insertError)
  }
}

async function markSequenceCancelled(
  supabaseAdmin: SupabaseClient,
  sequenceId: string,
  reason: string,
): Promise<void> {
  await supabaseAdmin
    .from('automation_sequences')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .eq('id', sequenceId)
}

async function markSequenceCompleted(
  supabaseAdmin: SupabaseClient,
  sequenceId: string,
  nextStep: number,
): Promise<void> {
  await supabaseAdmin
    .from('automation_sequences')
    .update({
      status: 'completed',
      current_step: nextStep,
      completed_at: new Date().toISOString(),
      last_executed_at: new Date().toISOString(),
      scheduled_for: new Date().toISOString(),
    })
    .eq('id', sequenceId)
}

async function hasInboundReplyAfter(
  supabaseAdmin: SupabaseClient,
  chatId: string,
  cutoff: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, created_at')
    .eq('chat_id', chatId)
    .eq('is_from_me', false)
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[AutomationSequences] Error checking inbound reply:', error)
    return false
  }

  return (data?.length ?? 0) > 0
}

export async function runDueAutomationSequences(
  supabaseAdmin: SupabaseClient,
  now: Date = new Date(),
): Promise<RunnerStats> {
  const stats: RunnerStats = { ran: 0, sent: 0, completed: 0, cancelled: 0, failed: 0 }
  const sequenceSettingsCache = new Map<string, unknown>()

  const { data: rawSequences, error: sequencesError } = await supabaseAdmin
    .from('automation_sequences')
    .select('id, user_id, chat_id, order_id, sequence_key, status, current_step, scheduled_for, reply_cutoff_at, context')
    .eq('status', 'active')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (sequencesError) {
    console.error('[AutomationSequences] Error loading due sequences:', sequencesError)
    return stats
  }

  const sequences = (rawSequences ?? []) as SequenceRecord[]
  for (const sequence of sequences) {
    stats.ran++

    try {
      const context = parseSequenceContext(sequence.context)
      if (!sequenceSettingsCache.has(sequence.user_id)) {
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('business_profile')
          .eq('id', sequence.user_id)
          .maybeSingle()

        const businessProfile =
          profile?.business_profile &&
          typeof profile.business_profile === 'object' &&
          !Array.isArray(profile.business_profile)
            ? profile.business_profile as Record<string, unknown>
            : {}

        sequenceSettingsCache.set(sequence.user_id, businessProfile.sequence_automation_settings)
      }

      context.sequenceSettings = sequenceSettingsCache.get(sequence.user_id)
      const delays = getSequenceDelays(sequence.sequence_key, context)
      const sequenceSetting = getAutomationSequenceSetting(context.sequenceSettings, sequence.sequence_key)
      const stepIndex = sequence.current_step
      const expectedOrderStatus = getExpectedOrderStatus(sequence.sequence_key)

      if (!sequenceSetting.enabled) {
        await markSequenceCancelled(supabaseAdmin, sequence.id, 'sequence_disabled')
        stats.cancelled++
        continue
      }

      if (!delays || stepIndex >= delays.length) {
        await markSequenceCompleted(supabaseAdmin, sequence.id, stepIndex)
        stats.completed++
        continue
      }

      const { data: chat } = await supabaseAdmin
        .from('chats')
        .select('id, phone_number, contact_name, status, tags, last_message_time')
        .eq('id', sequence.chat_id)
        .maybeSingle()

      if (!chat?.phone_number) {
        await markSequenceCancelled(supabaseAdmin, sequence.id, 'chat_missing')
        stats.cancelled++
        continue
      }

      if (chat.status === 'pending') {
        await markSequenceCancelled(supabaseAdmin, sequence.id, 'human_handoff')
        stats.cancelled++
        continue
      }

      const tags: string[] = Array.isArray(chat.tags) ? chat.tags : []
      const closingTags = ['pago', 'reservado', 'resuelto', 'soporte_resuelto', 'cerrado', 'cliente_activo']
      if (closingTags.some((tag) => tags.includes(tag))) {
        await markSequenceCancelled(supabaseAdmin, sequence.id, 'chat_already_advanced')
        stats.cancelled++
        continue
      }

      if (sequence.reply_cutoff_at) {
        const replied = await hasInboundReplyAfter(supabaseAdmin, sequence.chat_id, sequence.reply_cutoff_at)
        if (replied) {
          await markSequenceCancelled(supabaseAdmin, sequence.id, 'customer_replied')
          stats.cancelled++
          continue
        }
      }

      if (sequence.order_id && expectedOrderStatus) {
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('id, status')
          .eq('id', sequence.order_id)
          .maybeSingle()

        if (!order || order.status !== expectedOrderStatus) {
          await markSequenceCancelled(supabaseAdmin, sequence.id, 'order_state_changed')
          stats.cancelled++
          continue
        }
      }

      const { data: credentials } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id')
        .eq('user_id', sequence.user_id)
        .maybeSingle()

      if (!credentials?.access_token || !credentials.phone_number_id) {
        await markSequenceCancelled(supabaseAdmin, sequence.id, 'missing_credentials')
        stats.cancelled++
        continue
      }

      const message = buildSequenceMessage(sequence.sequence_key, stepIndex, context)
      const result = await sendWhatsAppMessage(
        chat.phone_number,
        message,
        credentials.access_token,
        credentials.phone_number_id,
      )

      if (!result) {
        stats.failed++
        continue
      }

      const wamid = result?.messages?.[0]?.id ?? null
      await supabaseAdmin.from('messages').insert({
        chat_id: sequence.chat_id,
        is_from_me: true,
        content: message,
        status: 'delivered',
        ...(wamid ? { whatsapp_message_id: wamid } : {}),
      })

      await supabaseAdmin
        .from('chats')
        .update({
          last_message: message.slice(0, 100),
          last_message_time: new Date().toISOString(),
        })
        .eq('id', sequence.chat_id)

      stats.sent++

      const nextStep = stepIndex + 1
      if (nextStep >= delays.length) {
        await markSequenceCompleted(supabaseAdmin, sequence.id, nextStep)
        stats.completed++
        continue
      }

      await supabaseAdmin
        .from('automation_sequences')
        .update({
          current_step: nextStep,
          last_executed_at: new Date().toISOString(),
          scheduled_for: addDelay(now, delays[nextStep]),
        })
        .eq('id', sequence.id)
    } catch (error) {
      console.error('[AutomationSequences] Error running sequence:', error)
      stats.failed++
    }
  }

  return stats
}
