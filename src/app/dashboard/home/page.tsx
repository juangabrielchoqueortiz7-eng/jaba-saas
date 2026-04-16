import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Bell,
    Bot,
    BookOpen,
    Calendar,
    CheckCircle2,
    FileText,
    MessageSquare,
    Send,
    ShoppingBag,
    Sparkles,
    TrendingUp,
    Users,
    Workflow,
    Zap,
} from 'lucide-react'
import {
    getModulesForBusinessType,
    isBusinessType,
    normalizeBusinessModules,
    type BusinessModule,
    type BusinessType,
} from '@/lib/business-config'
import {
    getBusinessFocusDescription,
    getBusinessFocusSummary,
    getBusinessGoalOption,
    getBusinessGoalTitles,
    normalizeBusinessGoalsForBusinessType,
    type BusinessGoal,
} from '@/lib/business-goals'
import { isNearLimit, isOverLimit } from '@/lib/plans'

type Assistant = {
    id: string
    bot_name: string | null
    training_prompt: string | null
}

type SubscriptionRow = {
    id: string
    correo: string | null
    numero: string | null
    vencimiento: string
    estado: string | null
    servicio: string | null
}

type RecentMessage = {
    last_message: string | null
    last_message_time: string | null
    contact_name: string | null
    phone_number: string | null
}

type NotificationRow = {
    message_type: string
    status: string
    created_at: string
    phone_number: string | null
}

type OrderRow = {
    id: string
    contact_name: string | null
    phone_number: string | null
    plan_name: string | null
    amount: number | null
    status: string | null
    created_at: string
}

type ChatSignalRow = {
    status: string | null
    tags: string[] | null
    last_message_time: string | null
}

type GoalOrderSignalRow = {
    status: string | null
    product: string | null
    created_at: string
}

type RenewalMetricRow = {
    status: string | null
    created_at: string
}

type BusinessCopy = {
    badge: string
    ready: string
    pending: string
    contactsLabel: string
    productsLabel: string
    ordersLabel: string
    summaryTitle: string
    summaryDescription: string
}

type StepDefinition = {
    done: boolean
    title: string
    description: string
    href: string
    cta: string
    icon: typeof Bot
}

type KpiCard = {
    icon: typeof MessageSquare
    label: string
    value: string | number
    sub: string
    color: string
}

type QuickLinkItem = {
    icon: typeof MessageSquare
    label: string
    href: string
}

type BusinessProfileRecord = {
    goals?: unknown
}

type NextAction = {
    color: string
    bg: string
    border: string
    title: string
    desc: string
    href: string | null
    cta: string | null
}

type GoalPerformanceCard = {
    goal: BusinessGoal
    title: string
    icon: typeof MessageSquare
    value: number
    label: string
    sub: string
    href: string
    color: string
    bg: string
}

const GREEN = '#25D366'

const BUSINESS_COPY: Record<BusinessType, BusinessCopy> = {
    subscriptions: {
        badge: 'Suscripciones',
        ready: 'Tu operacion de renovaciones esta lista y automatizada.',
        pending: 'Completa la configuracion para automatizar renovaciones, pagos y seguimiento.',
        contactsLabel: 'Suscriptores',
        productsLabel: 'Planes',
        ordersLabel: 'Cobros',
        summaryTitle: 'Panorama de renovaciones',
        summaryDescription: 'Vigila vencimientos y clientes activos por servicio.',
    },
    restaurant: {
        badge: 'Restaurante',
        ready: 'Tu centro de pedidos y atencion por WhatsApp esta listo.',
        pending: 'Completa la configuracion para tomar pedidos, delivery y reservas desde WhatsApp.',
        contactsLabel: 'Clientes',
        productsLabel: 'Menu',
        ordersLabel: 'Pedidos',
        summaryTitle: 'Operacion de pedidos',
        summaryDescription: 'Revisa pedidos recientes, productos y conversaciones activas.',
    },
    store: {
        badge: 'Tienda',
        ready: 'Tu vitrina, ventas y seguimiento por WhatsApp estan listos.',
        pending: 'Completa la configuracion para vender productos, responder consultas y cerrar pedidos.',
        contactsLabel: 'Clientes',
        productsLabel: 'Catalogo',
        ordersLabel: 'Pedidos',
        summaryTitle: 'Resumen comercial',
        summaryDescription: 'Controla pedidos, catalogo y automatizaciones de venta.',
    },
    clinic: {
        badge: 'Clinica',
        ready: 'Tu canal de atencion y coordinacion con pacientes esta listo.',
        pending: 'Completa la configuracion para coordinar citas, resolver consultas y derivar urgencias.',
        contactsLabel: 'Pacientes',
        productsLabel: 'Servicios',
        ordersLabel: 'Solicitudes',
        summaryTitle: 'Seguimiento de atencion',
        summaryDescription: 'Monitorea conversaciones, servicios y automatizaciones activas.',
    },
    gym: {
        badge: 'Gimnasio',
        ready: 'Tu gestion de planes, renovaciones y mensajes ya esta en marcha.',
        pending: 'Completa la configuracion para captar interesados, vender planes y automatizar renovaciones.',
        contactsLabel: 'Miembros',
        productsLabel: 'Planes',
        ordersLabel: 'Registros',
        summaryTitle: 'Actividad del gimnasio',
        summaryDescription: 'Combina conversaciones, planes activos y renovaciones cercanas.',
    },
    education: {
        badge: 'Educacion',
        ready: 'Tu atencion para cursos, inscripciones y consultas esta lista.',
        pending: 'Completa la configuracion para atender interesados, cursos e inscripciones por WhatsApp.',
        contactsLabel: 'Interesados',
        productsLabel: 'Cursos',
        ordersLabel: 'Inscripciones',
        summaryTitle: 'Seguimiento academico',
        summaryDescription: 'Observa interes de alumnos, cursos disponibles y automatizaciones.',
    },
    real_estate: {
        badge: 'Inmobiliaria',
        ready: 'Tu embudo de leads y seguimiento comercial esta listo.',
        pending: 'Completa la configuracion para captar leads, responder propiedades y agendar visitas.',
        contactsLabel: 'Leads',
        productsLabel: 'Propiedades',
        ordersLabel: 'Visitas',
        summaryTitle: 'Embudo inmobiliario',
        summaryDescription: 'Revisa leads, catalogo de propiedades y conversaciones recientes.',
    },
    technical_service: {
        badge: 'Servicio tecnico',
        ready: 'Tu centro de soporte y seguimiento de casos esta listo.',
        pending: 'Completa la configuracion para recibir fallas, cotizaciones y seguimiento tecnico.',
        contactsLabel: 'Clientes',
        productsLabel: 'Servicios',
        ordersLabel: 'Casos',
        summaryTitle: 'Operacion tecnica',
        summaryDescription: 'Revisa casos recientes, servicios y automatizaciones activas.',
    },
    travel: {
        badge: 'Viajes',
        ready: 'Tu canal para cotizar, reservar y responder viajeros esta listo.',
        pending: 'Completa la configuracion para vender paquetes, responder fechas y tomar reservas.',
        contactsLabel: 'Viajeros',
        productsLabel: 'Paquetes',
        ordersLabel: 'Reservas',
        summaryTitle: 'Operacion de reservas',
        summaryDescription: 'Controla paquetes, reservas y conversaciones activas.',
    },
    custom: {
        badge: 'Personalizado',
        ready: 'Tu operacion en WhatsApp ya esta lista para empezar.',
        pending: 'Completa la configuracion para adaptar el sistema a tu negocio y automatizar mensajes.',
        contactsLabel: 'Contactos',
        productsLabel: 'Ofertas',
        ordersLabel: 'Operaciones',
        summaryTitle: 'Resumen del negocio',
        summaryDescription: 'Monitorea conversaciones, recursos configurados y automatizaciones activas.',
    },
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const ddmm = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmm) {
        return new Date(parseInt(ddmm[3]!, 10), parseInt(ddmm[2]!, 10) - 1, parseInt(ddmm[1]!, 10))
    }
    const date = new Date(dateStr)
    return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(dateStr: string): string {
    const date = parseDate(dateStr)
    if (!date) return dateStr
    return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })
}

