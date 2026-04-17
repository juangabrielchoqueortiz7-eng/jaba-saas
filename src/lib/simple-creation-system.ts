import { BUSINESS_TYPE_OPTIONS, type BusinessType } from './business-config'
import {
  getBusinessGoalTitles,
  type BusinessGoal,
} from './business-goals'

export type SimpleCreationArea = 'flows' | 'triggers' | 'templates'
export type SimpleCreationSurface = 'assistant' | SimpleCreationArea
export type CreationDifficulty = 'Listo para usar' | 'Guiado' | 'Potente'

export interface SimpleCreationRecipe {
  id: string
  area: SimpleCreationArea
  title: string
  summary: string
  outcome: string
  launchLabel: string
  difficulty: CreationDifficulty
  needs: string[]
  checks: string[]
  businessTypes?: BusinessType[]
  businessGoals?: BusinessGoal[]
}

export interface SimpleCreationResourceCard {
  title: string
  description: string
  items: string[]
}

const SIMPLE_CREATION_RECIPES: SimpleCreationRecipe[] = [
  {
    id: 'flow_welcome_menu',
    area: 'flows',
    title: 'Bienvenida con menu',
    summary: 'Arranca la conversacion con opciones claras para que el cliente no se pierda.',
    outcome: 'El cliente entiende rapido que puede pedir y el bot guia el siguiente paso.',
    launchLabel: 'Crear conversacion',
    difficulty: 'Listo para usar',
    needs: ['Mensaje inicial', '3 opciones principales', 'Siguiente paso esperado'],
    checks: ['El saludo cabe en un mensaje', 'Cada boton tiene un destino claro'],
    businessGoals: ['sell_more', 'support_customers', 'capture_leads'],
  },
  {
    id: 'flow_sales_assistant',
    area: 'flows',
    title: 'Guiar una venta',
    summary: 'Presenta productos o servicios y deja una ruta corta para avanzar a compra.',
    outcome: 'Reduce preguntas repetidas y acerca la conversacion al cierre.',
    launchLabel: 'Crear conversacion',
    difficulty: 'Guiado',
    needs: ['Oferta principal', 'Pregunta de calificacion', 'CTA final'],
    checks: ['El flujo pide solo un dato por paso', 'La salida final invita a comprar'],
    businessGoals: ['sell_more'],
  },
  {
    id: 'flow_lead_capture',
    area: 'flows',
    title: 'Capturar datos del lead',
    summary: 'Pide nombre, correo o interes sin que parezca un formulario tecnico.',
    outcome: 'Recolecta datos ordenados para seguimiento posterior.',
    launchLabel: 'Crear conversacion',
    difficulty: 'Guiado',
    needs: ['Dato que realmente importa', 'Mensaje de confirmacion'],
    checks: ['No pide demasiados datos al inicio', 'Cada respuesta se guarda con nombre claro'],
    businessGoals: ['capture_leads', 'book_appointments'],
  },
  {
    id: 'trigger_inactivity_followup',
    area: 'triggers',
    title: 'Seguimiento si no responde',
    summary: 'Vuelve a escribir cuando la conversacion queda fria sin tocar reglas complejas.',
    outcome: 'Recupera ventas, leads o renovaciones sin persecucion manual.',
    launchLabel: 'Crear automatizacion',
    difficulty: 'Listo para usar',
    needs: ['Tiempo de espera', 'Mensaje corto', 'Condicion para detenerse'],
    checks: ['El mensaje no suena repetitivo', 'La secuencia se corta si el cliente responde'],
    businessGoals: ['sell_more', 'renew_clients', 'capture_leads'],
  },
  {
    id: 'trigger_keyword_reply',
    area: 'triggers',
    title: 'Respuesta por palabra clave',
    summary: 'Detecta intenciones como precio, ayuda o soporte sin meter regex ni payloads.',
    outcome: 'Responde rapido y ordena mejor el chat desde la primera pregunta.',
    launchLabel: 'Crear automatizacion',
    difficulty: 'Guiado',
    needs: ['Palabras reales del cliente', 'Respuesta base', 'Accion posterior opcional'],
    checks: ['Las palabras cubren variantes comunes', 'La respuesta abre el siguiente paso'],
    businessGoals: ['sell_more', 'support_customers'],
  },
  {
    id: 'trigger_renewal_push',
    area: 'triggers',
    title: 'Empujar renovaciones',
    summary: 'Recuerda vencimientos y pagos pendientes con tiempos y cortes mas seguros.',
    outcome: 'Sostiene continuidad del cliente sin que el equipo persiga uno por uno.',
    launchLabel: 'Crear automatizacion',
    difficulty: 'Potente',
    needs: ['Momento del recordatorio', 'Plantilla o mensaje', 'Regla de cancelacion'],
    checks: ['Usa plantilla si ya no estas dentro de 24 horas', 'El cliente no recibe mensajes duplicados'],
    businessGoals: ['renew_clients'],
    businessTypes: ['subscriptions', 'gym', 'education', 'custom'],
  },
  {
    id: 'template_welcome',
    area: 'templates',
    title: 'Plantilla de bienvenida',
    summary: 'Crea un mensaje aprobable para activacion, acceso o primer contacto.',
    outcome: 'Deja lista una plantilla utilizable en automatizaciones y envios manuales.',
    launchLabel: 'Crear plantilla',
    difficulty: 'Guiado',
    needs: ['Proposito claro', 'Variables con ejemplo', 'Texto directo'],
    checks: ['El mensaje no vende de mas', 'Cada variable tiene ejemplo real'],
  },
  {
    id: 'template_renewal',
    area: 'templates',
    title: 'Plantilla de renovacion',
    summary: 'Prepara un recordatorio aprobado para vencimientos, pagos o continuidad.',
    outcome: 'Te deja lista una pieza compatible con recordatorios automaticos.',
    launchLabel: 'Crear plantilla',
    difficulty: 'Listo para usar',
    needs: ['Servicio', 'Fecha o dias restantes', 'Llamado a responder'],
    checks: ['El texto se entiende sin contexto extra', 'La variable de vencimiento tiene ejemplo'],
    businessGoals: ['renew_clients'],
  },
  {
    id: 'template_followup',
    area: 'templates',
    title: 'Plantilla de seguimiento',
    summary: 'Sirve para retomar una conversacion fria con un texto simple y aprobable.',
    outcome: 'Apoya automatizaciones de seguimiento sin empezar de cero.',
    launchLabel: 'Crear plantilla',
    difficulty: 'Guiado',
    needs: ['Contexto corto', 'Nombre del servicio', 'CTA breve'],
    checks: ['No depende de mucho texto', 'Puede reutilizarse en varias conversaciones'],
    businessGoals: ['sell_more', 'capture_leads', 'support_customers'],
  },
]

