import { BUSINESS_TYPES, type BusinessType } from './business-config'
import type { BusinessGoal } from './business-goals'
import type { ConditionOperator, ConditionType } from './trigger-conditions'
import type { ActionType } from './trigger-actions'

export type BusinessIntentId =
  | 'greeting_or_help'
  | 'price_inquiry'
  | 'catalog_request'
  | 'purchase_intent'
  | 'booking_intent'
  | 'payment_proof'
  | 'human_request'
  | 'support_request'
  | 'location_request'
  | 'hours_request'
  | 'delivery_intent'
  | 'renewal_intent'
  | 'urgent_request'
  | 'course_inquiry'
  | 'property_inquiry'
  | 'technical_service_request'
  | 'travel_quote'
  | 'inactive_customer'

export interface BusinessIntentConditionTemplate {
  condition_type: ConditionType
  operator: ConditionOperator
  value: string
  payload?: Record<string, unknown>
}

export interface BusinessIntentActionTemplate {
  type: ActionType
  payload: Record<string, unknown>
  delay_seconds?: number
}

export interface BusinessIntentDefinition {
  id: BusinessIntentId
  title: string
  description: string
  priority: number
  businessTypes: BusinessType[]
  goals?: BusinessGoal[]
  keywords: string[]
  conditions?: BusinessIntentConditionTemplate[]
  recommendedActions: BusinessIntentActionTemplate[]
}

export interface BusinessIntentTriggerTemplate {
  id: string
  name: string
  description: string
  type: 'logic' | 'time'
  conditionsLogic?: 'AND' | 'OR'
  conditions: BusinessIntentConditionTemplate[]
  actions: BusinessIntentActionTemplate[]
}

const ALL_BUSINESS_TYPES: BusinessType[] = [...BUSINESS_TYPES]

function textReply(message: string, tag: string, delaySeconds = 1): BusinessIntentActionTemplate[] {
  return [
    {
      type: 'send_text',
      payload: { message },
    },
    {
      type: 'add_tag',
      payload: { tag },
      delay_seconds: delaySeconds,
    },
  ]
}

function alertAdmin(title: string, message: string, delaySeconds = 1): BusinessIntentActionTemplate {
  return {
    type: 'notify_admin',
    payload: { title, message, channel: 'log' },
    delay_seconds: delaySeconds,
  }
}

function statusAction(status: string, delaySeconds = 1): BusinessIntentActionTemplate {
  return {
    type: 'set_status',
    payload: { status },
    delay_seconds: delaySeconds,
  }
}