function diffDays(dateStr: string): number {
    const date = parseDate(dateStr)
    if (!date) return 999
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function hasModule(enabledModules: BusinessModule[], module: BusinessModule) {
    return enabledModules.includes(module)
}

function isRecentIso(dateStr: string | null | undefined, sinceIso: string) {
    if (!dateStr) return false
    const value = new Date(dateStr).getTime()
    const limit = new Date(sinceIso).getTime()
    if (Number.isNaN(value) || Number.isNaN(limit)) return false
    return value >= limit
}

function normalizeTags(tags: string[] | null | undefined) {
    return (tags ?? []).map((tag) => tag.toLowerCase())
}

function buildGoalPerformanceCards(params: {
    goals: BusinessGoal[]
    chatSignals: ChatSignalRow[]
    orderSignals: GoalOrderSignalRow[]
    renewalSignals: RenewalMetricRow[]
    dueSoonCount: number
    dueTodayCount: number
    last7dIso: string
}): GoalPerformanceCard[] {
    const {
        goals,
        chatSignals,
        orderSignals,
        renewalSignals,
        dueSoonCount,
        dueTodayCount,
        last7dIso,
    } = params

    const leadTags = new Set(['lead-nuevo', 'cliente_potencial', 'lead-inmobiliario', 'interes-curso', 'interes-viaje'])
    const bookingTags = new Set(['reserva-pendiente'])
    const supportTags = new Set(['requiere-soporte', 'soporte-tecnico', 'requiere-humano', 'urgente'])

    return goals.map((goal) => {
        const option = getBusinessGoalOption(goal)

        if (goal === 'sell_more') {
            const salesOrders = orderSignals.filter((order) => order.product !== 'renewal')
            const closedSales = salesOrders.filter((order) => ['completed', 'delivered'].includes(order.status ?? '')).length
            const pendingSales = salesOrders.filter((order) => ['pending_email', 'pending_payment', 'pending_delivery', 'pending_review'].includes(order.status ?? '')).length

            return {
                goal,
                title: option.title,
                icon: ShoppingBag,
                value: salesOrders.length,
                label: 'operaciones en 30 dias',
                sub: `${closedSales} cerradas • ${pendingSales} pendientes`,
                href: '/dashboard/orders',
                color: GREEN,
                bg: 'rgba(37,211,102,0.06)',
            }
        }

        if (goal === 'capture_leads') {
            const leadChats = chatSignals.filter((chat) => {
                const tags = normalizeTags(chat.tags)
                return chat.status === 'lead' || tags.some((tag) => leadTags.has(tag))
            })
            const activeLeadChats = leadChats.filter((chat) => isRecentIso(chat.last_message_time, last7dIso)).length

            return {
                goal,
                title: option.title,
                icon: Users,
                value: leadChats.length,
                label: 'leads detectados',
                sub: `${activeLeadChats} con actividad en 7 dias`,
                href: '/dashboard/chats',
                color: '#7c3aed',
                bg: 'rgba(124,58,237,0.06)',
            }
        }

        if (goal === 'book_appointments') {
            const bookingChats = chatSignals.filter((chat) => {
                const tags = normalizeTags(chat.tags)
                return tags.some((tag) => bookingTags.has(tag))
            })
            const recentBookings = bookingChats.filter((chat) => isRecentIso(chat.last_message_time, last7dIso)).length

            return {
                goal,
                title: option.title,
                icon: Calendar,
                value: bookingChats.length,
                label: 'reservas o citas detectadas',
                sub: `${recentBookings} con movimiento reciente`,
                href: '/dashboard/chats',
                color: '#2563eb',
                bg: 'rgba(37,99,235,0.06)',
            }
        }

        if (goal === 'support_customers') {
            const supportChats = chatSignals.filter((chat) => {
                const tags = normalizeTags(chat.tags)
                return chat.status === 'pending' || tags.some((tag) => supportTags.has(tag))
            })
            const urgentChats = supportChats.filter((chat) => normalizeTags(chat.tags).includes('urgente')).length
            const activeSupport = supportChats.filter((chat) => isRecentIso(chat.last_message_time, last7dIso)).length

            return {
                goal,
                title: option.title,
                icon: Activity,
                value: supportChats.length,
                label: 'casos abiertos o detectados',
                sub: `${urgentChats} urgentes • ${activeSupport} activos en 7 dias`,
                href: '/dashboard/chats',
                color: '#f97316',
                bg: 'rgba(249,115,22,0.06)',
            }
        }

        const approvedRenewals = renewalSignals.filter((renewal) => ['approved', 'auto_approved'].includes(renewal.status ?? '')).length
        const pendingRenewals = renewalSignals.filter((renewal) => renewal.status === 'pending_review').length

        return {
            goal,
            title: option.title,
            icon: Bell,
            value: approvedRenewals,
            label: 'renovaciones cerradas en 30 dias',
            sub: `${pendingRenewals} en revision • ${dueSoonCount} por vencer (${dueTodayCount} hoy)`,
            href: '/dashboard/renewals',
            color: '#dc2626',
            bg: 'rgba(220,38,38,0.06)',
        }
    })
}

function buildSteps(params: {
    businessType: BusinessType
    enabledModules: BusinessModule[]
    hasAssistant: boolean
    hasTraining: boolean
    hasProducts: boolean
    hasFlows: boolean
    hasChats: boolean
    hasOrders: boolean
    hasSubscriptions: boolean
    assistantId?: string
}): StepDefinition[] {
    const {
        businessType,
        enabledModules,
        hasAssistant,
        hasTraining,
        hasProducts,
        hasFlows,
        hasChats,
        hasOrders,
        hasSubscriptions,
        assistantId,
    } = params

    const catalogTitle = hasModule(enabledModules, 'products')
        ? `Agrega tu ${BUSINESS_COPY[businessType].productsLabel.toLowerCase()}`
        : 'Define tu oferta principal'

    const catalogHref = hasModule(enabledModules, 'products') ? '/dashboard/products' : '/dashboard/settings'

    let contactsTitle = `Carga tus ${BUSINESS_COPY[businessType].contactsLabel.toLowerCase()}`
    let contactsDescription = 'Registra tu base actual o espera nuevas conversaciones.'
    let contactsHref = '/dashboard/chats'
    let contactsDone = hasChats

    if (hasModule(enabledModules, 'subscriptions')) {
        contactsTitle = 'Registra tus suscripciones'
        contactsDescription = 'Carga clientes, servicios y vencimientos para empezar a automatizar.'
        contactsHref = '/dashboard/subscriptions'
        contactsDone = hasSubscriptions || hasChats
    } else if (hasModule(enabledModules, 'orders')) {
        contactsTitle = `Recibe tu primer ${BUSINESS_COPY[businessType].ordersLabel.slice(0, -1).toLowerCase() || 'pedido'}`
        contactsDescription = 'Cuando un cliente confirme una compra o solicitud, la veras en el sistema.'
        contactsHref = '/dashboard/orders'
        contactsDone = hasOrders || hasChats
    } else if (hasModule(enabledModules, 'appointments')) {
        contactsTitle = 'Coordina tu primera cita'
        contactsDescription = 'Usa chats y automatizaciones para captar reservas o visitas.'
        contactsHref = '/dashboard/chats'
        contactsDone = hasChats
    } else if (hasModule(enabledModules, 'leads')) {
        contactsTitle = 'Capta tu primer lead'
        contactsDescription = 'Empieza a recibir interesados y darles seguimiento desde el chat.'
        contactsHref = '/dashboard/chats'
        contactsDone = hasChats
    }

    return [
        {
            done: hasAssistant,
            title: 'Conecta tu WhatsApp',
            description: 'Vincula tu numero Business y deja listo el canal de atencion.',
            icon: Bot,
            href: '/dashboard/settings',
            cta: 'Configurar',
        },
        {
            done: hasTraining,
            title: 'Entrena tu asistente IA',
            description: 'Explica a la IA como vender, responder o derivar segun tu negocio.',
            icon: BookOpen,
            href: hasAssistant && assistantId ? `/dashboard/assistants/${assistantId}/training` : '/dashboard/assistants',
            cta: 'Entrenar',
        },
        {
            done: hasProducts,
            title: catalogTitle,
            description: 'Define productos, servicios, cursos o paquetes para responder mejor.',
            icon: ShoppingBag,
            href: catalogHref,
            cta: 'Agregar',
        },
        {
            done: contactsDone,
            title: contactsTitle,
            description: contactsDescription,
            icon: Users,
            href: contactsHref,
            cta: 'Abrir',
        },
        {
            done: hasFlows,
            title: 'Crea tu primer flujo',
            description: 'Disena automatizaciones para preguntas frecuentes, ventas o seguimiento.',
            icon: Zap,
            href: hasAssistant && assistantId ? `/dashboard/assistants/${assistantId}/flows` : '/dashboard/assistants',
            cta: 'Crear',
        },
        {
            done: hasChats,
            title: 'Recibe tu primer mensaje',
            description: 'Cuando un cliente escriba, veras la actividad y el historial aqui.',
            icon: MessageSquare,
            href: '/dashboard/chats',
            cta: 'Ver chats',
        },
    ]
}

function buildKpis(params: {
    businessType: BusinessType
    hasAssistant: boolean
    hasTraining: boolean
    activeChatsToday: number
    totalChats: number
    productCount: number
    orderCount: number
    pendingOrders: number
    completedOrders: number
    activeFlows: number
    activeTriggers: number
    totalSubscriptions: number
    activeSubscriptions: number
    dueSoon: number
    dueToday: number
}): KpiCard[] {
    const {
        businessType,
        hasAssistant,
        hasTraining,
        activeChatsToday,
        totalChats,
        productCount,
        orderCount,
        pendingOrders,
        completedOrders,
        activeFlows,
        activeTriggers,
        totalSubscriptions,
        activeSubscriptions,
        dueSoon,
        dueToday,
    } = params

    const cards: KpiCard[] = [
        {
            icon: MessageSquare,
            label: 'Chats hoy',
            value: activeChatsToday,
            sub: `de ${totalChats} totales`,
            color: GREEN,
        },
    ]

    if (businessType === 'subscriptions' || businessType === 'gym') {
        cards.push(
            {
                icon: Users,
                label: 'Activos',
                value: activeSubscriptions,
                sub: `${totalSubscriptions} en total`,
                color: GREEN,
            },
            {
                icon: AlertTriangle,
                label: 'Vencen pronto',
                value: dueSoon,
                sub: `${dueToday} vencen hoy`,
                color: dueSoon > 0 ? '#d97706' : 'rgba(15,23,42,0.30)',
            },
        )
    } else if (businessType === 'restaurant' || businessType === 'store' || businessType === 'travel') {
        cards.push(
            {
                icon: ShoppingBag,
                label: BUSINESS_COPY[businessType].ordersLabel,
                value: orderCount,
                sub: `${pendingOrders} pendientes`,
                color: GREEN,
            },
            {
                icon: Send,
                label: 'Cerrados',
                value: completedOrders,
                sub: 'pedidos o reservas finalizadas',
                color: GREEN,
            },
        )
    } else {
        cards.push(
            {
                icon: ShoppingBag,
                label: BUSINESS_COPY[businessType].productsLabel,
                value: productCount,
                sub: 'catalogo o servicios configurados',
                color: GREEN,
            },
            {
                icon: Users,
                label: BUSINESS_COPY[businessType].contactsLabel,
                value: totalChats,
                sub: `${activeChatsToday} con actividad hoy`,
                color: GREEN,
            },
        )
    }

    cards.push(
        {
            icon: Workflow,
            label: 'Flujos activos',
            value: activeFlows,
            sub: 'automatizaciones conversacionales',
            color: activeFlows > 0 ? GREEN : 'rgba(15,23,42,0.30)',
        },
        {
            icon: Zap,
            label: 'Disparadores',
            value: activeTriggers,
            sub: 'reglas en ejecucion',
            color: activeTriggers > 0 ? GREEN : 'rgba(15,23,42,0.30)',
        },
        {
            icon: Bot,
            label: 'Asistente IA',
            value: hasAssistant ? 'Si' : 'No',
            sub: hasTraining ? 'Entrenado' : 'Sin entrenar',
            color: hasTraining ? GREEN : 'rgba(15,23,42,0.30)',
        },
    )

    return cards
}

function buildQuickLinks(params: {
    enabledModules: BusinessModule[]
    assistantId?: string
}): QuickLinkItem[] {
    const { enabledModules, assistantId } = params
    const items: QuickLinkItem[] = []

    if (hasModule(enabledModules, 'chats')) {
        items.push({ icon: MessageSquare, label: 'Chats', href: '/dashboard/chats' })
    }
    if (hasModule(enabledModules, 'orders')) {
        items.push({ icon: ShoppingBag, label: 'Pedidos', href: '/dashboard/orders' })
    }
    if (hasModule(enabledModules, 'products')) {
        items.push({ icon: FileText, label: 'Catalogo', href: '/dashboard/products' })
    }
    if (hasModule(enabledModules, 'subscriptions')) {
        items.push({ icon: Users, label: 'Suscripciones', href: '/dashboard/subscriptions' })
    }
    if (hasModule(enabledModules, 'flows')) {
        items.push({
            icon: Workflow,
            label: 'Flujos',
            href: assistantId ? `/dashboard/assistants/${assistantId}/flows` : '/dashboard/assistants',
        })
    }
    if (hasModule(enabledModules, 'triggers')) {
        items.push({
            icon: Zap,
            label: 'Triggers',
            href: assistantId ? `/dashboard/assistants/${assistantId}/triggers` : '/dashboard/assistants',
        })
    }
    if (hasModule(enabledModules, 'training')) {
        items.push({
            icon: BookOpen,
            label: 'Entrenamiento',
            href: assistantId ? `/dashboard/assistants/${assistantId}/training` : '/dashboard/assistants',
        })
    }

    return items.slice(0, 4)
}

function buildNextAction(params: {
    businessType: BusinessType
    planOverLimit: boolean
    planNearLimit: boolean
    convBalance: number | null
    dueToday: number
    dueSoon: number
    pendingOrders: number
    notifsFailed: number
}): NextAction {
    const {
        businessType,
        planOverLimit,
        planNearLimit,
        convBalance,
        dueToday,
        dueSoon,
        pendingOrders,
        notifsFailed,
    } = params

    if (planOverLimit) {
        return {
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.06)',
            border: 'rgba(239,68,68,0.22)',
            title: 'Plan agotado',
            desc: 'Recarga tu saldo para que el asistente vuelva a responder automaticamente.',
            href: '/dashboard/upgrade',
            cta: 'Recargar',
        }
    }

    if (planNearLimit) {
        return {
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.06)',
            border: 'rgba(245,158,11,0.22)',
            title: `Te quedan pocas conversaciones (${convBalance ?? 0})`,
            desc: 'Conviene recargar pronto para no interrumpir la atencion.',
            href: '/dashboard/upgrade',
            cta: 'Ver planes',
        }
    }

    if ((businessType === 'subscriptions' || businessType === 'gym') && dueToday > 0) {
        return {
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.06)',
            border: 'rgba(239,68,68,0.22)',
            title: `${dueToday} cliente${dueToday > 1 ? 's vencen' : ' vence'} hoy`,
            desc: 'Revisa las renovaciones del dia y responde comprobantes pendientes.',
            href: '/dashboard/subscriptions',
            cta: 'Ver renovaciones',
        }
    }

    if ((businessType === 'subscriptions' || businessType === 'gym') && dueSoon > 0) {
        return {
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.06)',
            border: 'rgba(245,158,11,0.22)',
            title: `${dueSoon} vencimiento${dueSoon > 1 ? 's' : ''} esta semana`,
            desc: 'Activa recordatorios o seguimiento preventivo desde el panel.',
            href: '/dashboard/subscriptions',
            cta: 'Abrir clientes',
        }
    }

    if (pendingOrders > 0) {
        return {
            color: '#0f766e',
            bg: 'rgba(15,118,110,0.06)',
            border: 'rgba(15,118,110,0.22)',
            title: `${pendingOrders} ${pendingOrders > 1 ? 'operaciones pendientes' : 'operacion pendiente'}`,
            desc: 'Hay pedidos, reservas o casos que necesitan seguimiento del equipo.',
            href: '/dashboard/orders',
            cta: 'Revisar',
        }
    }

    if (notifsFailed > 0) {
        return {
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.06)',
            border: 'rgba(245,158,11,0.22)',
            title: `${notifsFailed} notificacion${notifsFailed > 1 ? 'es fallidas' : ' fallida'}`,
            desc: 'Revisa por que algunos avisos no llegaron y corrige el flujo.',
            href: '/dashboard/home',
            cta: 'Revisar',
        }
    }

    return {
        color: GREEN,
        bg: 'rgba(37,211,102,0.06)',
        border: 'rgba(37,211,102,0.20)',
        title: 'Todo al dia',
        desc: 'La operacion esta estable. Sigue monitoreando conversaciones y automatizaciones desde aqui.',
        href: null,
        cta: null,
    }
}

