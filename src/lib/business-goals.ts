import type { BusinessType } from './business-config'

export const BUSINESS_GOALS = [
  'sell_more',
  'capture_leads',
  'book_appointments',
  'support_customers',
  'renew_clients',
] as const

export type BusinessGoal = (typeof BUSINESS_GOALS)[number]

export interface BusinessGoalOption {
  id: BusinessGoal
  title: string
  description: string
  businessTypes?: BusinessType[]
}

export const BUSINESS_GOAL_OPTIONS: BusinessGoalOption[] = [
  {
    id: 'sell_more',
    title: 'Vender mas',
    description: 'Prioriza consultas de precio, catalogo, pedidos y cierres de venta.',
  },
  {
    id: 'capture_leads',
    title: 'Captar leads',
    description: 'Recolecta datos de interesados y abre oportunidades comerciales.',
  },
  {
    id: 'book_appointments',
    title: 'Agendar reservas o citas',
    description: 'Da prioridad a reservas, visitas, mesas, demos y agenda.',
    businessTypes: ['restaurant', 'clinic', 'gym', 'education', 'real_estate', 'travel', 'custom'],
  },
  {
    id: 'support_customers',
    title: 'Dar soporte',
    description: 'Escala casos humanos, soporte tecnico y seguimiento postventa.',
  },
  {
    id: 'renew_clients',
    title: 'Renovar clientes',
    description: 'Empuja renovaciones, vencimientos, pagos pendientes y continuidad.',
    businessTypes: ['subscriptions', 'gym', 'education', 'custom'],
  },
]

export const DEFAULT_BUSINESS_GOALS: Record<BusinessType, BusinessGoal[]> = {
  subscriptions: ['sell_more', 'renew_clients', 'support_customers'],
  restaurant: ['sell_more', 'book_appointments'],
  store: ['sell_more', 'support_customers'],
  clinic: ['book_appointments', 'support_customers'],
  gym: ['sell_more', 'renew_clients', 'book_appointments'],
  education: ['capture_leads', 'book_appointments', 'renew_clients'],
  real_estate: ['capture_leads', 'book_appointments', 'sell_more'],
  technical_service: ['support_customers', 'sell_more'],
  travel: ['sell_more', 'capture_leads', 'book_appointments'],
  custom: ['sell_more', 'support_customers'],
}

export function isBusinessGoal(value: unknown): value is BusinessGoal {
  return typeof value === 'string' && BUSINESS_GOALS.includes(value as BusinessGoal)
}

export function getBusinessGoalOptionsForBusinessType(type: BusinessType): BusinessGoalOption[] {
  return BUSINESS_GOAL_OPTIONS.filter((goal) => !goal.businessTypes || goal.businessTypes.includes(type))
}

export function getBusinessGoalOption(goal: BusinessGoal): BusinessGoalOption {
  return BUSINESS_GOAL_OPTIONS.find((item) => item.id === goal) ?? {
    id: goal,
    title: goal,
    description: '',
  }
}

export function getDefaultGoalsForBusinessType(type: BusinessType): BusinessGoal[] {
  return DEFAULT_BUSINESS_GOALS[type]
}

export function normalizeBusinessGoals(
  value: unknown,
  fallback: BusinessGoal[] = [],
): BusinessGoal[] {
  const source = Array.isArray(value) ? value : fallback
  const goals = Array.from(new Set(source.filter(isBusinessGoal)))
  return goals.length > 0 ? goals : [...fallback]
}

export function normalizeBusinessGoalsForBusinessType(
  type: BusinessType,
  value: unknown,
  fallback: BusinessGoal[] = getDefaultGoalsForBusinessType(type),
): BusinessGoal[] {
  const allowedGoals = new Set(getBusinessGoalOptionsForBusinessType(type).map((goal) => goal.id))
  const normalizedGoals = normalizeBusinessGoals(value, fallback).filter((goal) => allowedGoals.has(goal))

  if (normalizedGoals.length > 0) {
    return normalizedGoals
  }

  return normalizeBusinessGoals(fallback, getDefaultGoalsForBusinessType(type)).filter((goal) => allowedGoals.has(goal))
}

export function getBusinessGoalTitles(goals: BusinessGoal[]): string[] {
  return goals.map((goal) => getBusinessGoalOption(goal).title)
}

export function getBusinessFocusSummary(goals: BusinessGoal[]): string {
  const titles = getBusinessGoalTitles(goals)

  if (titles.length === 0) {
    return 'Sin objetivos definidos'
  }

  if (titles.length <= 2) {
    return titles.join(' + ')
  }

  return `${titles[0]} + ${titles[1]} + ${titles.length - 2} mas`
}

export function getBusinessFocusDescription(goals: BusinessGoal[]): string {
  const titles = getBusinessGoalTitles(goals)

  if (titles.length === 0) {
    return 'Aun no hay objetivos configurados para esta cuenta.'
  }

  if (titles.length === 1) {
    return `Tu cuenta esta optimizada para ${titles[0].toLowerCase()}.`
  }

  if (titles.length === 2) {
    return `Tu cuenta esta optimizada para ${titles[0].toLowerCase()} y ${titles[1].toLowerCase()}.`
  }

  return `Tu cuenta esta optimizada para ${titles[0].toLowerCase()}, ${titles[1].toLowerCase()} y ${titles.length - 2} objetivo(s) mas.`
}
