import { BUSINESS_TYPE_OPTIONS, isBusinessType, type BusinessType } from './business-config'
import {
  getBusinessFocusSummary,
  getBusinessGoalOption,
  getBusinessGoalTitles,
  normalizeBusinessGoalsForBusinessType,
  type BusinessGoal,
} from './business-goals'

export interface TrainingProductInput {
  name: string
  price?: number | null
  description?: string | null
}

export interface TrainingFormFields {
  assistantName: string
  businessName: string
  businessType: string
  schedule: string
  location: string
  products: string
  tone: string
  rules: string
}

export interface BusinessTrainingContext {
  assistantName?: string | null
  businessName?: string | null
  businessType: BusinessType
  goals: BusinessGoal[]
  welcomeMessage?: string | null
  serviceName?: string | null
  serviceDescription?: string | null
  products?: TrainingProductInput[]
}

interface GoalMessagingStrategy {
  directive: string
  commercialTone: string
  ctaStyle: string
  nextStep: string
  escalation: string
}

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = Object.fromEntries(
  BUSINESS_TYPE_OPTIONS.map((option) => [option.id, option.title]),
) as Record<BusinessType, string>

const GOAL_MESSAGING_STRATEGIES: Record<BusinessGoal, GoalMessagingStrategy> = {
  sell_more: {
    directive: 'Detecta intencion de compra, responde con claridad y guia hacia el cierre sin presionar.',
    commercialTone: 'Usa un tono comercial proactivo, seguro y orientado a cierre.',
    ctaStyle: 'Cierra con CTAs de avance concretos como elegir plan, confirmar pedido o pasar al pago.',
    nextStep: 'Si el cliente ya mostro interes, reduce preguntas abiertas y propon un siguiente paso claro.',
    escalation: 'Si aparece una objecion sensible o una condicion fuera de politica, ofrece apoyo humano sin frenar la venta.',
  },
  capture_leads: {
    directive: 'Cuando el cliente aun no esta listo para comprar, recoge datos clave y deja el siguiente paso claro.',
    commercialTone: 'Usa un tono consultivo y comercial, enfocado en descubrir necesidad, contexto e interes real.',
    ctaStyle: 'Cierra con CTAs de captura como pedir nombre, telefono, email, presupuesto o rubro.',
    nextStep: 'Antes de vender con fuerza, valida interes y deja agendado el seguimiento comercial.',
    escalation: 'Si el prospecto pide hablar con alguien, transfiere el lead con el contexto ya resumido.',
  },
  book_appointments: {
    directive: 'Prioriza coordinar fechas, horarios y disponibilidad cuando el cliente quiera reservar o agendar.',
    commercialTone: 'Usa un tono resolutivo y de coordinacion, transmitiendo facilidad para concretar la agenda.',
    ctaStyle: 'Cierra con CTAs de agenda como pedir fecha, hora, motivo o confirmar reserva.',
    nextStep: 'Lleva la conversacion rapido a disponibilidad y confirmacion, evitando desviar al cliente.',
    escalation: 'Si no puedes confirmar algo clave o el caso es urgente, deriva a humano explicando que el equipo continuara la gestion.',
  },
  support_customers: {
    directive: 'Maneja dudas, reclamos o problemas con calma, empatia y escalacion rapida cuando corresponda.',
    commercialTone: 'Usa un tono calmado, empatico y profesional; primero contiene y aclara antes de vender.',
    ctaStyle: 'Cierra con CTAs de resolucion como pedir detalle, evidencia, numero de pedido o aceptar escalacion humana.',
    nextStep: 'Prioriza destrabar el problema y dejar claro quien sigue y que pasara despues.',
    escalation: 'Si el cliente pide una persona, esta molesto o el caso es delicado, escala sin debatir.',
  },
  renew_clients: {
    directive: 'Recuerda beneficios de continuar, ayuda a renovar y facilita el envio de comprobantes o pagos.',
    commercialTone: 'Usa un tono de continuidad, confianza y urgencia moderada para evitar la perdida del cliente.',
    ctaStyle: 'Cierra con CTAs de renovacion como elegir plan, reactivar hoy o enviar comprobante.',
    nextStep: 'Refuerza valor y continuidad, pero siempre con un siguiente paso puntual y facil de ejecutar.',
    escalation: 'Si hay problemas de pago, excepciones o validaciones manuales, deja la renovacion encaminada y pasa a humano.',
  },
}

function getPrimaryGoal(goals: BusinessGoal[]): BusinessGoal | null {
  return goals[0] ?? null
}

