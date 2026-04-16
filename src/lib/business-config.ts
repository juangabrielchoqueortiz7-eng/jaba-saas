export const BUSINESS_TYPES = [
  'subscriptions',
  'restaurant',
  'store',
  'clinic',
  'gym',
  'education',
  'real_estate',
  'technical_service',
  'travel',
  'custom',
] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]

export interface BusinessTypeOption {
  id: BusinessType
  title: string
  description: string
}

export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = [
  {
    id: 'subscriptions',
    title: 'Suscripciones',
    description: 'Renovaciones, vencimientos, pagos y recordatorios.',
  },
  {
    id: 'restaurant',
    title: 'Restaurante',
    description: 'Menu, pedidos, direccion, pagos y seguimiento.',
  },
  {
    id: 'store',
    title: 'Tienda',
    description: 'Catalogo, stock, pedidos, pagos y postventa.',
  },
  {
    id: 'clinic',
    title: 'Clinica o consultorio',
    description: 'Citas, pacientes, recordatorios y derivacion.',
  },
  {
    id: 'gym',
    title: 'Gimnasio',
    description: 'Planes, pagos, pruebas gratis y clientes inactivos.',
  },
  {
    id: 'education',
    title: 'Educacion',
    description: 'Cursos, consultas, inscripciones y recordatorios.',
  },
  {
    id: 'real_estate',
    title: 'Inmobiliaria',
    description: 'Propiedades, leads, visitas y seguimiento.',
  },
  {
    id: 'technical_service',
    title: 'Servicio tecnico',
    description: 'Ordenes, soporte, diagnosticos y pagos.',
  },
  {
    id: 'travel',
    title: 'Viajes',
    description: 'Paquetes, reservas, pagos y consultas frecuentes.',
  },
  {
    id: 'custom',
    title: 'Personalizado',
    description: 'Empieza con modulos base y configura tu flujo.',
  },
]

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && BUSINESS_TYPES.includes(value as BusinessType)
}

export const BUSINESS_MODULES = [
  'home',
  'chats',
  'assistants',
  'training',
  'flows',
  'triggers',
  'templates',
  'products',
  'orders',
  'payments',
  'subscriptions',
  'renewals',
  'appointments',
  'patients',
  'leads',
  'support',
  'notifications',
  'recharges',
  'achievements',
  'settings',
  'admin_accounts',
] as const

export type BusinessModule = (typeof BUSINESS_MODULES)[number]

export function isBusinessModule(value: unknown): value is BusinessModule {
  return typeof value === 'string' && BUSINESS_MODULES.includes(value as BusinessModule)
}

export const DEFAULT_NEW_BUSINESS_MODULES: BusinessModule[] = [
  'home',
  'chats',
  'assistants',
  'training',
  'flows',
  'triggers',
  'templates',
  'products',
  'orders',
  'payments',
  'settings',
]

export const SUBSCRIPTION_BUSINESS_MODULES: BusinessModule[] = [
  'home',
  'chats',
  'assistants',
  'training',
  'flows',
  'triggers',
  'templates',
  'products',
  'orders',
  'payments',
  'subscriptions',
  'renewals',
  'notifications',
  'recharges',
  'achievements',
  'settings',
  'admin_accounts',
]

export const BUSINESS_TYPE_MODULES: Record<BusinessType, BusinessModule[]> = {
  subscriptions: SUBSCRIPTION_BUSINESS_MODULES,
  restaurant: [
    ...DEFAULT_NEW_BUSINESS_MODULES,
    'notifications',
  ],
  store: [
    ...DEFAULT_NEW_BUSINESS_MODULES,
    'notifications',
  ],
  clinic: [
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'appointments',
    'patients',
    'notifications',
    'payments',
    'settings',
  ],
  gym: [
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'payments',
    'subscriptions',
    'renewals',
    'notifications',
    'settings',
  ],
  education: [
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'payments',
    'appointments',
    'notifications',
    'settings',
  ],
  real_estate: [
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'appointments',
    'leads',
    'notifications',
    'settings',
  ],
  technical_service: [
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'orders',
    'support',
    'payments',
    'notifications',
    'settings',
  ],
  travel: [
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'orders',
    'payments',
    'appointments',
    'notifications',
    'settings',
  ],
  custom: DEFAULT_NEW_BUSINESS_MODULES,
}

export function getModulesForBusinessType(type: BusinessType): BusinessModule[] {
  return BUSINESS_TYPE_MODULES[type]
}

export function normalizeBusinessModules(
  value: unknown,
  fallback: BusinessModule[] = DEFAULT_NEW_BUSINESS_MODULES,
): BusinessModule[] {
  const source = Array.isArray(value) ? value : fallback
  const modules = Array.from(new Set(source.filter(isBusinessModule)))

  if (!modules.includes('settings')) {
    modules.push('settings')
  }

  return modules.length > 0 ? modules : [...fallback]
}
