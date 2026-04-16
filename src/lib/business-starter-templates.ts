import type { BusinessType } from './business-config'
import {
  getDefaultGoalsForBusinessType,
  normalizeBusinessGoalsForBusinessType,
  type BusinessGoal,
} from './business-goals'
import {
  createTriggerTemplateFromIntent,
  getBusinessIntentById,
  type BusinessIntentActionTemplate,
  type BusinessIntentId,
} from './business-intents'

export interface StarterFlowNode {
  type: string
  label: string
  position_x: number
  position_y: number
  config: Record<string, unknown>
}

export interface StarterFlowEdge {
  sourceIndex: number
  targetIndex: number
  source_handle: string
  label: string
}

export interface StarterFlowTemplate {
  id: string
  name: string
  description: string
  priority: number
  nodes: StarterFlowNode[]
  edges: StarterFlowEdge[]
}

export interface StarterTriggerCondition {
  condition_type: string
  operator: string
  value: string
  payload?: Record<string, unknown>
}

export interface StarterTriggerAction {
  type: string
  payload: Record<string, unknown>
  delay_seconds?: number
}

export interface StarterTriggerTemplate {
  id: string
  name: string
  description: string
  type: 'logic' | 'time'
  conditionsLogic?: 'AND' | 'OR'
  conditions: StarterTriggerCondition[]
  actions: StarterTriggerAction[]
}

export interface StarterTemplatePack {
  flows: StarterFlowTemplate[]
  triggers: StarterTriggerTemplate[]
}

function menuFlow(
  id: string,
  name: string,
  description: string,
  keywords: string[],
  greeting: string,
  question: string,
  buttons: Array<{ id: string; title: string }>,
  variableName: string,
  aiPrompt: string,
): StarterFlowTemplate {
  return {
    id,
    name,
    description,
    priority: 10,
    nodes: [
      {
        type: 'trigger',
        label: 'Inicio por palabra clave',
        position_x: 400,
        position_y: 0,
        config: { trigger_type: 'keyword', keywords, match_mode: 'contains' },
      },
      {
        type: 'message',
        label: 'Bienvenida',
        position_x: 400,
        position_y: 150,
        config: { text: greeting },
      },
      {
        type: 'buttons',
        label: 'Opciones principales',
        position_x: 400,
        position_y: 300,
        config: { text: question, buttons },
      },
      {
        type: 'wait_input',
        label: 'Esperar respuesta',
        position_x: 400,
        position_y: 450,
        config: { variable_name: variableName },
      },
      {
        type: 'ai_response',
        label: 'IA guia al cliente',
        position_x: 400,
        position_y: 600,
        config: { system_prompt: aiPrompt },
      },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
      { sourceIndex: 3, targetIndex: 4, source_handle: 'default', label: '' },
    ],
  }
}

function triggerActions(
  message: string,
  tag: string,
): BusinessIntentActionTemplate[] {
  return [
    {
      type: 'send_text',
      payload: { message },
    },
    {
      type: 'add_tag',
      payload: { tag },
      delay_seconds: 1,
    },
  ]
}

function intentTrigger(
  intentId: BusinessIntentId,
  id: string,
  name: string,
  description: string,
  message: string,
  tag: string,
): StarterTriggerTemplate {
  const intent = getBusinessIntentById(intentId)

  if (!intent) {
    throw new Error(`Unknown business intent: ${intentId}`)
  }

  const trigger = createTriggerTemplateFromIntent(intent, {
    id,
    name,
    description,
    actions: triggerActions(message, tag),
  })

  return {
    ...trigger,
    actions: trigger.actions,
  }
}

const SUBSCRIPTIONS_PACK: StarterTemplatePack = {
  flows: [
    menuFlow(
      'subscriptions_renewal_menu',
      'Suscripciones - Renovacion guiada',
      'Guia al cliente para renovar, ver planes o pedir soporte.',
      ['renovar', 'renovacion', 'vence', 'vencimiento', 'planes', 'pago'],
      'Hola {{contact_name}}. Te ayudo con tu suscripcion para que no pierdas acceso.',
      'Que necesitas hacer?',
      [
        { id: 'renew_now', title: 'Renovar ahora' },
        { id: 'see_plans', title: 'Ver planes' },
        { id: 'support', title: 'Soporte' },
      ],
      'decision_suscripcion',
      'El cliente necesita ayuda con una suscripcion. Guia la renovacion, explica planes, pide comprobante si corresponde y deriva a humano si hay un problema.',
    ),
  ],
  triggers: [
    intentTrigger(
      'payment_proof',
      'subscriptions_payment_proof',
      'Suscripciones - Comprobante recibido',
      'Detecta comprobantes o mensajes de pago y avisa que se revisara.',
      'Gracias {{contact.name}}. Recibimos tu mensaje de pago. Revisaremos el comprobante y te confirmaremos la renovacion en breve.',
      'pago-recibido',
    ),
  ],
}