export const BUSINESS_INTENT_DEFINITIONS: BusinessIntentDefinition[] = [
  {
    id: 'greeting_or_help',
    title: 'Saludo o ayuda inicial',
    description: 'Detecta saludos y pedidos generales de informacion para iniciar una conversacion guiada.',
    priority: 5,
    businessTypes: ALL_BUSINESS_TYPES,
    keywords: ['hola', 'buenas', 'menu', 'ayuda', 'informacion', 'info'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Estoy aqui para ayudarte. Cuentame que necesitas y te guio al siguiente paso.',
      'solicita-ayuda',
    ),
  },
  {
    id: 'price_inquiry',
    title: 'Consulta de precio',
    description: 'Detecta clientes que preguntan por precio, costo, planes o disponibilidad.',
    priority: 10,
    businessTypes: ['subscriptions', 'store', 'restaurant', 'gym', 'education', 'technical_service', 'travel', 'custom'],
    goals: ['sell_more'],
    keywords: ['precio', 'precios', 'cuanto', 'costo', 'vale', 'plan', 'planes', 'disponible'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te ayudo con precios y disponibilidad. Dime que producto, servicio o plan te interesa.',
      'consulta-precio',
    ),
  },
  {
    id: 'catalog_request',
    title: 'Solicitud de catalogo o menu',
    description: 'Detecta clientes que piden catalogo, menu, carta, lista de productos o servicios.',
    priority: 10,
    businessTypes: ['restaurant', 'store', 'gym', 'education', 'travel', 'custom'],
    goals: ['sell_more'],
    keywords: ['catalogo', 'menu', 'carta', 'productos', 'servicios', 'lista', 'opciones'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te paso nuestras opciones. Dime que te interesa y te ayudo a elegir.',
      'solicita-catalogo',
    ),
  },
  {
    id: 'purchase_intent',
    title: 'Intencion de compra',
    description: 'Detecta mensajes donde el cliente quiere comprar, reservar un producto o avanzar al pago.',
    priority: 20,
    businessTypes: ['store', 'restaurant', 'travel', 'custom'],
    goals: ['sell_more'],
    keywords: ['comprar', 'quiero', 'pedido', 'lo quiero', 'separar', 'reservar', 'pagar'],
    recommendedActions: [
      ...textReply(
        'Perfecto {{contact.name}}. Te ayudo a completar tu pedido. Confirmame que opcion quieres y tu metodo de pago.',
        'intencion-compra',
      ),
      statusAction('pending', 2),
    ],
  },
  {
    id: 'booking_intent',
    title: 'Reserva o cita',
    description: 'Detecta clientes que quieren agendar una cita, reservar una visita, clase o mesa.',
    priority: 20,
    businessTypes: ['restaurant', 'clinic', 'gym', 'education', 'real_estate', 'travel', 'custom'],
    goals: ['book_appointments'],
    keywords: ['cita', 'reserva', 'reservar', 'agendar', 'agenda', 'turno', 'visita', 'horario'],
    recommendedActions: textReply(
      'Claro {{contact.name}}. Te ayudo a coordinar. Indica el dia, horario preferido y el motivo de la reserva.',
      'reserva-pendiente',
    ),
  },
  {
    id: 'payment_proof',
    title: 'Comprobante o pago recibido',
    description: 'Detecta comprobantes, transferencias, QR y mensajes de pago para confirmar recepcion.',
    priority: 30,
    businessTypes: ['subscriptions', 'restaurant', 'store', 'gym', 'education', 'technical_service', 'travel', 'custom'],
    goals: ['renew_clients', 'sell_more'],
    keywords: ['pague', 'pago', 'pagado', 'comprobante', 'transferencia', 'qr', 'deposito', 'boleta'],
    recommendedActions: [
      ...textReply(
        'Gracias {{contact.name}}. Recibimos tu mensaje de pago. Revisaremos el comprobante y te confirmaremos en breve.',
        'pago-recibido',
      ),
      alertAdmin('Pago por revisar', '{{contact.name}} envio un mensaje de pago: {{message.text}}', 2),
    ],
  },
  {
    id: 'human_request',
    title: 'Solicitud de asesor humano',
    description: 'Detecta cuando el cliente pide hablar con una persona, asesor u operador.',
    priority: 40,
    businessTypes: ALL_BUSINESS_TYPES,
    goals: ['support_customers'],
    keywords: ['humano', 'persona', 'asesor', 'operador', 'agente', 'atencion', 'ejecutivo'],
    recommendedActions: [
      ...textReply(
        'Entendido {{contact.name}}. Te conectaremos con una persona del equipo para ayudarte mejor.',
        'requiere-humano',
      ),
      alertAdmin('Cliente pide atencion humana', '{{contact.name}} solicita hablar con una persona. Chat: {{chat.id}}', 1),
    ],
  },
  {
    id: 'support_request',
    title: 'Solicitud de soporte',
    description: 'Detecta dudas, problemas, fallas o reclamos que requieren soporte.',
    priority: 30,
    businessTypes: ['subscriptions', 'store', 'technical_service', 'custom'],
    goals: ['support_customers'],
    keywords: ['soporte', 'problema', 'ayuda', 'falla', 'error', 'reclamo', 'no funciona'],
    recommendedActions: [
      ...textReply(
        'Lamento el inconveniente, {{contact.name}}. Cuentame que ocurrio y te ayudaremos a resolverlo.',
        'requiere-soporte',
      ),
      alertAdmin('Solicitud de soporte', '{{contact.name}} reporto: {{message.text}}', 2),
    ],
  },
  {
    id: 'location_request',
    title: 'Solicitud de ubicacion',
    description: 'Detecta cuando el cliente pregunta por direccion, sucursal o zona de atencion.',
    priority: 10,
    businessTypes: ['restaurant', 'store', 'clinic', 'gym', 'education', 'real_estate', 'technical_service', 'custom'],
    keywords: ['direccion', 'ubicacion', 'donde', 'sucursal', 'lugar', 'zona', 'mapa'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te comparto la informacion de ubicacion. Tambien puedo ayudarte con horarios o disponibilidad.',
      'solicita-ubicacion',
    ),
  },
  {
    id: 'hours_request',
    title: 'Consulta de horarios',
    description: 'Detecta preguntas sobre horarios, atencion, apertura y disponibilidad.',
    priority: 10,
    businessTypes: ALL_BUSINESS_TYPES,
    keywords: ['horario', 'horarios', 'abren', 'atienden', 'disponible', 'hoy', 'manana'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te ayudo con horarios y disponibilidad. Para que dia necesitas la informacion?',
      'consulta-horario',
    ),
  },
  {
    id: 'delivery_intent',
    title: 'Delivery o envio',
    description: 'Detecta pedidos con delivery, envio, direccion o recojo.',
    priority: 20,
    businessTypes: ['restaurant', 'store', 'custom'],
    goals: ['sell_more'],
    keywords: ['delivery', 'envio', 'domicilio', 'direccion', 'recoger', 'recojo'],
    recommendedActions: textReply(
      'Perfecto {{contact.name}}. Dime tu direccion o si prefieres recoger, y confirmamos disponibilidad.',
      'delivery-pendiente',
    ),
  },
  {
    id: 'renewal_intent',
    title: 'Renovacion o vencimiento',
    description: 'Detecta clientes que preguntan por renovar, vencimiento o continuidad del servicio.',
    priority: 30,
    businessTypes: ['subscriptions', 'gym', 'education'],
    goals: ['renew_clients'],
    keywords: ['renovar', 'renovacion', 'vence', 'vencimiento', 'activar', 'mensualidad'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te ayudo a renovar para que mantengas tu acceso activo. Enviame tu comprobante o dime que plan deseas.',
      'renovacion-pendiente',
    ),
  },
  {
    id: 'urgent_request',
    title: 'Urgencia',
    description: 'Detecta palabras de urgencia para priorizar la atencion del cliente.',
    priority: 50,
    businessTypes: ['clinic', 'technical_service', 'travel', 'custom'],
    goals: ['support_customers'],
    keywords: ['urgente', 'emergencia', 'rapido', 'ahora', 'prioridad', 'grave'],
    recommendedActions: [
      ...textReply(
        'Entendido {{contact.name}}. Vamos a priorizar tu solicitud. Describe brevemente que ocurre para derivarte mejor.',
        'urgente',
      ),
      alertAdmin('Solicitud urgente', '{{contact.name}} envio una solicitud urgente: {{message.text}}', 1),
    ],
  },
  {
    id: 'course_inquiry',
    title: 'Consulta de curso',
    description: 'Detecta interesados en cursos, clases, inscripciones, cupos y horarios.',
    priority: 20,
    businessTypes: ['education', 'custom'],
    goals: ['capture_leads', 'book_appointments'],
    keywords: ['curso', 'clase', 'inscripcion', 'academia', 'cupos', 'certificado'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te ayudo con informacion de cursos, horarios e inscripcion. Que area te interesa?',
      'interes-curso',
    ),
  },
  {
    id: 'property_inquiry',
    title: 'Consulta de propiedad',
    description: 'Detecta interesados en comprar, alquilar o visitar una propiedad.',
    priority: 20,
    businessTypes: ['real_estate', 'custom'],
    goals: ['capture_leads', 'book_appointments'],
    keywords: ['casa', 'departamento', 'propiedad', 'alquiler', 'comprar', 'visita', 'terreno'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te ayudo a encontrar una propiedad. Buscas comprar, alquilar o agendar una visita?',
      'lead-inmobiliario',
    ),
  },
  {
    id: 'technical_service_request',
    title: 'Solicitud tecnica',
    description: 'Detecta reparaciones, diagnosticos, fallas y cotizaciones de servicio tecnico.',
    priority: 20,
    businessTypes: ['technical_service', 'custom'],
    goals: ['support_customers', 'sell_more'],
    keywords: ['reparar', 'reparacion', 'soporte', 'falla', 'diagnostico', 'cotizacion', 'servicio tecnico'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te ayudo con soporte tecnico. Dime que equipo tienes y que problema presenta.',
      'soporte-tecnico',
    ),
  },
  {
    id: 'travel_quote',
    title: 'Cotizacion de viaje',
    description: 'Detecta consultas de viajes, paquetes, vuelos, hoteles, tours y reservas.',
    priority: 20,
    businessTypes: ['travel', 'custom'],
    goals: ['sell_more', 'capture_leads', 'book_appointments'],
    keywords: ['viaje', 'paquete', 'reserva', 'tour', 'hotel', 'vuelo', 'cotizar', 'destino'],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Te ayudo a cotizar tu viaje. Que destino y fechas tienes en mente?',
      'interes-viaje',
    ),
  },
  {
    id: 'inactive_customer',
    title: 'Cliente inactivo',
    description: 'Detecta conversaciones sin actividad por 24 horas para enviar seguimiento.',
    priority: 15,
    businessTypes: ALL_BUSINESS_TYPES,
    keywords: [],
    conditions: [
      {
        condition_type: 'last_message_time',
        operator: 'greater_equal',
        value: '1440',
        payload: { minutes: 1440 },
      },
    ],
    recommendedActions: textReply(
      'Hola {{contact.name}}. Solo paso a confirmar si aun necesitas ayuda. Estoy disponible para continuar.',
      'seguimiento-inactivo',
    ),
  },
]

