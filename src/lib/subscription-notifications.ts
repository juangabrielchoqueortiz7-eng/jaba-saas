import { timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  asRecord,
  asRecordArray,
  DEFAULT_COUNTRY_CODE,
  formatPhone,
  getString,
  parseDate,
  type AutomationRecord,
} from '@/lib/automation-jobs'
import type { Subscription } from '@/types/subscription'

export interface SubscriptionRecord extends Subscription {
  auto_notify_paused?: boolean
  created_at?: string
  followup_sent?: boolean
  notified_at?: string
  urgency_sent?: boolean
  user_id: string
}

export interface SubscriptionProduct {
  description: string | null
  id: string
  name: string
  price: number
}

export interface TemplateConfigEntry {
  followup?: string
  reminder?: string
  urgency?: string
}

export interface SubscriptionSettingsRecord {
  enable_auto_notifications: boolean
  expired_grace_msg: string | null
  reminder_msg: string | null
  template_config: Record<string, TemplateConfigEntry>
  notify_days_before: number
}

export interface SubscriptionCredentials {
  access_token: string
  bot_name: string | null
  country_code: string
  currency_symbol: string
  phone_number_id: string
  promo_image_url: string | null
  service_name: string | null
  timezone: string
}

export interface NotificationResults {
  failed: number
  sent: number
  skipped: number
  total: number
}

export interface WhatsAppListRow {
  description: string
  id: string
  title: string
}

export interface WhatsAppListSection {
  rows: WhatsAppListRow[]
  title: string
}

interface ChatRecord {
  id: string
  tags: string[]
}

interface WhatsAppTemplateResult {
  messages?: Array<{ id?: string }>
}

const DEFAULT_TIMEZONE = 'America/La_Paz'

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function redactPhone(phone: string): string {
  return phone ? `***${phone.slice(-4)}` : '***'
}

export function redactEmail(email: string): string {
  if (!email) {
    return '***'
  }

  const [user, domain] = email.split('@')
  return `${user.slice(0, 2)}***@${domain || '***'}`
}