const RESTAURANT_PACK: StarterTemplatePack = {
  flows: [
    menuFlow(
      'restaurant_order_menu',
      'Restaurante - Toma de pedido',
      'Muestra opciones para menu, delivery o reserva.',
      ['menu', 'pedido', 'delivery', 'hambre', 'comida', 'reservar'],
      'Hola {{contact_name}}. Bienvenido. Te ayudo con tu pedido.',
      'Que quieres hacer?',
      [
        { id: 'see_menu', title: 'Ver menu' },
        { id: 'delivery', title: 'Delivery' },
        { id: 'reserve', title: 'Reservar' },
      ],
      'decision_restaurante',
      'El cliente esta interactuando con un restaurante. Ayudalo a elegir productos, pedir direccion, confirmar metodo de pago y cerrar el pedido.',
    ),
  ],
  triggers: [
    intentTrigger(
      'catalog_request',
      'restaurant_menu_request',
      'Restaurante - Solicitud de menu',
      'Responde cuando el cliente pide menu o precios.',
      'Hola {{contact.name}}. Te paso nuestro menu. Dime que producto quieres y si sera para recoger o delivery.',
      'interes-menu',
    ),
  ],
}

const STORE_PACK: StarterTemplatePack = {
  flows: [
    menuFlow(
      'store_catalog_menu',
      'Tienda - Catalogo y compra',
      'Ayuda a ver catalogo, consultar stock y comprar.',
      ['catalogo', 'precio', 'comprar', 'producto', 'stock', 'envio'],
      'Hola {{contact_name}}. Te ayudo a encontrar el producto ideal.',
      'Que necesitas?',
      [
        { id: 'catalog', title: 'Ver catalogo' },
        { id: 'stock', title: 'Consultar stock' },
        { id: 'buy', title: 'Comprar' },
      ],
      'decision_tienda',
      'El cliente esta comprando en una tienda. Muestra productos, pregunta preferencias, confirma stock, metodo de pago y datos de entrega.',
    ),
  ],
  triggers: [
    intentTrigger(
      'price_inquiry',
      'store_price_inquiry',
      'Tienda - Consulta de precio',
      'Responde consultas de precios, catalogo y disponibilidad.',
      'Hola {{contact.name}}. Te ayudo con precios y disponibilidad. Dime que producto te interesa.',
      'consulta-producto',
    ),
  ],
}

const CLINIC_PACK: StarterTemplatePack = {
  flows: [
    menuFlow(
      'clinic_appointment_menu',
      'Clinica - Agenda de cita',
      'Recoge motivo, fecha preferida y deriva urgencias.',
      ['cita', 'consulta', 'doctor', 'agenda', 'turno', 'horario'],
      'Hola {{contact_name}}. Te ayudo a coordinar tu cita.',
      'Que necesitas?',
      [
        { id: 'book', title: 'Agendar cita' },
        { id: 'reschedule', title: 'Reprogramar' },
        { id: 'urgent', title: 'Urgencia' },
      ],
      'decision_clinica',
      'El cliente quiere una cita medica. Pide nombre, motivo, fecha y hora preferida. Si menciona urgencia, recomienda contacto humano inmediato.',
    ),
  ],
  triggers: [
    intentTrigger(
      'booking_intent',
      'clinic_appointment_request',
      'Clinica - Solicitud de cita',
      'Responde cuando un paciente pide agendar o reprogramar.',
      'Hola {{contact.name}}. Claro, te ayudo a coordinar una cita. Dime el motivo de consulta y tu horario preferido.',
      'cita-pendiente',
    ),
  ],
}