const RESOURCE_CARDS: Record<SimpleCreationSurface, SimpleCreationResourceCard[]> = {
  assistant: [
    {
      title: 'Entrada simple',
      description: 'Empieza por objetivo y no por nodos, condiciones o payloads.',
      items: [
        'Conversaciones guiadas por receta',
        'Automatizaciones con packs y simulacion',
        'Plantillas con ejemplos y variables visibles',
      ],
    },
    {
      title: 'Recursos que necesitas',
      description: 'Lo minimo para que el resultado sea funcional desde la primera version.',
      items: [
        'Un objetivo claro',
        'Un mensaje principal',
        'Las variables que realmente vas a usar',
      ],
    },
    {
      title: 'Guardrails',
      description: 'Antes de activar, el sistema debe ayudarte a validar lo mas delicado.',
      items: [
        'Preview del primer mensaje',
        'Chequeo de variables faltantes',
        'Regla de corte para seguimientos',
      ],
    },
  ],
  flows: [
    {
      title: 'Bloques simples',
      description: 'Las conversaciones deben construirse con pasos que cualquier persona entienda.',
      items: [
        'Inicio',
        'Mensaje',
        'Opciones',
        'Pregunta',
        'Accion final',
      ],
    },
    {
      title: 'Variables utiles',
      description: 'Muestra solo las variables que sirven para conversar mejor.',
      items: [
        'Nombre del contacto',
        'Telefono',
        'Servicio o plan',
        'Respuesta capturada del cliente',
      ],
    },
    {
      title: 'Checklist antes de publicar',
      description: 'Evita flujos que se sientan tecnicos o se queden sin salida.',
      items: [
        'Cada boton tiene continuidad',
        'No pides dos cosas a la vez',
        'El cliente sabe que hacer despues',
      ],
    },
  ],
  triggers: [
    {
      title: 'Automatizacion simple',
      description: 'Piensa en evento, accion y regla de corte. Nada mas al inicio.',
      items: [
        'Que la activa',
        'Que mensaje o accion sale',
        'Cuando se detiene sola',
      ],
    },
    {
      title: 'Recursos necesarios',
      description: 'Ten listo lo basico antes de activar seguimientos o recordatorios.',
      items: [
        'Plantilla aprobada si aplica',
        'Tiempo de espera',
        'Mensaje de seguimiento',
        'Escenario de cancelacion',
      ],
    },
    {
      title: 'Chequeos funcionales',
      description: 'Los seguimientos deben ayudar, no duplicar mensajes ni insistir de mas.',
      items: [
        'Simular sin respuesta',
        'Simular respuesta despues del primer mensaje',
        'Simular conversion antes del segundo mensaje',
      ],
    },
  ],
  templates: [
    {
      title: 'Plantillas menos tecnicas',
      description: 'El creador debe hablar de proposito, ejemplos y tono, no de formato interno.',
      items: [
        'Renovacion',
        'Bienvenida',
        'Seguimiento',
        'Personalizada',
      ],
    },
    {
      title: 'Datos que no pueden faltar',
      description: 'Una plantilla funcional se arma con contexto minimo pero preciso.',
      items: [
        'Objetivo del mensaje',
        'Variables con ejemplo real',
        'Header si hace falta',
        'Llamado a responder',
      ],
    },
    {
      title: 'Validaciones previas',
      description: 'Esto ayuda a evitar rechazos y mensajes imposibles de reutilizar.',
      items: [
        'Nombre valido',
        'Ejemplos completos',
        'Media cargada cuando corresponde',
        'Texto entendible sin explicacion extra',
      ],
    },
  ],
}

