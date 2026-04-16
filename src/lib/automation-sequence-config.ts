import { type BusinessGoal } from './business-goals'

export type AutomationSequenceKey =
  | 'sales_pending_email_followup'
  | 'sales_pending_payment_followup'
  | 'renewal_pending_payment_followup'
  | 'lead_capture_followup'
  | 'booking_confirmation_reminder'
  | 'support_escalation_sla'

export interface AutomationSequenceSetting {
  enabled: boolean
  firstDelayMinutes: number
  secondDelayMinutes: number
  firstMessage: string
  secondMessage: string
  firstTemplateName: string
  firstTemplateLanguage: string
  firstTemplateVariables: string[]
  secondTemplateName: string
  secondTemplateLanguage: string
  secondTemplateVariables: string[]
}

export interface AutomationSequencePresetDefinition {
  key: AutomationSequenceKey
  title: string
  shortTitle: string
  description: string
  triggerLabel: string
  outcomeLabel: string
  helperText: string
  defaults: AutomationSequenceSetting
}

export const AUTOMATION_SEQUENCE_PRESETS: Record<AutomationSequenceKey, AutomationSequencePresetDefinition> = {
  sales_pending_email_followup: {
    key: 'sales_pending_email_followup',
    title: 'Seguimiento cuando falta el correo',
    shortTitle: 'Falta correo',
    description: 'Recupera ventas cuando el cliente elige un plan pero todavia no comparte su correo.',
    triggerLabel: 'Se activa cuando un pedido queda pendiente por correo',
    outcomeLabel: 'Busca que el cliente envie su correo para continuar',
    helperText: 'Ideal para no perder clientes que mostraron interes pero dejaron el paso a medias.',
    defaults: {
      enabled: true,
      firstDelayMinutes: 30,
      secondDelayMinutes: 24 * 60,
      firstMessage: 'Hola. Vi que dejaste pendiente tu pedido de *{{planName}}*{{amountWithParens}}.\n\nSolo me falta tu correo para dejar listo el acceso a *{{serviceName}}*.\n\n{{goalCta}}',
      secondMessage: 'Seguimos teniendo reservado tu pedido de *{{planName}}*{{amountWithParens}}.\n\nCuando me compartas tu correo, dejo listo el siguiente paso para activar *{{serviceName}}*.\n\n{{goalCta}}',
      firstTemplateName: '',
      firstTemplateLanguage: 'es',
      firstTemplateVariables: ['{{planName}}', '{{serviceName}}'],
      secondTemplateName: '',
      secondTemplateLanguage: 'es',
      secondTemplateVariables: ['{{planName}}', '{{serviceName}}'],
    },
  },
  sales_pending_payment_followup: {
    key: 'sales_pending_payment_followup',
    title: 'Seguimiento cuando falta el pago',
    shortTitle: 'Falta pago',
    description: 'Recuerda al cliente que su pedido sigue pendiente y le invita a enviar el comprobante.',
    triggerLabel: 'Se activa cuando un pedido queda pendiente de pago',
    outcomeLabel: 'Busca destrabar pagos y comprobantes',
    helperText: 'Funciona muy bien para ventas que ya llegaron al QR o al paso final.',
    defaults: {
      enabled: true,
      firstDelayMinutes: 12 * 60,
      secondDelayMinutes: 24 * 60,
      firstMessage: 'Hola. Te escribo para recordarte que tu pedido de *{{planName}}*{{amountWithParens}} sigue pendiente de pago.{{customerEmailLine}}\n\nPuedes pagar por *{{paymentMethods}}* y enviarme el comprobante por aqui.\n\n{{goalCta}}',
      secondMessage: 'Sigo teniendo pendiente tu activacion de *{{planName}}*{{amountWithParens}}.{{customerEmailLine}}\n\nSi ya hiciste el pago, enviame el comprobante por aqui. Si aun no, tambien puedo ayudarte a retomarlo ahora mismo.\n\n{{goalCta}}',
      firstTemplateName: '',
      firstTemplateLanguage: 'es',
      firstTemplateVariables: ['{{planName}}', '{{amount}}', '{{paymentMethods}}'],
      secondTemplateName: '',
      secondTemplateLanguage: 'es',
      secondTemplateVariables: ['{{planName}}', '{{amount}}', '{{paymentMethods}}'],
    },
  },
  renewal_pending_payment_followup: {
    key: 'renewal_pending_payment_followup',
    title: 'Seguimiento de renovaciones pendientes',
    shortTitle: 'Renovacion pendiente',
    description: 'Hace seguimiento a clientes que ya eligieron renovar pero todavia no enviaron el pago.',
    triggerLabel: 'Se activa cuando una renovacion queda pendiente de pago',
    outcomeLabel: 'Busca cerrar renovaciones sin persecucion manual',
    helperText: 'Ayuda mucho en cuentas con muchos vencimientos o renovaciones diarias.',
    defaults: {
      enabled: true,
      firstDelayMinutes: 12 * 60,
      secondDelayMinutes: 24 * 60,
      firstMessage: 'Hola. Tu renovacion de *{{planName}}*{{amountWithParens}} sigue pendiente de pago.{{customerEmailLine}}\n\nSi ya quieres dejarla lista, puedes pagar por *{{paymentMethods}}* y enviarme el comprobante por este chat.\n\n{{goalCta}}',
      secondMessage: 'Te dejo un ultimo recordatorio de tu renovacion de *{{planName}}*{{amountWithParens}}.{{customerEmailLine}}\n\nSi ya realizaste el pago, enviame el comprobante por aqui y seguimos con la validacion.\n\n{{goalCta}}',
      firstTemplateName: '',
      firstTemplateLanguage: 'es',
      firstTemplateVariables: ['{{planName}}', '{{amount}}', '{{paymentMethods}}'],
      secondTemplateName: '',
      secondTemplateLanguage: 'es',
      secondTemplateVariables: ['{{planName}}', '{{amount}}', '{{paymentMethods}}'],
    },
  },
  lead_capture_followup: {
    key: 'lead_capture_followup',
    title: 'Seguimiento de leads interesados',
    shortTitle: 'Lead interesado',
    description: 'Da seguimiento a contactos que mostraron interes pero no dejaron todos sus datos.',
    triggerLabel: 'Se activa cuando un cliente muestra interes o pide informacion',
    outcomeLabel: 'Busca recuperar el contacto y pedir el siguiente dato util',
    helperText: 'Ideal para negocios que reciben preguntas y no quieren dejar leads frios.',
    defaults: {
      enabled: true,
      firstDelayMinutes: 60,
      secondDelayMinutes: 24 * 60,
      firstMessage: 'Hola{{contactNameWithComma}}. Queria dar seguimiento a tu consulta sobre *{{serviceName}}*.\n\nSi todavia te interesa, respondeme por aqui y te ayudo con el siguiente paso.\n\n{{goalCta}}',
      secondMessage: 'Te dejo un ultimo recordatorio para no perder tu consulta sobre *{{serviceName}}*.\n\nSi quieres avanzar, respondeme con el dato que te falte o cuentame que necesitas resolver.',
      firstTemplateName: '',
      firstTemplateLanguage: 'es',
      firstTemplateVariables: ['{{serviceName}}'],
      secondTemplateName: '',
      secondTemplateLanguage: 'es',
      secondTemplateVariables: ['{{serviceName}}'],
    },
  },
  booking_confirmation_reminder: {
    key: 'booking_confirmation_reminder',
    title: 'Recordatorio para reservas o citas',
    shortTitle: 'Reserva/cita',
    description: 'Recuerda al cliente confirmar fecha, hora o datos necesarios para una reserva.',
    triggerLabel: 'Se activa cuando el cliente quiere agendar o reservar',
    outcomeLabel: 'Busca confirmar la cita o reserva sin seguimiento manual',
    helperText: 'Pensado para clinicas, restaurantes, viajes, servicios y negocios con agenda.',
    defaults: {
      enabled: true,
      firstDelayMinutes: 45,
      secondDelayMinutes: 12 * 60,
      firstMessage: 'Hola{{contactNameWithComma}}. Dejamos pendiente confirmar tu reserva o cita en *{{serviceName}}*.\n\nRespondeme con fecha, hora o el dato que falte y lo dejamos encaminado.',
      secondMessage: 'Seguimos teniendo pendiente tu confirmacion para la reserva o cita.\n\nSi aun quieres avanzar, escribeme por aqui y retomamos desde donde quedamos.',
      firstTemplateName: '',
      firstTemplateLanguage: 'es',
      firstTemplateVariables: ['{{serviceName}}'],
      secondTemplateName: '',
      secondTemplateLanguage: 'es',
      secondTemplateVariables: ['{{serviceName}}'],
    },
  },
  support_escalation_sla: {
    key: 'support_escalation_sla',
    title: 'Seguimiento de soporte pendiente',
    shortTitle: 'Soporte SLA',
    description: 'Evita que casos de soporte queden abiertos sin respuesta o sin dato clave.',
    triggerLabel: 'Se activa cuando el cliente pide ayuda o reporta un problema',
    outcomeLabel: 'Busca recopilar informacion y mantener el caso vivo',
    helperText: 'Muy util para reclamos, soporte tecnico, cambios, incidentes o consultas urgentes.',
    defaults: {
      enabled: true,
      firstDelayMinutes: 30,
      secondDelayMinutes: 4 * 60,
      firstMessage: 'Hola{{contactNameWithComma}}. Sigo pendiente de tu caso en *{{serviceName}}*.\n\nSi puedes, enviame el detalle que falta para ayudarte mejor. Si ya se resolvio, tambien puedes avisarme por aqui.',
      secondMessage: 'Te escribo para cerrar bien el seguimiento de tu caso.\n\nSi sigues necesitando ayuda, respondeme por aqui y lo mantenemos activo para el equipo.',
      firstTemplateName: '',
      firstTemplateLanguage: 'es',
      firstTemplateVariables: ['{{serviceName}}'],
      secondTemplateName: '',
      secondTemplateLanguage: 'es',
      secondTemplateVariables: ['{{serviceName}}'],
    },
  },
}