export function timingSafeCompare(a: string, b: string): boolean {
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

export function getTenantGreeting(timezone: string = DEFAULT_TIMEZONE): string {
  const tenantTime = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const hour = tenantTime.getHours()

  if (hour >= 6 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function toSubscriptionList(records: unknown): SubscriptionRecord[] {
  return asRecordArray(records).flatMap(record => {
    const subscription = asSubscription(record)
    return subscription ? [subscription] : []
  })
}

export function toProductList(records: unknown): SubscriptionProduct[] {
  return asRecordArray(records).flatMap(record => {
    const product = asProduct(record)
    return product ? [product] : []
  })
}

export function toCredentials(record: unknown): SubscriptionCredentials | null {
  const data = asRecord(record)
  if (!data) {
    return null
  }

  const accessToken = getString(data, 'access_token')
  const phoneNumberId = getString(data, 'phone_number_id')
  if (!accessToken || !phoneNumberId) {
    return null
  }

  return {
    access_token: accessToken,
    bot_name: getNullableString(data, 'bot_name'),
    country_code: getString(data, 'country_code') || DEFAULT_COUNTRY_CODE,
    currency_symbol: getString(data, 'currency_symbol') || 'Bs',
    phone_number_id: phoneNumberId,
    promo_image_url: getNullableString(data, 'promo_image_url'),
    service_name: getNullableString(data, 'service_name'),
    timezone: getString(data, 'timezone') || DEFAULT_TIMEZONE,
  }
}

export function toSettings(record: unknown): SubscriptionSettingsRecord {
  const data = asRecord(record)
  if (!data) {
    return {
      enable_auto_notifications: true,
      expired_grace_msg: null,
      reminder_msg: null,
      template_config: {},
      notify_days_before: 3,
    }
  }

  const rawDays = data.notify_days_before
  const notify_days_before = typeof rawDays === 'number' && rawDays >= 0 ? rawDays : 3

  return {
    enable_auto_notifications: getBoolean(data, 'enable_auto_notifications', true),
    expired_grace_msg: getNullableString(data, 'expired_grace_msg'),
    reminder_msg: getNullableString(data, 'reminder_msg'),
    template_config: getTemplateConfig(data.template_config),
    notify_days_before,
  }
}

export function getServiceName(credentials: SubscriptionCredentials): string {
  return credentials.service_name || credentials.bot_name || 'nuestro servicio'
}

export function getPromoImageUrl(credentials: SubscriptionCredentials): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
  return credentials.promo_image_url || `${baseUrl}/prices_promo.jpg`
}

export function buildPlanListSections(
  products: SubscriptionProduct[],
  currencySymbol: string,
): WhatsAppListSection[] {
  if (products.length === 0) {
    return []
  }

  return [{
    title: 'Planes Disponibles',
    rows: products.map(product => ({
      id: `renew_plan_${product.id}`,
      title: product.name.substring(0, 24),
      description: `${currencySymbol} ${product.price}`,
    })),
  }]
}

export function buildPlanListContent(
  products: SubscriptionProduct[],
  currencySymbol: string,
): string {
  return products
    .map(product => `• ${product.name} — ${currencySymbol} ${product.price}`)
    .join('\n')
}

export function resolveTemplateName(
  settings: SubscriptionSettingsRecord,
  servicio: string,
  templateType: keyof TemplateConfigEntry,
  fallback: string,
): string {
  const preferred = settings.template_config[servicio]?.[templateType]
  if (preferred) {
    return preferred
  }

  for (const config of Object.values(settings.template_config)) {
    const candidate = config[templateType]
    if (candidate) {
      return candidate
    }
  }

  return fallback
}

export function extractWhatsAppMessageId(result: unknown): string | null {
  const data = asRecord(result) as WhatsAppTemplateResult | null
  return data?.messages?.find(message => typeof message?.id === 'string')?.id ?? null
}

export function groupSubscriptionsByUser(
  subscriptions: SubscriptionRecord[],
): Record<string, SubscriptionRecord[]> {
  return subscriptions.reduce<Record<string, SubscriptionRecord[]>>((groups, subscription) => {
    if (!groups[subscription.user_id]) {
      groups[subscription.user_id] = []
    }

    groups[subscription.user_id].push(subscription)
    return groups
  }, {})
}

export function normalizePhone(phoneNumber: string, countryCode: string): string {
  return formatPhone(phoneNumber, countryCode)
}

export async function findOrCreateChat(
  supabaseAdmin: SupabaseClient,
  phoneNumber: string,
  userId: string,
  contactName?: string,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): Promise<string | null> {
  try {
    const cleanNumber = phoneNumber.replace(/\D/g, '')
    const withPrefix = cleanNumber.startsWith(countryCode) ? cleanNumber : `${countryCode}${cleanNumber}`
    const withoutPrefix = cleanNumber.startsWith(countryCode) ? cleanNumber.slice(countryCode.length) : cleanNumber

    const { data: existingChat } = await supabaseAdmin
      .from('chats')
      .select('id')
      .eq('user_id', userId)
      .or(`phone_number.eq.${withPrefix},phone_number.eq.${withoutPrefix},phone_number.eq.+${withPrefix}`)
      .limit(1)
      .maybeSingle()

    const chat = asChat(existingChat)
    if (chat) {
      return chat.id
    }

    const { data: newChat } = await supabaseAdmin
      .from('chats')
      .insert({
        phone_number: withPrefix,
        user_id: userId,
        contact_name: contactName || phoneNumber,
        last_message: 'Notificación enviada',
        unread_count: 0,
      })
      .select('id')
      .single()

    return asChat(newChat)?.id ?? null
  } catch (error) {
    console.error('[Chat] Error finding/creating chat:', error)
    return null
  }
}

export async function updateChatTags(
  supabaseAdmin: SupabaseClient,
  chatId: string,
  addTags: string[],
  removeTags: string[] = [],
): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('chats')
      .select('id, tags')
      .eq('id', chatId)
      .single()

    const chat = asChat(data)
    if (!chat) {
      return
    }

    const currentTags = chat.tags.filter(tag => !removeTags.includes(tag))
    const nextTags = [...new Set([...currentTags, ...addTags])]

    await supabaseAdmin
      .from('chats')
      .update({ tags: nextTags })
      .eq('id', chatId)
  } catch (error) {
    console.error('[Chat] Error updating tags:', error)
  }
}