const ACTIVATION_CHECKLIST: Record<SimpleCreationSurface, string[]> = {
  assistant: [
    'La persona puede empezar desde una receta y no desde cero',
    'El modo avanzado sigue disponible pero no es la primera opcion',
    'Cada creador tiene preview o simulacion antes de activar',
  ],
  flows: [
    'El primer mensaje se entiende por si solo',
    'Cada opcion lleva a una respuesta o siguiente paso',
    'Las variables usadas aparecen en lenguaje humano',
  ],
  triggers: [
    'La automatizacion tiene una razon clara para activarse',
    'Existe una condicion de corte para no insistir de mas',
    'Se probo al menos un escenario feliz y uno de cancelacion',
  ],
  templates: [
    'Cada variable tiene ejemplo real',
    'El mensaje cumple un solo objetivo principal',
    'La plantilla esta lista para usarse en una automatizacion',
  ],
}

function matchesBusinessType(recipe: SimpleCreationRecipe, businessType?: BusinessType | null) {
  if (!recipe.businessTypes || recipe.businessTypes.length === 0) return true
  if (!businessType) return true
  return recipe.businessTypes.includes(businessType)
}

function matchesGoals(recipe: SimpleCreationRecipe, goals: BusinessGoal[]) {
  if (!recipe.businessGoals || recipe.businessGoals.length === 0) return 1
  if (goals.length === 0) return 0
  return recipe.businessGoals.reduce((total, goal) => total + (goals.includes(goal) ? 2 : 0), 0)
}

export function getSimpleCreationRecipes(options: {
  surface: SimpleCreationSurface
  businessType?: BusinessType | null
  goals?: BusinessGoal[]
  limit?: number
}) {
  const goals = options.goals ?? []
  const filteredByArea = options.surface === 'assistant'
    ? SIMPLE_CREATION_RECIPES
    : SIMPLE_CREATION_RECIPES.filter((recipe) => recipe.area === options.surface)

  const ranked = filteredByArea
    .filter((recipe) => matchesBusinessType(recipe, options.businessType))
    .map((recipe) => ({
      recipe,
      score: matchesGoals(recipe, goals) + (recipe.area === options.surface ? 1 : 0),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.recipe.title.localeCompare(right.recipe.title)
    })
    .map((entry) => entry.recipe)

  return ranked.slice(0, options.limit ?? (options.surface === 'assistant' ? 6 : 4))
}

export function getSimpleCreationResourceCards(surface: SimpleCreationSurface) {
  return RESOURCE_CARDS[surface]
}

export function getSimpleCreationChecklist(surface: SimpleCreationSurface) {
  return ACTIVATION_CHECKLIST[surface]
}

export function getBusinessTypeTitle(value?: BusinessType | null) {
  if (!value) return 'Cuenta general'
  return BUSINESS_TYPE_OPTIONS.find((option) => option.id === value)?.title ?? 'Cuenta general'
}

export function getGoalSummary(goals: BusinessGoal[]) {
  if (goals.length === 0) return 'Sin foco definido todavia'

  const titles = getBusinessGoalTitles(goals)
  if (titles.length <= 2) return titles.join(' + ')
  return `${titles[0]} + ${titles[1]} + ${titles.length - 2} mas`
}