function getToneForBusinessContext(type: BusinessType, goals: BusinessGoal[]): string {
  const primaryGoal = getPrimaryGoal(goals)

  switch (primaryGoal) {
    case 'support_customers':
      return 'formal'
    case 'sell_more':
      return type === 'restaurant' || type === 'store' || type === 'travel' ? 'casual' : 'amable'
    case 'capture_leads':
      return type === 'real_estate' || type === 'travel' ? 'casual' : 'amable'
    case 'book_appointments':
      return type === 'restaurant' || type === 'travel' ? 'casual' : 'amable'
    case 'renew_clients':
      return 'amable'
    default:
      break
  }

  if (type === 'clinic' || type === 'technical_service') {
    return 'formal'
  }

  if (type === 'restaurant' || type === 'store' || type === 'travel') {
    return 'casual'
  }

  return 'amable'
}

function getToneDescription(tone: string): string {
  switch (tone) {
    case 'formal':
      return 'formal, clara y profesional'
    case 'casual':
      return 'cercana, agil y natural'
    case 'divertido':
      return 'cercana, ligera y agradable'
    default:
      return 'amable, clara y profesional'
  }
}

function formatProduct(product: TrainingProductInput): string {
  const price = typeof product.price === 'number' && Number.isFinite(product.price)
    ? ` - Bs ${product.price}`
    : ''
  const description = product.description?.trim()
    ? ` (${product.description.trim()})`
    : ''

  return `${product.name}${price}${description}`
}

function buildProductLines(context: BusinessTrainingContext): string[] {
  const products = (context.products ?? []).filter((product) => product.name.trim().length > 0).slice(0, 6)

  if (products.length > 0) {
    return products.map(formatProduct)
  }

  if (context.serviceName?.trim()) {
    const description = context.serviceDescription?.trim()
      ? ` (${context.serviceDescription.trim()})`
      : ''
    return [`${context.serviceName.trim()}${description}`]
  }

  return ['Explica la oferta principal del negocio antes de responder precios o disponibilidad.']
}

function buildGoalDirectives(goals: BusinessGoal[]): string[] {
  return goals
    .map((goal) => GOAL_MESSAGING_STRATEGIES[goal]?.directive)
    .filter((directive): directive is string => Boolean(directive))
}

function buildActiveGoalMessagingLines(goals: BusinessGoal[]): string[] {
  const primaryGoal = getPrimaryGoal(goals)

  if (!primaryGoal) {
    return []
  }

  const strategy = GOAL_MESSAGING_STRATEGIES[primaryGoal]
  const primaryGoalTitle = getBusinessGoalOption(primaryGoal).title
  const secondaryTitles = getBusinessGoalTitles(goals.slice(1))
  const lines = [
    `Objetivo principal activo: ${primaryGoalTitle}.`,
    strategy.commercialTone,
    strategy.ctaStyle,
    strategy.nextStep,
    strategy.escalation,
  ]

  if (secondaryTitles.length > 0) {
    lines.push(`Objetivos de apoyo: ${secondaryTitles.join(', ')}. Usalos solo si ayudan a concretar el objetivo principal.`)
  }

  return lines
}

export interface BusinessFocusRuntimeInput {
  businessType: BusinessType
  goals: BusinessGoal[]
}

function buildRuleLines(context: BusinessTrainingContext, tone: string): string[] {
  const focusTitles = getBusinessGoalTitles(context.goals)
  const rules = [
    `Responde siempre de forma ${getToneDescription(tone)}.`,
    'Nunca inventes precios, horarios o condiciones que no esten en el contexto.',
    'Si falta informacion critica, pide el dato de forma breve antes de avanzar.',
    'Usa mensajes cortos, faciles de leer y orientados a mover la conversacion al siguiente paso.',
    'Si el cliente quiere hablar con una persona o hay un caso delicado, deriva a un humano sin discutir.',
  ]

  if (focusTitles.length > 0) {
    rules.unshift(`Prioriza este foco del negocio: ${focusTitles.join(', ')}.`)
  }

  return rules
}

export function buildSuggestedTrainingForm(context: BusinessTrainingContext): TrainingFormFields {
  const tone = getToneForBusinessContext(context.businessType, context.goals)

  return {
    assistantName: context.assistantName?.trim() || 'Asistente JABA',
    businessName: context.businessName?.trim() || context.serviceName?.trim() || 'Tu negocio',
    businessType: BUSINESS_TYPE_LABELS[context.businessType],
    schedule: '',
    location: '',
    products: buildProductLines(context).join('\n'),
    tone,
    rules: [...buildGoalDirectives(context.goals), ...buildActiveGoalMessagingLines(context.goals)].join('\n'),
  }
}