export const AUTOMATION_SEQUENCE_KEYS = Object.keys(AUTOMATION_SEQUENCE_PRESETS) as AutomationSequenceKey[]

export interface AutomationSequenceProfileSettings {
  [key: string]: Partial<AutomationSequenceSetting> | undefined
}

export type AutomationSequencePackKey =
  | 'sales_recovery'
  | 'lead_capture'
  | 'booking_recovery'
  | 'support_sla'
  | 'renewal_recovery'
  | 'full_followup'

export interface AutomationSequencePackDefinition {
  key: AutomationSequencePackKey
  title: string
  description: string
  helperText: string
  sequenceKeys: AutomationSequenceKey[]
  recommendedGoals?: BusinessGoal[]
}

export interface AutomationSequenceCustomPackDefinition {
  key: string
  title: string
  sequenceKeys: AutomationSequenceKey[]
  createdAt: string
  updatedAt: string
}

export const AUTOMATION_SEQUENCE_PACKS: Record<AutomationSequencePackKey, AutomationSequencePackDefinition> = {
  sales_recovery: {
    key: 'sales_recovery',
    title: 'Pack recuperar ventas',
    description: 'Activa el seguimiento cuando falta correo o cuando falta pago en ventas.',
    helperText: 'Ideal para cuentas que quieren cerrar más pedidos sin perseguir uno por uno.',
    sequenceKeys: ['sales_pending_email_followup', 'sales_pending_payment_followup'],
    recommendedGoals: ['sell_more', 'capture_leads'],
  },
  lead_capture: {
    key: 'lead_capture',
    title: 'Pack seguimiento de leads',
    description: 'Activa seguimiento para contactos interesados que aun no avanzan.',
    helperText: 'Bueno para no dejar preguntas calientes sin una segunda oportunidad.',
    sequenceKeys: ['lead_capture_followup'],
    recommendedGoals: ['capture_leads', 'sell_more'],
  },
  booking_recovery: {
    key: 'booking_recovery',
    title: 'Pack cerrar reservas',
    description: 'Activa recordatorios para clientes que quieren reservar o agendar.',
    helperText: 'Ideal para citas, mesas, viajes, consultas o servicios con agenda.',
    sequenceKeys: ['booking_confirmation_reminder'],
    recommendedGoals: ['book_appointments'],
  },
  support_sla: {
    key: 'support_sla',
    title: 'Pack soporte pendiente',
    description: 'Activa seguimiento para casos de ayuda o reclamos que no deben enfriarse.',
    helperText: 'Ayuda a mantener casos abiertos con trazabilidad y menos abandono.',
    sequenceKeys: ['support_escalation_sla'],
    recommendedGoals: ['support_customers'],
  },
  renewal_recovery: {
    key: 'renewal_recovery',
    title: 'Pack cerrar renovaciones',
    description: 'Deja activa la secuencia enfocada en renovaciones pendientes de pago.',
    helperText: 'Pensado para negocios que viven de continuidad, vencimientos o renovaciones.',
    sequenceKeys: ['renewal_pending_payment_followup'],
    recommendedGoals: ['renew_clients'],
  },
  full_followup: {
    key: 'full_followup',
    title: 'Pack seguimiento completo',
    description: 'Activa todas las secuencias para ventas nuevas y renovaciones.',
    helperText: 'La opción más completa para no dejar conversaciones valiosas sin seguimiento.',
    sequenceKeys: ['sales_pending_email_followup', 'sales_pending_payment_followup', 'lead_capture_followup', 'booking_confirmation_reminder', 'support_escalation_sla', 'renewal_pending_payment_followup'],
    recommendedGoals: ['sell_more', 'renew_clients', 'capture_leads', 'book_appointments', 'support_customers'],
  },
}