const GYM_PACK: StarterTemplatePack = {
  flows: [
    menuFlow(
      'gym_plans_menu',
      'Gimnasio - Planes y prueba gratis',
      'Presenta planes, horarios y registro para prueba.',
      ['gym', 'gimnasio', 'planes', 'precio', 'horario', 'prueba'],
      'Hola {{contact_name}}. Te ayudo con nuestros planes de entrenamiento.',
      'Que te interesa?',
      [
        { id: 'plans', title: 'Ver planes' },
        { id: 'trial', title: 'Prueba gratis' },
        { id: 'schedule', title: 'Horarios' },
      ],
      'decision_gimnasio',
      'El cliente busca informacion de gimnasio. Presenta planes, horarios, beneficios y guia al registro de una prueba gratis.',
    ),
  ],
  triggers: [
    intentTrigger(
      'price_inquiry',
      'gym_plan_inquiry',
      'Gimnasio - Consulta de planes',
      'Responde consultas sobre mensualidades, horarios y prueba gratis.',
      'Hola {{contact.name}}. Tenemos planes para distintos objetivos. Te puedo enviar precios, horarios o ayudarte a reservar una prueba gratis.',
      'interes-gimnasio',
    ),
  ],
}

const CUSTOM_PACK: StarterTemplatePack = {
  flows: [
    menuFlow(
      'custom_general_menu',
      'General - Menu inicial',
      'Menu base para orientar al cliente y activar la IA.',
      ['hola', 'menu', 'inicio', 'ayuda', 'informacion'],
      'Hola {{contact_name}}. Estoy aqui para ayudarte.',
      'Que te gustaria hacer?',
      [
        { id: 'info', title: 'Informacion' },
        { id: 'prices', title: 'Precios' },
        { id: 'support', title: 'Soporte' },
      ],
      'decision_general',
      'El cliente necesita orientacion general. Responde con claridad, pide datos faltantes y guia hacia el siguiente paso.',
    ),
  ],
  triggers: [
    intentTrigger(
      'human_request',
      'custom_human_escalation',
      'General - Escalar a humano',
      'Deriva a una persona cuando el cliente lo solicita.',
      'Entendido {{contact.name}}. Te conectaremos con una persona del equipo para ayudarte mejor.',
      'requiere-humano',
    ),
  ],
}

export const BUSINESS_STARTER_TEMPLATE_PACKS: Record<BusinessType, StarterTemplatePack> = {
  subscriptions: SUBSCRIPTIONS_PACK,
  restaurant: RESTAURANT_PACK,
  store: STORE_PACK,
  clinic: CLINIC_PACK,
  gym: GYM_PACK,
  education: {
    flows: [
      menuFlow(
        'education_course_menu',
        'Educacion - Cursos e inscripciones',
        'Responde sobre cursos, horarios e inscripcion.',
        ['curso', 'clase', 'inscripcion', 'precio', 'horario', 'academia'],
        'Hola {{contact_name}}. Te ayudo con informacion de cursos.',
        'Que necesitas?',
        [
          { id: 'courses', title: 'Ver cursos' },
          { id: 'prices', title: 'Precios' },
          { id: 'enroll', title: 'Inscribirme' },
        ],
        'decision_educacion',
        'El cliente busca cursos o clases. Presenta opciones, horarios, precios y guia a la inscripcion.',
      ),
    ],
    triggers: [
      intentTrigger('course_inquiry', 'education_course_inquiry', 'Educacion - Consulta de curso', 'Responde consultas de cursos e inscripciones.', 'Hola {{contact.name}}. Te ayudo con informacion de cursos, horarios e inscripcion. Que area te interesa?', 'interes-curso'),
    ],
  },
  real_estate: {
    flows: [
      menuFlow(
        'real_estate_lead_menu',
        'Inmobiliaria - Captura de lead',
        'Califica interesados en compra, alquiler o visita.',
        ['casa', 'departamento', 'alquiler', 'comprar', 'visita', 'propiedad'],
        'Hola {{contact_name}}. Te ayudo a encontrar una propiedad.',
        'Que estas buscando?',
        [
          { id: 'buy', title: 'Comprar' },
          { id: 'rent', title: 'Alquilar' },
          { id: 'visit', title: 'Agendar visita' },
        ],
        'decision_inmobiliaria',
        'El cliente busca propiedad. Pregunta zona, presupuesto, tipo de inmueble y agenda visita si corresponde.',
      ),
    ],
    triggers: [
      intentTrigger('property_inquiry', 'real_estate_property_inquiry', 'Inmobiliaria - Consulta de propiedad', 'Responde interesados en compra o alquiler.', 'Hola {{contact.name}}. Te ayudo a encontrar una propiedad. Buscas comprar, alquilar o agendar una visita?', 'lead-inmobiliario'),
    ],
  },
  technical_service: {
    flows: [
      menuFlow(
        'technical_service_ticket_menu',
        'Servicio tecnico - Diagnostico inicial',
        'Recoge problema, equipo y urgencia.',
        ['reparar', 'soporte', 'servicio tecnico', 'problema', 'falla', 'diagnostico'],
        'Hola {{contact_name}}. Te ayudo a registrar tu solicitud tecnica.',
        'Que necesitas?',
        [
          { id: 'repair', title: 'Reparacion' },
          { id: 'quote', title: 'Cotizacion' },
          { id: 'status', title: 'Estado' },
        ],
        'decision_servicio_tecnico',
        'El cliente necesita servicio tecnico. Pide tipo de equipo, problema, urgencia y datos para seguimiento.',
      ),
    ],
    triggers: [
      intentTrigger('technical_service_request', 'technical_service_support_request', 'Servicio tecnico - Solicitud de soporte', 'Clasifica solicitudes de reparacion o soporte.', 'Hola {{contact.name}}. Te ayudo con soporte tecnico. Dime que equipo tienes y que problema presenta.', 'soporte-tecnico'),
    ],
  },
  travel: {
    flows: [
      menuFlow(
        'travel_package_menu',
        'Viajes - Paquetes y reservas',
        'Califica destino, fechas y presupuesto.',
        ['viaje', 'paquete', 'hotel', 'vuelo', 'reserva', 'tour'],
        'Hola {{contact_name}}. Te ayudo a planear tu viaje.',
        'Que estas buscando?',
        [
          { id: 'packages', title: 'Paquetes' },
          { id: 'quote', title: 'Cotizar' },
          { id: 'reserve', title: 'Reservar' },
        ],
        'decision_viajes',
        'El cliente busca viajes. Pregunta destino, fechas, cantidad de personas y presupuesto para cotizar.',
      ),
    ],
    triggers: [
      intentTrigger('travel_quote', 'travel_package_inquiry', 'Viajes - Consulta de paquete', 'Responde consultas de paquetes, reservas y cotizaciones.', 'Hola {{contact.name}}. Te ayudo a cotizar tu viaje. Que destino y fechas tienes en mente?', 'interes-viaje'),
    ],
  },
  custom: CUSTOM_PACK,
}

