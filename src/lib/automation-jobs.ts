export type AutomationTargetType = 'subscriptions_expiring' | 'all_contacts' | 'tagged_contacts'

export type AutomationRecord = Record<string, unknown>

export interface TemplateParam {
  label: string
  value: string
}

export interface AutomationJob {
  id: string
  user_id: string
  name: string
  template_name: string
  template_params: TemplateParam[]
  target_type: AutomationTargetType
  target_config: AutomationRecord
  trigger_days_before: number
  hour: number | null
  timezone: string | null
  last_run_at: string | null
}

export interface WhatsAppCredentials {
  access_token: string
  phone_number_id: string
  country_code: string
  waba_id?: string
}

export interface AutomationRecipient {
  phone: string
  data: AutomationRecord
}

export interface SendStats {
  sent: number
  failed: number
}

export const DEFAULT_TARGET_TYPE: AutomationTargetType = 'subscriptions_expiring'
export const DEFAULT_COUNTRY_CODE = '591'

export function asRecord(value: unknown): AutomationRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as AutomationRecord
}

export function asRecordArray(value: unknown): AutomationRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap(item => {
    const record = asRecord(item)
    return record ? [record] : []
  })
}

export function getString(record: AutomationRecord, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

export function getNumber(record: AutomationRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function getObject(record: AutomationRecord, key: string): AutomationRecord {
  return asRecord(record[key]) ?? {}
}

export function getStringArray(record: AutomationRecord, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

export function asAutomationJob(record: AutomationRecord): AutomationJob {
  const templateParams = Array.isArray(record.template_params)
    ? record.template_params.flatMap(item => {
        const param = asRecord(item)
        if (!param) {
          return []
        }

        return [{
          label: getString(param, 'label'),
          value: getString(param, 'value'),
        }]
      })
    : []

  const targetType = getString(record, 'target_type')
  const normalizedTargetType = isTargetType(targetType) ? targetType : DEFAULT_TARGET_TYPE

  return {
    id: getString(record, 'id'),
    user_id: getString(record, 'user_id'),
    name: getString(record, 'name'),
    template_name: getString(record, 'template_name'),
    template_params: templateParams,
    target_type: normalizedTargetType,
    target_config: getObject(record, 'target_config'),
    trigger_days_before: getNumber(record, 'trigger_days_before') ?? 0,
    hour: getNumber(record, 'hour'),
    timezone: getString(record, 'timezone') || null,
    last_run_at: getString(record, 'last_run_at') || null,
  }
}

function isTargetType(value: string): value is AutomationTargetType {
  return value === 'subscriptions_expiring' || value === 'all_contacts' || value === 'tagged_contacts'
}

export function asCredentials(record: AutomationRecord | null): WhatsAppCredentials | null {
  if (!record) {
    return null
  }

  const accessToken = getString(record, 'access_token')
  const phoneNumberId = getString(record, 'phone_number_id')

  if (!accessToken || !phoneNumberId) {
    return null
  }

  return {
    access_token: accessToken,
    phone_number_id: phoneNumberId,
    country_code: getString(record, 'country_code') || DEFAULT_COUNTRY_CODE,
    waba_id: getString(record, 'waba_id') || undefined,
  }
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null

  const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (parts) {
    return new Date(Number.parseInt(parts[3], 10), Number.parseInt(parts[2], 10) - 1, Number.parseInt(parts[1], 10))
  }

  const parsedDate = new Date(dateStr)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatPhone(phone: string, countryCode: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  return cleanPhone.startsWith(countryCode) ? cleanPhone : `${countryCode}${cleanPhone}`
}

export function getTargetTags(job: AutomationJob): string[] {
  const tags = job.target_config.tags
  if (!Array.isArray(tags)) {
    return []
  }

  return tags.filter((tag): tag is string => typeof tag === 'string')
}

export function buildSubscriptionRecipients(
  subscriptions: AutomationRecord[],
  job: AutomationJob,
  now: Date,
  credentials: WhatsAppCredentials,
): AutomationRecipient[] {
  const targetDate = new Date(now)
  targetDate.setDate(targetDate.getDate() + job.trigger_days_before)
  const targetDateStr = toDateStr(targetDate)

  return subscriptions.flatMap(subscription => {
    const phone = getString(subscription, 'numero').replace(/\D/g, '')
    const expiration = parseDate(getString(subscription, 'vencimiento'))

    if (phone.length < 8 || !expiration || toDateStr(expiration) !== targetDateStr) {
      return []
    }

    return [{
      phone: formatPhone(getString(subscription, 'numero'), credentials.country_code),
      data: subscription,
    }]
  })
}

export function buildContactRecipients(
  chats: AutomationRecord[],
  credentials: WhatsAppCredentials,
): AutomationRecipient[] {
  return chats.flatMap(chat => {
    const phoneNumber = getString(chat, 'phone_number')
    if (!phoneNumber) {
      return []
    }

    return [{
      phone: formatPhone(phoneNumber, credentials.country_code),
      data: {
        contact_name: getString(chat, 'contact_name'),
        phone_number: phoneNumber,
        numero: phoneNumber,
        custom_fields: getObject(chat, 'custom_fields'),
      },
    }]
  })
}

export function resolveAutomationParam(value: string, data: AutomationRecord): string {
  const today = new Date()
  const todayStr = today.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const nowStr = today.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

  return value
    .replace(/\{\{contact\.name\}\}/g, getString(data, 'contact_name') || getString(data, 'correo') || getString(data, 'numero'))
    .replace(/\{\{contact\.phone\}\}/g, getString(data, 'phone_number') || getString(data, 'numero'))
    .replace(/\{\{business\.name\}\}/g, getString(data, 'business_name') || getString(data, 'service_name') || getString(data, 'bot_name'))
    .replace(/\{\{subscription\.expires_at\}\}/g, getString(data, 'vencimiento'))
    .replace(/\{\{subscription\.service\}\}/g, getString(data, 'servicio') || getString(data, 'equipo'))
    .replace(/\{\{subscription\.plan\}\}/g, getString(data, 'plan_name') || getString(data, 'servicio'))
    .replace(/\{\{subscription\.email\}\}/g, getString(data, 'correo'))
    .replace(/\{\{custom\.(\w+)\}\}/g, (_, field) => {
      const customFields = getObject(data, 'custom_fields')
      const customValue = customFields[field]
      return customValue === undefined || customValue === null ? '' : String(customValue)
    })
    .replace(/\{\{today\}\}/g, todayStr)
    .replace(/\{\{now\}\}/g, nowStr)
    .replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, key) => {
      const resolvedValue = getNestedValue(data, key)
      return typeof resolvedValue === 'string' ? resolvedValue : ''
    })
}

function getNestedValue(data: AutomationRecord, key: string): unknown {
  return key.split('.').reduce<unknown>((currentValue, segment) => {
    const currentRecord = asRecord(currentValue)
    return currentRecord?.[segment]
  }, data)
}