export function hasValidSubscriptionPhone(subscription: SubscriptionRecord): boolean {
  return subscription.numero.replace(/\D/g, '').length >= 8
}

export function getSubscriptionDateDiff(subscription: SubscriptionRecord, fromDate: Date): number | null {
  const expiration = parseDate(subscription.vencimiento)
  if (!expiration) {
    return null
  }

  return Math.ceil((expiration.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
}

function asSubscription(record: AutomationRecord): SubscriptionRecord | null {
  const id = getString(record, 'id')
  const userId = getString(record, 'user_id')
  const numero = getString(record, 'numero')

  if (!id || !userId || !numero) {
    return null
  }

  return {
    id,
    created_at: getNullableString(record, 'created_at') ?? undefined,
    numero,
    correo: getString(record, 'correo'),
    vencimiento: getString(record, 'vencimiento'),
    estado: getString(record, 'estado') || 'ACTIVO',
    equipo: getString(record, 'equipo'),
    servicio: getString(record, 'servicio'),
    password: getNullableString(record, 'password') ?? undefined,
    notified: getBoolean(record, 'notified', false),
    notified_at: getNullableString(record, 'notified_at') ?? undefined,
    followup_sent: getBoolean(record, 'followup_sent', false),
    urgency_sent: getBoolean(record, 'urgency_sent', false),
    auto_notify_paused: getBoolean(record, 'auto_notify_paused', false),
    user_id: userId,
  }
}

function asProduct(record: AutomationRecord): SubscriptionProduct | null {
  const id = getString(record, 'id')
  const name = getString(record, 'name')
  if (!id || !name) {
    return null
  }

  return {
    description: getNullableString(record, 'description'),
    id,
    name,
    price: getNumber(record, 'price'),
  }
}

function asChat(record: unknown): ChatRecord | null {
  const data = asRecord(record)
  if (!data) {
    return null
  }

  const id = getString(data, 'id')
  if (!id) {
    return null
  }

  return {
    id,
    tags: getStringArray(data, 'tags'),
  }
}

function getTemplateConfig(value: unknown): Record<string, TemplateConfigEntry> {
  const config = asRecord(value)
  if (!config) {
    return {}
  }

  return Object.entries(config).reduce<Record<string, TemplateConfigEntry>>((result, [key, entryValue]) => {
    const entry = asRecord(entryValue)
    result[key] = {
      followup: entry ? getOptionalString(entry, 'followup') : undefined,
      reminder: entry ? getOptionalString(entry, 'reminder') : undefined,
      urgency: entry ? getOptionalString(entry, 'urgency') : undefined,
    }
    return result
  }, {})
}

function getBoolean(record: AutomationRecord, key: string, fallback: boolean): boolean {
  const value = record[key]
  return typeof value === 'boolean' ? value : fallback
}

function getNumber(record: AutomationRecord, key: string): number {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function getNullableString(record: AutomationRecord, key: string): string | null {
  const value = getString(record, key)
  return value || null
}

function getOptionalString(record: AutomationRecord, key: string): string | undefined {
  const value = getString(record, key)
  return value || undefined
}

function getStringArray(record: AutomationRecord, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}