function formatCurrency(amount: number | null) {
    if (amount === null || Number.isNaN(amount)) return '-'
    return amount.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function readBusinessGoals(
    businessType: BusinessType,
    businessProfile: unknown,
): BusinessGoal[] {
    const profileRecord =
        businessProfile &&
            typeof businessProfile === 'object' &&
            !Array.isArray(businessProfile)
            ? businessProfile as BusinessProfileRecord
            : {}

    return normalizeBusinessGoalsForBusinessType(businessType, profileRecord.goals)
}

export default async function HomePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
    const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)

    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
        { data: profile },
        { data: assistants },
        { count: productCount },
        { count: activeFlows },
        { count: totalChats },
        { count: activeChatsToday },
        { data: activeSubs },
        { count: totalSubscriptions },
        { count: activeTriggers },
        { data: recentNotifs },
        { data: recentMessages },
        { data: recentOrders },
        { count: orderCount },
        { count: pendingOrders },
        { count: completedOrders },
        { data: chatSignals },
        { data: goalOrderSignals },
        { data: renewalMetrics },
    ] = await Promise.all([
        admin
            .from('user_profiles')
            .select('business_type, enabled_modules, conversations_balance, conversations_total, business_profile')
            .eq('id', user.id)
            .maybeSingle(),
        supabase
            .from('whatsapp_credentials')
            .select('id, bot_name, training_prompt')
            .eq('user_id', user.id),
        supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        supabase
            .from('conversation_flows')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true),
        supabase
            .from('chats')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        supabase
            .from('chats')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('last_message_time', last24h),
        supabase
            .from('subscriptions')
            .select('id, correo, numero, vencimiento, estado, servicio')
            .eq('user_id', user.id)
            .eq('estado', 'activo'),
        supabase
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        supabase
            .from('triggers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true),
        supabase
            .from('subscription_notification_logs')
            .select('message_type, status, created_at, phone_number')
            .eq('user_id', user.id)
            .gte('created_at', last7d)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('chats')
            .select('last_message, last_message_time, contact_name, phone_number')
            .eq('user_id', user.id)
            .gte('last_message_time', last24h)
            .order('last_message_time', { ascending: false })
            .limit(6),
        supabase
            .from('orders')
            .select('id, contact_name, phone_number, plan_name, amount, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(6),
        supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('status', ['pending_email', 'pending_payment', 'pending_delivery', 'pending_review']),
        supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('status', ['delivered', 'completed']),
        supabase
            .from('chats')
            .select('status, tags, last_message_time')
            .eq('user_id', user.id),
        supabase
            .from('orders')
            .select('status, product, created_at')
            .eq('user_id', user.id)
            .gte('created_at', last30d),
        supabase
            .from('subscription_renewals')
            .select('status, created_at')
            .eq('user_id', user.id)
            .gte('created_at', last30d),
    ])

    const businessType: BusinessType = isBusinessType(profile?.business_type)
        ? profile.business_type
        : 'subscriptions'
    const enabledModules = normalizeBusinessModules(profile?.enabled_modules, getModulesForBusinessType(businessType))
    const businessGoals = readBusinessGoals(businessType, profile?.business_profile)
    const focusSummary = getBusinessFocusSummary(businessGoals)
    const focusDescription = getBusinessFocusDescription(businessGoals)
    const focusTitles = getBusinessGoalTitles(businessGoals)
    const copy = BUSINESS_COPY[businessType]

    const convBalance = profile?.conversations_balance ?? null
    const convTotal = profile?.conversations_total ?? 500
    const planOverLimit = convBalance !== null && isOverLimit(convBalance)
    const planNearLimit = convBalance !== null && !planOverLimit && isNearLimit(convBalance, convTotal)

    const assistantRows = (assistants ?? []) as Assistant[]
    const subscriptions = (activeSubs ?? []) as SubscriptionRow[]
    const messageRows = (recentMessages ?? []) as RecentMessage[]
    const notificationRows = (recentNotifs ?? []) as NotificationRow[]
    const orderRows = (recentOrders ?? []) as OrderRow[]
    const chatSignalRows = (chatSignals ?? []) as ChatSignalRow[]
    const goalOrderRows = (goalOrderSignals ?? []) as GoalOrderSignalRow[]
    const renewalMetricRows = (renewalMetrics ?? []) as RenewalMetricRow[]

    const hasAssistant = assistantRows.length > 0
    const hasTraining = assistantRows.some((assistant) => assistant.training_prompt && assistant.training_prompt.trim().length > 50)
    const assistantId = assistantRows[0]?.id
    const hasProducts = (productCount ?? 0) > 0
    const hasFlows = (activeFlows ?? 0) > 0
    const hasChats = (totalChats ?? 0) > 0
    const hasOrders = (orderCount ?? 0) > 0
    const hasSubscriptions = (totalSubscriptions ?? 0) > 0

    const dueToday = subscriptions.filter((subscription) => diffDays(subscription.vencimiento) === 0)
    const dueSoon = subscriptions.filter((subscription) => {
        const days = diffDays(subscription.vencimiento)
        return days >= 0 && days <= 7
    })

    const subscriptionsByService: Record<string, { total: number; dueSoon: number }> = {}
    for (const subscription of subscriptions) {
        const service = subscription.servicio || 'Servicio'
        if (!subscriptionsByService[service]) {
            subscriptionsByService[service] = { total: 0, dueSoon: 0 }
        }
        subscriptionsByService[service].total += 1
        const days = diffDays(subscription.vencimiento)
        if (days >= 0 && days <= 7) {
            subscriptionsByService[service].dueSoon += 1
        }
    }

    const sentNotifications = notificationRows.filter((notification) => notification.status === 'sent').length
    const failedNotifications = notificationRows.filter((notification) => notification.status === 'failed').length

    const steps = buildSteps({
        businessType,
        enabledModules,
        hasAssistant,
        hasTraining,
        hasProducts,
        hasFlows,
        hasChats,
        hasOrders,
        hasSubscriptions,
        assistantId,
    })
    const completedSteps = steps.filter((step) => step.done).length
    const allDone = completedSteps === steps.length
    const progressPct = Math.round((completedSteps / steps.length) * 100)

    const kpis = buildKpis({
        businessType,
        hasAssistant,
        hasTraining,
        activeChatsToday: activeChatsToday ?? 0,
        totalChats: totalChats ?? 0,
        productCount: productCount ?? 0,
        orderCount: orderCount ?? 0,
        pendingOrders: pendingOrders ?? 0,
        completedOrders: completedOrders ?? 0,
        activeFlows: activeFlows ?? 0,
        activeTriggers: activeTriggers ?? 0,
        totalSubscriptions: totalSubscriptions ?? 0,
        activeSubscriptions: subscriptions.length,
        dueSoon: dueSoon.length,
        dueToday: dueToday.length,
    })

    const quickLinks = buildQuickLinks({
        enabledModules,
        assistantId,
    })
    const goalPerformanceCards = buildGoalPerformanceCards({
        goals: businessGoals,
        chatSignals: chatSignalRows,
        orderSignals: goalOrderRows,
        renewalSignals: renewalMetricRows,
        dueSoonCount: dueSoon.length,
        dueTodayCount: dueToday.length,
        last7dIso: last7d,
    })

    const nextAction = buildNextAction({
        businessType,
        planOverLimit,
        planNearLimit,
        convBalance,
        dueToday: dueToday.length,
        dueSoon: dueSoon.length,
        pendingOrders: pendingOrders ?? 0,
        notifsFailed: failedNotifications,
    })

    const remainingSteps = steps.length - completedSteps

    return (
        <div style={{ minHeight: '100vh', padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
            {planOverLimit && (
                <div style={{
                    background: 'rgba(244,63,94,0.07)',
                    border: '1px solid rgba(244,63,94,0.25)',
                    borderRadius: 12,
                    padding: '14px 20px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={18} style={{ color: '#fb7185', flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#fb7185' }}>
                                Sin conversaciones disponibles
                            </p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.40)' }}>
                                Recarga tu saldo para que el asistente siga respondiendo.
                            </p>
                        </div>
                    </div>
                    <Link href="/dashboard/upgrade" style={{
                        background: '#fb7185',
                        color: '#fff',
                        borderRadius: '9999px',
                        padding: '0.5rem 1.25rem',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                    }}>
                        Recargar ahora
                    </Link>
                </div>
            )}

            {planNearLimit && (
                <div style={{
                    background: 'rgba(251,191,36,0.06)',
                    border: '1px solid rgba(251,191,36,0.2)',
                    borderRadius: 12,
                    padding: '14px 20px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Zap size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#fbbf24' }}>
                                Te quedan {convBalance} conversaciones
                            </p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.40)' }}>
                                Conviene recargar pronto para no interrumpir el servicio.
                            </p>
                        </div>
                    </div>
                    <Link href="/dashboard/upgrade" style={{
                        background: 'rgba(251,191,36,0.15)',
                        color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.3)',
                        borderRadius: '9999px',
                        padding: '0.5rem 1.25rem',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                    }}>
                        Ver planes
                    </Link>
                </div>
            )}

            <div style={{
                background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                border: '1px solid rgba(37,211,102,0.20)',
                borderRadius: 16,
                padding: '32px 36px',
                marginBottom: 28,
                borderTop: '2px solid rgba(37,211,102,0.45)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{
                        padding: '5px 14px',
                        borderRadius: 20,
                        background: 'rgba(37,211,102,0.12)',
                        border: '1px solid rgba(37,211,102,0.25)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: GREEN,
                        letterSpacing: '0.05em',
                    }}>
                        {copy.badge}
                    </div>
                    <div style={{
                        padding: '5px 14px',
                        borderRadius: 20,
                        background: 'rgba(37,211,102,0.12)',
                        border: '1px solid rgba(37,211,102,0.25)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: GREEN,
                    }}>
                        {allDone ? 'Operativo' : `${remainingSteps} paso${remainingSteps > 1 ? 's' : ''} pendientes`}
                    </div>
                    {(businessType === 'subscriptions' || businessType === 'gym') && dueToday.length > 0 && (
                        <div style={{
                            padding: '5px 14px',
                            borderRadius: 20,
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#f87171',
                        }}>
                            {dueToday.length} vencen hoy
                        </div>
                    )}
                </div>

                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0F172A', marginBottom: 10, lineHeight: 1.2 }}>
                    Hola, <span style={{ color: GREEN }}>{userName}</span>
                </h1>
                <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: '1rem', maxWidth: 620, lineHeight: 1.6 }}>
                    {allDone ? copy.ready : copy.pending}
                </p>

                <div style={{
                    marginTop: 18,
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(37,211,102,0.18)',
                    maxWidth: 760,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: GREEN,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                        }}>
                            Foco activo
                        </span>
                        <span style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#0F172A',
                        }}>
                            {focusSummary}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.50)', lineHeight: 1.55 }}>
                        {focusDescription}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        {focusTitles.map((goal) => (
                            <span
                                key={goal}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: 9999,
                                    background: 'rgba(37,211,102,0.10)',
                                    border: '1px solid rgba(37,211,102,0.18)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: GREEN,
                                }}
                            >
                                {goal}
                            </span>
                        ))}
                    </div>
                </div>

                {!allDone && (
                    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ flex: 1, maxWidth: 280, height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progressPct}%`, background: GREEN, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{progressPct}% listo</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-7">
                {kpis.map((stat, index) => (
                    <div key={`${stat.label}-${index}`} style={{
                        padding: '16px 18px',
                        borderRadius: 12,
                        background: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.07)',
                        borderTop: `2px solid ${stat.color}`,
                    }}>
                        <stat.icon size={18} style={{ color: stat.color, marginBottom: 8 }} />
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(15,23,42,0.65)', marginTop: 5 }}>{stat.label}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.35)', marginTop: 3 }}>{stat.sub}</div>
                    </div>
                ))}
            </div>

            {goalPerformanceCards.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Sparkles size={16} style={{ color: GREEN }} />
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                            Resultados por foco activo
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {goalPerformanceCards.map((card) => (
                            <Link
                                key={card.goal}
                                href={card.href}
                                style={{
                                    display: 'block',
                                    padding: '18px 20px',
                                    borderRadius: 14,
                                    background: '#ffffff',
                                    border: '1px solid rgba(0,0,0,0.07)',
                                    borderTop: `2px solid ${card.color}`,
                                    textDecoration: 'none',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <div style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 10,
                                        background: card.bg,
                                        border: `1px solid ${card.color}22`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <card.icon size={17} style={{ color: card.color }} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: card.color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            {card.title}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.40)', marginTop: 2 }}>
                                            {card.label}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: 8 }}>
                                    {card.value}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'rgba(15,23,42,0.48)', lineHeight: 1.5 }}>
                                    {card.sub}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-7 items-start">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrendingUp size={16} style={{ color: GREEN }} />
                            <span style={{ color: '#0F172A' }}>{copy.summaryTitle}</span>
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: 'rgba(15,23,42,0.45)', marginTop: -6, marginBottom: 14 }}>
                            {copy.summaryDescription}
                        </p>

                        {(businessType === 'subscriptions' || businessType === 'gym') && subscriptions.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(subscriptionsByService).map(([service, data]) => (
                                    <div key={service} style={{
                                        padding: '16px 18px',
                                        borderRadius: 12,
                                        background: '#ffffff',
                                        border: '1px solid rgba(0,0,0,0.07)',
                                        borderTop: `2px solid ${GREEN}`,
                                    }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: GREEN, letterSpacing: '0.08em', marginBottom: 8 }}>
                                            {service}
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{data.total}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(15,23,42,0.40)', marginTop: 4 }}>activas</div>
                                        {data.dueSoon > 0 && (
                                            <div style={{
                                                marginTop: 10,
                                                padding: '4px 8px',
                                                borderRadius: 6,
                                                background: 'rgba(0,0,0,0.05)',
                                                border: '1px solid rgba(0,0,0,0.10)',
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                color: 'rgba(15,23,42,0.65)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                            }}>
                                                {data.dueSoon} vencen pronto
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : orderRows.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {orderRows.map((order) => (
                                    <Link key={order.id} href="/dashboard/orders" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '12px 14px',
                                        borderRadius: 12,
                                        background: '#ffffff',
                                        border: '1px solid rgba(0,0,0,0.07)',
                                        textDecoration: 'none',
                                    }}>
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            padding: '2px 7px',
                                            borderRadius: 6,
                                            background: 'rgba(37,211,102,0.10)',
                                            color: GREEN,
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {order.status || 'nuevo'}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: '#0F172A', flex: 1 }}>
                                            {order.contact_name || order.phone_number || 'Sin nombre'}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.45)' }}>
                                            {order.plan_name || copy.ordersLabel}
                                        </span>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                                            {formatCurrency(order.amount)}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                padding: '18px 20px',
                                borderRadius: 16,
                                background: '#ffffff',
                                border: '1px solid rgba(0,0,0,0.07)',
                            }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                                    Aun no hay suficiente actividad para este resumen
                                </p>
                                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'rgba(15,23,42,0.45)' }}>
                                    En cuanto entren conversaciones, pedidos o suscripciones, este bloque mostrara el pulso del negocio.
                                </p>
                            </div>
                        )}
                    </div>

                    {(businessType === 'subscriptions' || businessType === 'gym') && dueSoon.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} style={{ color: 'rgba(15,23,42,0.55)' }} />
                                <span style={{ color: '#0F172A' }}>Vencimientos proximos</span>
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {dueSoon.slice(0, 8).map((subscription) => {
                                    const days = diffDays(subscription.vencimiento)
                                    const urgent = days <= 1
                                    return (
                                        <div key={subscription.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: '10px 14px',
                                            borderRadius: 12,
                                            background: urgent ? 'rgba(220,38,38,0.04)' : '#ffffff',
                                            border: urgent ? '1px solid rgba(220,38,38,0.25)' : '1px solid rgba(0,0,0,0.07)',
                                        }}>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                padding: '2px 7px',
                                                borderRadius: 6,
                                                background: 'rgba(37,211,102,0.10)',
                                                color: GREEN,
                                            }}>
                                                {subscription.servicio || 'Servicio'}
                                            </span>
                                            <span style={{ fontSize: '0.8rem', color: '#0F172A', flex: 1, fontFamily: 'monospace' }}>
                                                {subscription.correo || subscription.numero}
                                            </span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: urgent ? '#dc2626' : 'rgba(15,23,42,0.55)',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {days === 0 ? 'Hoy' : days === 1 ? 'Manana' : `${days}d · ${formatDate(subscription.vencimiento)}`}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={16} style={{ color: GREEN }} />
                            <span style={{ color: '#0F172A' }}>
                                {allDone ? 'Configuracion completa' : `Primeros pasos - ${completedSteps}/${steps.length}`}
                            </span>
                        </h2>

                        {allDone ? (
                            <div style={{
                                padding: '20px 24px',
                                borderRadius: 16,
                                background: nextAction.bg,
                                border: `1px solid ${nextAction.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                            }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 700, color: nextAction.color, fontSize: '0.9rem', margin: 0 }}>
                                        {nextAction.title}
                                    </p>
                                    <p style={{ fontSize: '0.78rem', color: 'rgba(15,23,42,0.50)', marginTop: 4, margin: '4px 0 0' }}>
                                        {nextAction.desc}
                                    </p>
                                </div>
                                {nextAction.href && nextAction.cta && (
                                    <Link href={nextAction.href} style={{
                                        flexShrink: 0,
                                        padding: '7px 16px',
                                        borderRadius: 20,
                                        background: nextAction.color,
                                        color: '#fff',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                    }}>
                                        {nextAction.cta}
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {steps.map((step, index) => (
                                    <div key={`${step.title}-${index}`} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        padding: '12px 16px',
                                        borderRadius: 14,
                                        border: step.done ? '1px solid rgba(37,211,102,0.15)' : '1px solid rgba(37,211,102,0.10)',
                                        background: step.done ? 'rgba(37,211,102,0.04)' : 'rgba(37,211,102,0.02)',
                                        opacity: step.done ? 0.6 : 1,
                                    }}>
                                        <div style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            background: step.done ? 'rgba(37,211,102,0.12)' : 'rgba(37,211,102,0.08)',
                                            border: `2px solid ${step.done ? 'rgba(37,211,102,0.30)' : 'rgba(37,211,102,0.18)'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            {step.done ? <CheckCircle2 size={15} style={{ color: GREEN }} /> : <step.icon size={15} style={{ color: GREEN }} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A' }}>{step.title}</p>
                                            <p style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.45)', marginTop: 1 }}>{step.description}</p>
                                        </div>
                                        {step.done ? (
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: GREEN, whiteSpace: 'nowrap' }}>Listo</span>
                                        ) : (
                                            <Link href={step.href} style={{
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: '0.73rem',
                                                fontWeight: 700,
                                                color: GREEN,
                                                padding: '5px 11px',
                                                borderRadius: 8,
                                                background: 'rgba(37,211,102,0.10)',
                                                border: '1px solid rgba(37,211,102,0.25)',
                                                textDecoration: 'none',
                                            }}>
                                                {step.cta} <ArrowRight size={10} />
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {messageRows.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Activity size={16} style={{ color: GREEN }} />
                                <span style={{ color: '#0F172A' }}>Actividad reciente</span>
                                <Link href="/dashboard/chats" style={{
                                    marginLeft: 'auto',
                                    fontSize: '0.72rem',
                                    color: GREEN,
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                }}>
                                    Ver chats <ArrowRight size={11} />
                                </Link>
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {messageRows.map((chat, index) => {
                                    const time = chat.last_message_time
                                        ? new Date(chat.last_message_time).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
                                        : ''
                                    return (
                                        <Link key={`${chat.phone_number}-${index}`} href="/dashboard/chats" style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 10,
                                            padding: '10px 12px',
                                            borderRadius: 12,
                                            background: '#ffffff',
                                            border: '1px solid rgba(0,0,0,0.07)',
                                            textDecoration: 'none',
                                        }}>
                                            <div style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                background: 'rgba(37,211,102,0.10)',
                                                border: '1px solid rgba(37,211,102,0.20)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <MessageSquare size={15} style={{ color: GREEN }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                                                    {chat.contact_name || chat.phone_number}
                                                </p>
                                                <p style={{
                                                    fontSize: '0.7rem',
                                                    color: 'rgba(15,23,42,0.35)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {chat.last_message || '-'}
                                                </p>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.25)', flexShrink: 0 }}>{time}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {notificationRows.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Bell size={16} style={{ color: GREEN }} />
                                <span style={{ color: '#0F172A' }}>Notificaciones (7 dias)</span>
                            </h2>
                            <div style={{
                                padding: '14px 16px',
                                borderRadius: 16,
                                background: '#ffffff',
                                border: '1px solid rgba(37,211,102,0.15)',
                            }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                    {[
                                        { label: 'Enviadas', val: sentNotifications, color: GREEN, bg: 'rgba(37,211,102,0.08)' },
                                        { label: 'Fallidas', val: failedNotifications, color: '#f87171', bg: 'rgba(239,68,68,0.08)' },
                                    ].map((item) => (
                                        <div key={item.label} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, background: item.bg }}>
                                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: item.color }}>{item.val}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.35)', marginTop: 2 }}>{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {notificationRows.slice(0, 5).map((notification, index) => (
                                        <div key={`${notification.created_at}-${index}`} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '5px 0',
                                            borderBottom: index < 4 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                                        }}>
                                            <span style={{
                                                fontSize: '0.6rem',
                                                fontWeight: 700,
                                                padding: '2px 6px',
                                                borderRadius: 5,
                                                background: notification.status === 'sent' ? 'rgba(37,211,102,0.10)' : 'rgba(239,68,68,0.10)',
                                                color: notification.status === 'sent' ? GREEN : '#f87171',
                                            }}>
                                                {notification.status === 'sent' ? 'OK' : 'ERR'}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.50)', flex: 1 }}>
                                                {notification.message_type}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.25)', fontFamily: 'monospace' }}>
                                                {notification.phone_number?.slice(-8)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrendingUp size={16} style={{ color: GREEN }} />
                            <span style={{ color: '#0F172A' }}>Accesos rapidos</span>
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            {quickLinks.map((item) => (
                                <Link key={item.label} href={item.href} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '11px 14px',
                                    borderRadius: 10,
                                    background: '#ffffff',
                                    border: '1px solid rgba(0,0,0,0.07)',
                                    textDecoration: 'none',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    color: 'rgba(15,23,42,0.75)',
                                }}>
                                    <item.icon size={16} style={{ color: GREEN, flexShrink: 0 }} />
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