export function buildSuggestedTrainingPrompt(context: BusinessTrainingContext): string {
  const form = buildSuggestedTrainingForm(context)
  const focusSummary = getBusinessFocusSummary(context.goals)
  const objectiveLines = buildGoalDirectives(context.goals)
  const activeGoalLines = buildActiveGoalMessagingLines(context.goals)
  const ruleLines = buildRuleLines(context, form.tone)
  const promptLines: string[] = [
    `Eres ${form.assistantName}, asistente virtual de ${form.businessName} por WhatsApp.`,
    '',
    'OBJETIVO GENERAL:',
    `- Atiende clientes de forma ${getToneDescription(form.tone)}.`,
    `- Foco activo del negocio: ${focusSummary}.`,
    '- Tu meta es ayudar al cliente a avanzar al siguiente paso correcto: comprar, reservar, dejar sus datos, renovar o recibir soporte.',
    '',
    'CONTEXTO DEL NEGOCIO:',
    `- Nombre: ${form.businessName}`,
    `- Rubro: ${form.businessType}`,
  ]

  if (context.serviceName?.trim()) {
    promptLines.push(`- Oferta principal: ${context.serviceName.trim()}`)
  }

  if (context.serviceDescription?.trim()) {
    promptLines.push(`- Descripcion breve: ${context.serviceDescription.trim()}`)
  }

  if (context.welcomeMessage?.trim()) {
    promptLines.push(`- Mensaje de bienvenida base: ${context.welcomeMessage.trim()}`)
  }

  promptLines.push('')
  promptLines.push('SERVICIOS, PRODUCTOS O SOLUCIONES:')
  for (const productLine of buildProductLines(context)) {
    promptLines.push(`- ${productLine}`)
  }

  if (objectiveLines.length > 0) {
    promptLines.push('')
    promptLines.push('PRIORIDADES SEGUN EL FOCO ACTIVO:')
    for (const objectiveLine of objectiveLines) {
      promptLines.push(`- ${objectiveLine}`)
    }
  }

  if (activeGoalLines.length > 0) {
    promptLines.push('')
    promptLines.push('TONO COMERCIAL Y CTA SEGUN EL OBJETIVO ACTIVO:')
    for (const activeGoalLine of activeGoalLines) {
      promptLines.push(`- ${activeGoalLine}`)
    }
  }

  promptLines.push('')
  promptLines.push('REGLAS DE ATENCION:')
  for (const ruleLine of ruleLines) {
    promptLines.push(`- ${ruleLine}`)
  }

  promptLines.push('')
  promptLines.push('ESCALACION A HUMANO:')
  promptLines.push('- Si el cliente pide una persona, tiene un problema sensible o necesita una excepcion, informa que el equipo continuara la atencion.')
  promptLines.push('- No cierres la conversacion abruptamente: explica el siguiente paso y que informacion dejara lista para el equipo.')

  return promptLines.join('\n')
}

export function buildRuntimeBusinessFocusPrompt(input: BusinessFocusRuntimeInput): string {
  const focusSummary = getBusinessFocusSummary(input.goals)
  const directives = buildGoalDirectives(input.goals)
  const activeGoalLines = buildActiveGoalMessagingLines(input.goals)
  const lines = [
    'PRIORIDADES DEL NEGOCIO EN ESTA CONVERSACION:',
    `- Rubro activo: ${BUSINESS_TYPE_LABELS[input.businessType]}.`,
    `- Foco activo: ${focusSummary}.`,
    '- Ajusta tus respuestas para mover la conversacion hacia ese objetivo sin perder naturalidad.',
  ]

  for (const activeGoalLine of activeGoalLines) {
    lines.push(`- ${activeGoalLine}`)
  }

  for (const directive of directives) {
    lines.push(`- ${directive}`)
  }

  return lines.join('\n')
}

export function buildRuntimeFallbackTrainingPrompt(context: {
  assistantName?: string | null
  businessName?: string | null
  businessType: unknown
  goals?: unknown
  welcomeMessage?: string | null
  serviceName?: string | null
  serviceDescription?: string | null
  products?: TrainingProductInput[]
}): string {
  const businessType = isBusinessType(context.businessType) ? context.businessType : 'subscriptions'
  const goals = normalizeBusinessGoalsForBusinessType(businessType, context.goals)

  return buildSuggestedTrainingPrompt({
    assistantName: context.assistantName,
    businessName: context.businessName,
    businessType,
    goals,
    welcomeMessage: context.welcomeMessage,
    serviceName: context.serviceName,
    serviceDescription: context.serviceDescription,
    products: context.products,
  })
}
