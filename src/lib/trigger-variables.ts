/**
 * Trigger Variables — Sistema de resolución de variables dinámicas
 *
 * Soporta:
 *  - Variables legacy:    {nombre}, {numero}, {vencimiento}, {correo}, {servicio}
 *  - Variables nuevas:    {{contact.name}}, {{chat.phone_number}}, {{subscription.expires_at}}
 *  - Campos custom:       {{custom.field_name}}
 *  - Variables de fecha:  {{date.today}}, {{date.tomorrow}}
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface VariableContext {
  // Datos del contacto / chat
  contactName?: string
  phoneNumber?: string
  chatId?: string
  chatCreatedAt?: Date
  chatStatus?: string
  chatTags?: string[]
  chatCustomFields?: Record<string, any>

  // Datos de suscripción
  subscriptionService?: string
  subscriptionEmail?: string
  subscriptionExpiresAt?: Date | string
  subscriptionStatus?: string

  // Mensaje actual
  messageText?: string
  messageTimestamp?: Date

  // Datos del tenant
  tenantName?: string
  tenantServiceName?: string
}

// ── Core Resolver ──────────────────────────────────────────────────────────

/**
 * Resuelve todas las variables en un template string.
 * Soporta tanto el formato legacy {variable} como el nuevo {{namespace.field}}
 */
export function resolveVariables(template: string, context: VariableContext): string {
  if (!template) return ''

  let result = template

  // ── 1. Variables legacy (backward compatibility) ────────────────────────
  result = result
    .replace(/\{nombre\}/gi, context.contactName || '')
    .replace(/\{name\}/gi, context.contactName || '')
    .replace(/\{numero\}/gi, context.phoneNumber || '')
    .replace(/\{number\}/gi, context.phoneNumber || '')
    .replace(/\{telefono\}/gi, context.phoneNumber || '')
    .replace(/\{phone\}/gi, context.phoneNumber || '')
    .replace(/\{vencimiento\}/gi, formatDate(context.subscriptionExpiresAt) || '')
    .replace(/\{expiracion\}/gi, formatDate(context.subscriptionExpiresAt) || '')
    .replace(/\{correo\}/gi, context.subscriptionEmail || '')
    .replace(/\{email\}/gi, context.subscriptionEmail || '')
    .replace(/\{servicio\}/gi, context.subscriptionService || '')
    .replace(/\{service\}/gi, context.subscriptionService || '')

  // ── 2. Variables de contacto {{contact.*}} ───────────────────────────────
  result = result
    .replace(/\{\{contact\.name\}\}/gi, context.contactName || '')
    .replace(/\{\{contact\.phone\}\}/gi, context.phoneNumber || '')
    .replace(/\{\{contact\.phone_number\}\}/gi, context.phoneNumber || '')
    .replace(/\{\{contact\.email\}\}/gi, context.subscriptionEmail || '')
    .replace(/\{\{contact\.status\}\}/gi, context.chatStatus || '')
    .replace(/\{\{contact\.tags\}\}/gi, (context.chatTags || []).join(', '))

  // ── 3. Variables de chat {{chat.*}} ─────────────────────────────────────
  result = result
    .replace(/\{\{chat\.id\}\}/gi, context.chatId || '')
    .replace(/\{\{chat\.status\}\}/gi, context.chatStatus || '')
    .replace(/\{\{chat\.created_at\}\}/gi, formatDate(context.chatCreatedAt) || '')
    .replace(/\{\{chat\.tags\}\}/gi, (context.chatTags || []).join(', '))

  // ── 4. Variables de suscripción {{subscription.*}} ───────────────────────
  result = result
    .replace(/\{\{subscription\.service\}\}/gi, context.subscriptionService || '')
    .replace(/\{\{subscription\.email\}\}/gi, context.subscriptionEmail || '')
    .replace(/\{\{subscription\.status\}\}/gi, context.subscriptionStatus || '')
    .replace(/\{\{subscription\.expires_at\}\}/gi, formatDate(context.subscriptionExpiresAt) || '')
    .replace(/\{\{subscription\.days_remaining\}\}/gi, () => {
      if (!context.subscriptionExpiresAt) return ''
      const expDate = new Date(context.subscriptionExpiresAt)
      const diffMs = expDate.getTime() - Date.now()
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return String(Math.max(0, days))
    })

  // ── 5. Variables de mensaje {{message.*}} ────────────────────────────────
  result = result
    .replace(/\{\{message\.text\}\}/gi, context.messageText || '')
    .replace(/\{\{message\.timestamp\}\}/gi, formatDate(context.messageTimestamp) || '')

  // ── 6. Variables de fecha {{date.*}} ────────────────────────────────────
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  result = result
    .replace(/\{\{date\.today\}\}/gi, formatDate(now) || '')
    .replace(/\{\{date\.tomorrow\}\}/gi, formatDate(tomorrow) || '')
    .replace(/\{\{date\.next_week\}\}/gi, formatDate(nextWeek) || '')
    .replace(/\{\{date\.now\}\}/gi, now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }))

  // ── 7. Campos custom {{custom.FIELD_NAME}} ───────────────────────────────
  if (context.chatCustomFields) {
    for (const [key, value] of Object.entries(context.chatCustomFields)) {
      const regex = new RegExp(`\\{\\{custom\\.${escapeRegex(key)}\\}\\}`, 'gi')
      result = result.replace(regex, String(value ?? ''))
    }
  }

  // ── 8. Variables del tenant {{tenant.*}} ────────────────────────────────
  if (context.tenantName) {
    result = result.replace(/\{\{tenant\.name\}\}/gi, context.tenantName)
  }
  if (context.tenantServiceName) {
    result = result.replace(/\{\{tenant\.service\}\}/gi, context.tenantServiceName)
  }

  return result
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: Date | string | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return String(date)
  return d.toLocaleDateString('es', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extrae todas las variables usadas en un template.
 * Útil para validación en UI.
 */
export function extractVariables(template: string): string[] {
  const matches: string[] = []

  // Match {{namespace.field}}
  const newStyle = template.matchAll(/\{\{([^}]+)\}\}/g)
  for (const m of newStyle) {
    matches.push(m[1])
  }

  // Match {legacy}
  const legacyStyle = template.matchAll(/\{([^{}]+)\}/g)
  for (const m of legacyStyle) {
    matches.push(m[1])
  }

  return [...new Set(matches)]
}