export function getBusinessIntentById(id: BusinessIntentId): BusinessIntentDefinition | undefined {
  return BUSINESS_INTENT_DEFINITIONS.find((intent) => intent.id === id)
}

export function getIntentDefinitionsForBusinessType(type: BusinessType): BusinessIntentDefinition[] {
  return BUSINESS_INTENT_DEFINITIONS
    .filter((intent) => intent.businessTypes.includes(type))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
}

export function getIntentKeywordsForBusinessType(type: BusinessType): string[] {
  const keywords = getIntentDefinitionsForBusinessType(type).flatMap((intent) => intent.keywords)
  return Array.from(new Set(keywords)).sort()
}

export function getBusinessIntentConditions(intent: BusinessIntentDefinition): BusinessIntentConditionTemplate[] {
  if (intent.conditions?.length) {
    return intent.conditions.map((condition) => ({
      ...condition,
      payload: condition.payload ? { ...condition.payload } : undefined,
    }))
  }

  return intent.keywords.map((keyword) => ({
    condition_type: 'text_contains',
    operator: 'contains',
    value: keyword,
    payload: { words: intent.keywords.join(',') },
  }))
}

export function createTriggerTemplateFromIntent(
  intent: BusinessIntentDefinition,
  overrides: Partial<Pick<BusinessIntentTriggerTemplate, 'id' | 'name' | 'description' | 'actions'>> = {},
): BusinessIntentTriggerTemplate {
  const conditions = getBusinessIntentConditions(intent)

  return {
    id: overrides.id ?? `intent_${intent.id}`,
    name: overrides.name ?? intent.title,
    description: overrides.description ?? intent.description,
    type: conditions.some((condition) => condition.condition_type === 'last_message_time') ? 'time' : 'logic',
    conditionsLogic: 'OR',
    conditions,
    actions: (overrides.actions ?? intent.recommendedActions).map((action) => ({
      ...action,
      payload: { ...action.payload },
    })),
  }
}