export interface AutomationSequenceSimulationContext {
  planName: string
  serviceName: string
  paymentMethods: string
  currencySymbol: string
  amount: number
  customerEmail?: string | null
  contactName?: string | null
  triggerText?: string | null
  goals: BusinessGoal[]
}

function clampDelay(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), 7 * 24 * 60)
}

function normalizeMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeEnabled(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeTemplateName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 120) : ''
}

function normalizeTemplateLanguage(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized.length > 0 ? normalized.slice(0, 16) : fallback
}

function normalizeTemplateVariables(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback

  const variables = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 10)

  return variables.length > 0 ? variables : fallback
}

export function getDefaultAutomationSequenceSetting(
  key: AutomationSequenceKey,
): AutomationSequenceSetting {
  const defaults = AUTOMATION_SEQUENCE_PRESETS[key].defaults
  return {
    enabled: defaults.enabled,
    firstDelayMinutes: defaults.firstDelayMinutes,
    secondDelayMinutes: defaults.secondDelayMinutes,
    firstMessage: defaults.firstMessage,
    secondMessage: defaults.secondMessage,
    firstTemplateName: defaults.firstTemplateName,
    firstTemplateLanguage: defaults.firstTemplateLanguage,
    firstTemplateVariables: defaults.firstTemplateVariables,
    secondTemplateName: defaults.secondTemplateName,
    secondTemplateLanguage: defaults.secondTemplateLanguage,
    secondTemplateVariables: defaults.secondTemplateVariables,
  }
}