/**
 * Lista de todas las variables disponibles, agrupadas por namespace.
 * Para uso en el variable picker de la UI.
 */
export const AVAILABLE_VARIABLES = {
  contact: [
    { key: '{{contact.name}}', label: 'Nombre del contacto', example: 'Juan García' },
    { key: '{{contact.phone}}', label: 'Teléfono', example: '+59170000000' },
    { key: '{{contact.email}}', label: 'Correo electrónico', example: 'juan@email.com' },
    { key: '{{contact.status}}', label: 'Estado del chat', example: 'customer' },
    { key: '{{contact.tags}}', label: 'Etiquetas', example: 'vip, importante' },
  ],
  subscription: [
    { key: '{{subscription.service}}', label: 'Nombre del servicio', example: 'Netflix Premium' },
    { key: '{{subscription.expires_at}}', label: 'Fecha de vencimiento', example: '31/12/2025' },
    { key: '{{subscription.days_remaining}}', label: 'Días restantes', example: '7' },
    { key: '{{subscription.status}}', label: 'Estado suscripción', example: 'activo' },
    { key: '{{subscription.email}}', label: 'Correo de la cuenta', example: 'cuenta@email.com' },
  ],
  date: [
    { key: '{{date.today}}', label: 'Fecha de hoy', example: '02/04/2025' },
    { key: '{{date.tomorrow}}', label: 'Mañana', example: '03/04/2025' },
    { key: '{{date.now}}', label: 'Hora actual', example: '14:30' },
  ],
  legacy: [
    { key: '{nombre}', label: 'Nombre (legacy)', example: 'Juan' },
    { key: '{numero}', label: 'Número (legacy)', example: '+591700...' },
    { key: '{vencimiento}', label: 'Vencimiento (legacy)', example: '31/12/2025' },
    { key: '{servicio}', label: 'Servicio (legacy)', example: 'Netflix' },
  ],
}