const GOAL_STARTER_TEMPLATE_PACKS: Record<BusinessGoal, StarterTemplatePack> = {
  sell_more: {
    flows: [
      menuFlow(
        'goal_sell_more_offer_menu',
        'Objetivo - Ventas guiadas',
        'Convierte consultas en ventas con ayuda de IA.',
        ['precio', 'comprar', 'catalogo', 'cotizacion', 'plan', 'pedido'],
        'Hola {{contact_name}}. Te ayudo a encontrar la mejor opcion para ti.',
        'Que te interesa revisar?',
        [
          { id: 'price', title: 'Ver precios' },
          { id: 'options', title: 'Ver opciones' },
          { id: 'buy', title: 'Comprar ahora' },
        ],
        'decision_objetivo_venta',
        'El objetivo principal es vender. Responde con claridad, presenta opciones, beneficios, precio y guia al cierre.',
      ),
    ],
    triggers: [
      intentTrigger(
        'purchase_intent',
        'goal_sell_more_purchase_intent',
        'Objetivo - Intencion de compra',
        'Prioriza clientes listos para comprar o avanzar al pago.',
        'Perfecto {{contact.name}}. Te ayudo a avanzar con tu compra. Confirmame la opcion que deseas y tu metodo de pago.',
        'intencion-compra',
      ),
    ],
  },
  capture_leads: {
    flows: [
      menuFlow(
        'goal_capture_leads_lead_flow',
        'Objetivo - Captura de prospectos',
        'Recolecta interes y datos basicos para seguimiento comercial.',
        ['informacion', 'quiero saber', 'me interesa', 'consulta', 'asesoria'],
        'Hola {{contact_name}}. Gracias por escribirnos.',
        'Como prefieres continuar?',
        [
          { id: 'leave_data', title: 'Dejar mis datos' },
          { id: 'see_options', title: 'Ver opciones' },
          { id: 'speak', title: 'Hablar con asesor' },
        ],
        'decision_objetivo_lead',
        'El objetivo principal es captar leads. Pide nombre, contacto, interes y deja el siguiente paso claro para el equipo comercial.',
      ),
    ],
    triggers: [
      intentTrigger(
        'greeting_or_help',
        'goal_capture_leads_greeting',
        'Objetivo - Primer contacto de lead',
        'Convierte saludos e interes inicial en una oportunidad comercial.',
        'Hola {{contact.name}}. Gracias por escribirnos. Cuentame que estas buscando y te ayudamos a encontrar la mejor opcion.',
        'lead-nuevo',
      ),
    ],
  },
  book_appointments: {
    flows: [
      menuFlow(
        'goal_book_appointments_schedule_flow',
        'Objetivo - Agenda automatizada',
        'Orienta reservas, citas o visitas desde el primer mensaje.',
        ['agendar', 'reserva', 'cita', 'turno', 'visita', 'horario'],
        'Hola {{contact_name}}. Te ayudo a coordinar tu reserva.',
        'Que necesitas agendar?',
        [
          { id: 'appointment', title: 'Nueva reserva' },
          { id: 'reschedule', title: 'Reprogramar' },
          { id: 'availability', title: 'Ver horarios' },
        ],
        'decision_objetivo_agenda',
        'El objetivo principal es llenar agenda. Pide fecha, hora, motivo y confirma disponibilidad o siguiente paso.',
      ),
    ],
    triggers: [
      intentTrigger(
        'booking_intent',
        'goal_book_appointments_booking_intent',
        'Objetivo - Solicitud de agenda',
        'Responde solicitudes de cita, reserva o visita.',
        'Claro {{contact.name}}. Te ayudo a agendar. Indica el dia, horario preferido y el motivo de tu reserva.',
        'agenda-pendiente',
      ),
    ],
  },
  support_customers: {
    flows: [
      menuFlow(
        'goal_support_customers_support_flow',
        'Objetivo - Mesa de ayuda inicial',
        'Clasifica soporte, reclamos o escalaciones humanas.',
        ['soporte', 'ayuda', 'problema', 'error', 'reclamo', 'no funciona'],
        'Hola {{contact_name}}. Vamos a ayudarte con tu caso.',
        'Que tipo de ayuda necesitas?',
        [
          { id: 'technical', title: 'Problema tecnico' },
          { id: 'billing', title: 'Problema de pago' },
          { id: 'human', title: 'Hablar con alguien' },
        ],
        'decision_objetivo_soporte',
        'El objetivo principal es soporte. Clasifica el caso, responde con calma y deriva a humano si el cliente lo necesita.',
      ),
    ],
    triggers: [
      intentTrigger(
        'support_request',
        'goal_support_customers_support_request',
        'Objetivo - Caso de soporte',
        'Detecta problemas o reclamos para responder de inmediato.',
        'Lamento el inconveniente, {{contact.name}}. Cuentame que ocurrio y te ayudaremos a resolverlo.',
        'caso-soporte',
      ),
    ],
  },
  renew_clients: {
    flows: [
      menuFlow(
        'goal_renew_clients_renewal_flow',
        'Objetivo - Renovacion guiada',
        'Empuja renovaciones y continuidad del servicio.',
        ['renovar', 'vencimiento', 'vence', 'activar', 'mensualidad', 'plan'],
        'Hola {{contact_name}}. Te ayudo a mantener tu servicio activo.',
        'Que quieres hacer?',
        [
          { id: 'renew', title: 'Renovar ahora' },
          { id: 'plans', title: 'Ver planes' },
          { id: 'payment', title: 'Enviar pago' },
        ],
        'decision_objetivo_renovacion',
        'El objetivo principal es renovar clientes. Facilita el pago, muestra planes y reduce la friccion para mantener el servicio activo.',
      ),
    ],
    triggers: [
      intentTrigger(
        'renewal_intent',
        'goal_renew_clients_renewal_intent',
        'Objetivo - Interes de renovacion',
        'Prioriza clientes que quieren renovar o evitar vencimiento.',
        'Hola {{contact.name}}. Te ayudo a renovar para que mantengas tu servicio activo. Dime si deseas ver planes o enviar tu comprobante.',
        'renovacion-pendiente',
      ),
    ],
  },
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false
    }

    seen.add(item.id)
    return true
  })
}

function mergeStarterTemplatePacks(...packs: StarterTemplatePack[]): StarterTemplatePack {
  return {
    flows: dedupeById(packs.flatMap((pack) => pack.flows)),
    triggers: dedupeById(packs.flatMap((pack) => pack.triggers)),
  }
}

export function getStarterTemplatePack(
  type: BusinessType,
  goals?: BusinessGoal[],
): StarterTemplatePack {
  const normalizedGoals = normalizeBusinessGoalsForBusinessType(
    type,
    goals,
    getDefaultGoalsForBusinessType(type),
  )

  const goalPacks = normalizedGoals.map((goal) => GOAL_STARTER_TEMPLATE_PACKS[goal])
  return mergeStarterTemplatePacks(BUSINESS_STARTER_TEMPLATE_PACKS[type], ...goalPacks)
}