export function normalizeAutomationSequenceSetting(
  key: AutomationSequenceKey,
  value: unknown,
): AutomationSequenceSetting {
  const defaults = getDefaultAutomationSequenceSetting(key)
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as Partial<AutomationSequenceSetting>
      : {}

  return {
    enabled: normalizeEnabled(source.enabled, defaults.enabled),
    firstDelayMinutes: clampDelay(source.firstDelayMinutes, defaults.firstDelayMinutes),
    secondDelayMinutes: clampDelay(source.secondDelayMinutes, defaults.secondDelayMinutes),
    firstMessage: normalizeMessage(source.firstMessage, defaults.firstMessage),
    secondMessage: normalizeMessage(source.secondMessage, defaults.secondMessage),
    firstTemplateName: normalizeTemplateName(source.firstTemplateName),
    firstTemplateLanguage: normalizeTemplateLanguage(source.firstTemplateLanguage, defaults.firstTemplateLanguage),
    firstTemplateVariables: normalizeTemplateVariables(source.firstTemplateVariables, defaults.firstTemplateVariables),
    secondTemplateName: normalizeTemplateName(source.secondTemplateName),
    secondTemplateLanguage: normalizeTemplateLanguage(source.secondTemplateLanguage, defaults.secondTemplateLanguage),
    secondTemplateVariables: normalizeTemplateVariables(source.secondTemplateVariables, defaults.secondTemplateVariables),
  }
}

export function normalizeAutomationSequenceProfileSettings(
  value: unknown,
): Record<AutomationSequenceKey, AutomationSequenceSetting> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as AutomationSequenceProfileSettings
      : {}

  return AUTOMATION_SEQUENCE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = normalizeAutomationSequenceSetting(key, source[key])
    return accumulator
  }, {} as Record<AutomationSequenceKey, AutomationSequenceSetting>)
}

function normalizeCustomPackTitle(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed.length > 0 ? trimmed.slice(0, 60) : fallback
}

function normalizeCustomPackKey(value: unknown, index: number): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return `custom_pack_${index + 1}`
}

function normalizeCustomPackSequenceKeys(value: unknown): AutomationSequenceKey[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<AutomationSequenceKey>()
  const keys: AutomationSequenceKey[] = []

  for (const entry of value) {
    if (typeof entry !== 'string') continue
    if (!AUTOMATION_SEQUENCE_KEYS.includes(entry as AutomationSequenceKey)) continue

    const key = entry as AutomationSequenceKey
    if (seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }

  return keys
}

export function normalizeAutomationSequenceCustomPacks(
  value: unknown,
): AutomationSequenceCustomPackDefinition[] {
  if (!Array.isArray(value)) return []

  const seenKeys = new Set<string>()
  const packs: AutomationSequenceCustomPackDefinition[] = []

  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue

    const source = entry as Record<string, unknown>
    const sequenceKeys = normalizeCustomPackSequenceKeys(source.sequenceKeys)
    if (sequenceKeys.length === 0) continue

    let key = normalizeCustomPackKey(source.key, index)
    if (seenKeys.has(key)) {
      key = `${key}_${index + 1}`
    }
    seenKeys.add(key)

    const createdAt =
      typeof source.createdAt === 'string' && source.createdAt.trim().length > 0
        ? source.createdAt
        : new Date(0).toISOString()
    const updatedAt =
      typeof source.updatedAt === 'string' && source.updatedAt.trim().length > 0
        ? source.updatedAt
        : createdAt

    packs.push({
      key,
      title: normalizeCustomPackTitle(source.title, `Pack propio ${packs.length + 1}`),
      sequenceKeys,
      createdAt,
      updatedAt,
    })
  }

  return packs
}

export function getAutomationSequenceSetting(
  settings: unknown,
  key: AutomationSequenceKey,
): AutomationSequenceSetting {
  const normalized =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? settings as Record<string, unknown>
      : {}

  return normalizeAutomationSequenceSetting(key, normalized[key])
}

export function getGoalAwareSequenceCta(goals: BusinessGoal[]): string {
  const primaryGoal = goals[0] ?? 'sell_more'

  switch (primaryGoal) {
    case 'capture_leads':
      return 'Si quieres, respondeme aqui y dejo tus datos listos para continuar sin perder el seguimiento.'
    case 'book_appointments':
      return 'Si ya quieres avanzar, respondeme aqui y dejamos la confirmacion encaminada.'
    case 'support_customers':
      return 'Si sigues con el caso activo, respondeme aqui y lo dejamos bien encaminado para el equipo.'
    case 'renew_clients':
      return 'Si ya lo quieres dejar resuelto hoy, respondeme aqui y seguimos con la renovacion.'
    default:
      return 'Si todavia te interesa, respondeme aqui y te ayudo a cerrar el siguiente paso.'
  }
}

export function renderAutomationSequenceTemplate(
  template: string,
  context: AutomationSequenceSimulationContext,
): string {
  const amountText = context.amount > 0 ? `${context.currencySymbol} ${context.amount}` : ''
  const amountWithParens = amountText ? ` (${amountText})` : ''
  const customerEmailLine = context.customerEmail ? `\nCuenta: *${context.customerEmail}*` : ''
  const contactName = context.contactName?.trim() || ''
  const contactNameWithComma = contactName ? ` ${contactName},` : ''
  const replacements: Record<string, string> = {
    '{{planName}}': context.planName,
    '{{amount}}': amountText,
    '{{amountWithParens}}': amountWithParens,
    '{{serviceName}}': context.serviceName,
    '{{paymentMethods}}': context.paymentMethods,
    '{{customerEmail}}': context.customerEmail || '',
    '{{customerEmailLine}}': customerEmailLine,
    '{{contactName}}': contactName,
    '{{contactNameWithComma}}': contactNameWithComma,
    '{{triggerText}}': context.triggerText || '',
    '{{goalCta}}': getGoalAwareSequenceCta(context.goals),
  }

  let message = template
  for (const [key, value] of Object.entries(replacements)) {
    message = message.split(key).join(value)
  }

  return message.trim()
}

export function renderAutomationSequenceTemplateVariables(
  variables: string[],
  context: AutomationSequenceSimulationContext,
): string[] {
  return variables.map((variable) => renderAutomationSequenceTemplate(variable, context) || ' ')
}

export function formatDelayLabel(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60
    return `${hours} h`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} h ${minutes} min`
}
