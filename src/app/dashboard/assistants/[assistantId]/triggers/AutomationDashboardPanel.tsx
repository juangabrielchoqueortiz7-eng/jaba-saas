'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Bot,
    CheckCircle2,
    ClipboardCheck,
    FileText,
    GitBranch,
    HeartPulse,
    Layers3,
    Map as MapIcon,
    MessageSquare,
    PackageCheck,
    PlayCircle,
    ShieldAlert,
    Sparkles,
    TestTube2,
    Wand2,
    Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    AUTOMATION_SEQUENCE_PACKS,
    type AutomationSequenceKey,
} from '@/lib/automation-sequence-config'
import {
    getSequenceAutomationPanelData,
    getTriggers,
    type SequenceAutomationListItem,
    type TriggerListItem,
} from './actions'

type MetaTemplate = {
    id: string
    name: string
    status: string
}

type MetaTemplatesResponse = {
    templates?: MetaTemplate[]
    error?: string
}

type ObjectiveKey = 'recover_sales' | 'renewals' | 'bookings' | 'support' | 'leads' | 'broadcast'

type Objective = {
    key: ObjectiveKey
    title: string
    plainGoal: string
    bestTool: string
    primaryHref: (assistantId: string) => string
    primaryLabel: string
    sequenceKeys: AutomationSequenceKey[]
    timeline: string[]
}

const OBJECTIVES: Objective[] = [
    {
        key: 'recover_sales',
        title: 'Recuperar ventas',
        plainGoal: 'Dar seguimiento cuando un cliente deja pendiente correo, pago o comprobante.',
        bestTool: 'Secuencia + plantilla 24h',
        primaryHref: id => `/dashboard/assistants/${id}/triggers#seguimientos`,
        primaryLabel: 'Configurar seguimiento',
        sequenceKeys: ['sales_pending_email_followup', 'sales_pending_payment_followup'],
        timeline: ['Cliente inicia pedido', 'Queda pendiente un dato', 'Bot espera', 'Envia seguimiento', 'Se cancela si avanza'],
    },
    {
        key: 'renewals',
        title: 'Recordar renovaciones',
        plainGoal: 'Evitar que clientes activos se olviden de renovar o enviar comprobante.',
        bestTool: 'Secuencia de renovacion',
        primaryHref: id => `/dashboard/assistants/${id}/triggers#seguimientos`,
        primaryLabel: 'Configurar renovacion',
        sequenceKeys: ['renewal_pending_payment_followup'],
        timeline: ['Cliente elige renovar', 'Falta pago', 'Bot recuerda', 'Usa plantilla si pasan 24h', 'Se detiene si paga'],
    },
    {
        key: 'bookings',
        title: 'Confirmar reservas',
        plainGoal: 'Pedir fecha, hora o dato faltante para cerrar una cita o reserva.',
        bestTool: 'Flujo + secuencia',
        primaryHref: id => `/dashboard/assistants/${id}/flows/new`,
        primaryLabel: 'Crear flujo de reserva',
        sequenceKeys: ['booking_confirmation_reminder'],
        timeline: ['Cliente pide reservar', 'Bot pide datos', 'Falta confirmar', 'Envio recordatorio', 'Se cancela al confirmar'],
    },
    {
        key: 'support',
        title: 'Soporte sin abandono',
        plainGoal: 'Mantener vivos casos abiertos y pedir el dato que falta.',
        bestTool: 'Disparador + secuencia SLA',
        primaryHref: id => `/dashboard/assistants/${id}/triggers/new`,
        primaryLabel: 'Crear disparador',
        sequenceKeys: ['support_escalation_sla'],
        timeline: ['Cliente pide ayuda', 'Bot pide detalle', 'Espera respuesta', 'Escala o recuerda', 'Se cancela si avanza'],
    },
    {
        key: 'leads',
        title: 'Capturar leads',
        plainGoal: 'No perder contactos interesados que preguntaron y se fueron.',
        bestTool: 'Disparador + seguimiento',
        primaryHref: id => `/dashboard/assistants/${id}/triggers#seguimientos`,
        primaryLabel: 'Configurar leads',
        sequenceKeys: ['lead_capture_followup'],
        timeline: ['Cliente pide informacion', 'Bot responde', 'Lead se enfria', 'Bot da seguimiento', 'Se cancela si responde'],
    },
    {
        key: 'broadcast',
        title: 'Enviar campana',
        plainGoal: 'Enviar avisos masivos o mensajes fuera de 24 horas con Meta.',
        bestTool: 'Plantilla Meta',
        primaryHref: id => `/dashboard/assistants/${id}/templates`,
        primaryLabel: 'Crear plantilla',
        sequenceKeys: [],
        timeline: ['Crear plantilla', 'Esperar aprobacion', 'Elegir audiencia', 'Enviar campana', 'Medir respuestas'],
    },
]

function delayNeedsTemplate(minutes: number) {
    return minutes >= 23 * 60
}

function toneClass(tone: 'emerald' | 'amber' | 'red' | 'slate') {
    if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700'
    if (tone === 'red') return 'border-red-200 bg-red-50 text-red-700'
    return 'border-slate-200 bg-slate-50 text-slate-600'
}

function templateStatus(name: string, templates: MetaTemplate[]) {
    if (!name.trim()) return { label: 'Falta configurar', tone: 'amber' as const }
    const found = templates.find(template => template.name.toLowerCase() === name.trim().toLowerCase())
    if (!found) return { label: 'No encontrada', tone: 'amber' as const }
    if (found.status === 'APPROVED') return { label: 'Aprobada', tone: 'emerald' as const }
    if (found.status === 'PENDING') return { label: 'En revision', tone: 'amber' as const }
    return { label: found.status || 'Revisar', tone: 'red' as const }
}

export default function AutomationDashboardPanel() {
    const params = useParams()
    const assistantId = params?.assistantId as string
    const [selectedKey, setSelectedKey] = useState<ObjectiveKey>('recover_sales')
    const [advancedMode, setAdvancedMode] = useState(false)
    const [loading, setLoading] = useState(true)
    const [triggers, setTriggers] = useState<TriggerListItem[]>([])
    const [items, setItems] = useState<SequenceAutomationListItem[]>([])
    const [templates, setTemplates] = useState<MetaTemplate[]>([])
    const [templateError, setTemplateError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function loadPanelData() {
            setLoading(true)
            try {
                const [triggerData, sequenceData] = await Promise.all([
                    getTriggers(),
                    getSequenceAutomationPanelData(),
                ])
                if (!cancelled) {
                    setTriggers(triggerData)
                    setItems(sequenceData.items)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadPanelData()

        fetch('/api/meta-templates')
            .then(response => response.json() as Promise<MetaTemplatesResponse>)
            .then(data => {
                if (cancelled) return
                setTemplates(data.templates || [])
                setTemplateError(data.error || null)
            })
            .catch(() => {
                if (!cancelled) setTemplateError('No se pudieron leer plantillas de Meta')
            })

        return () => { cancelled = true }
    }, [])

    const selected = OBJECTIVES.find(objective => objective.key === selectedKey) || OBJECTIVES[0]
    const itemsByKey = useMemo(() => new Map(items.map(item => [item.key, item])), [items])
    const linkedTemplates = useMemo(() => {
        const rows: Array<{ sequence: string; step: string; name: string; delay: number }> = []
        items.forEach(item => {
            if (item.firstTemplateName || delayNeedsTemplate(item.firstDelayMinutes)) {
                rows.push({ sequence: item.shortTitle, step: 'Primer seguimiento', name: item.firstTemplateName, delay: item.firstDelayMinutes })
            }
            if (item.secondTemplateName || delayNeedsTemplate(item.secondDelayMinutes)) {
                rows.push({ sequence: item.shortTitle, step: 'Segundo seguimiento', name: item.secondTemplateName, delay: item.secondDelayMinutes })
            }
        })
        return rows
    }, [items])

    const conflicts = useMemo(() => {
        const issues: Array<{ title: string; detail: string; tone: 'amber' | 'red' }> = []

        items.forEach(item => {
            if (!item.enabled) return
            if (delayNeedsTemplate(item.firstDelayMinutes) && !item.firstTemplateName.trim()) {
                issues.push({
                    title: `${item.shortTitle}: falta plantilla en primer seguimiento`,
                    detail: 'Ese envio puede salir fuera de 24h. Configura una plantilla aprobada.',
                    tone: 'red',
                })
            }
            if (delayNeedsTemplate(item.secondDelayMinutes) && !item.secondTemplateName.trim()) {
                issues.push({
                    title: `${item.shortTitle}: falta plantilla en segundo seguimiento`,
                    detail: 'El segundo seguimiento normalmente necesita plantilla Meta.',
                    tone: 'red',
                })
            }
        })

        triggers.forEach(trigger => {
            if (trigger.is_active && trigger.action_count === 0) {
                issues.push({
                    title: `${trigger.name}: no tiene acciones`,
                    detail: 'Esta activo, pero no hay nada que ejecutar cuando se dispare.',
                    tone: 'amber',
                })
            }
        })

        if (templateError && items.some(item => item.enabled && (delayNeedsTemplate(item.firstDelayMinutes) || delayNeedsTemplate(item.secondDelayMinutes)))) {
            issues.push({
                title: 'Plantillas Meta no verificadas',
                detail: templateError,
                tone: 'amber',
            })
        }

        return issues
    }, [items, templateError, triggers])

    const metrics = useMemo(() => {
        const enabledItems = items.filter(item => item.enabled)
        const totals = items.reduce((accumulator, item) => {
            accumulator.started += item.metrics.startedLast30Days
            accumulator.sent += item.metrics.sentLast30Days
            accumulator.replied += item.metrics.repliedLast30Days
            accumulator.advanced += item.metrics.advancedLast30Days
            return accumulator
        }, { started: 0, sent: 0, replied: 0, advanced: 0 })
        const reactivationRate = totals.started > 0
            ? Math.round(((totals.replied + totals.advanced) / totals.started) * 100)
            : 0

        return {
            activeTriggers: triggers.filter(trigger => trigger.is_active).length,
            enabledSequences: enabledItems.length,
            activeRuns: enabledItems.reduce((total, item) => total + item.activeRuns, 0),
            linkedTemplates: linkedTemplates.filter(row => row.name.trim()).length,
            reactivationRate,
            ...totals,
        }
    }, [items, linkedTemplates, triggers])

    const healthTone = conflicts.some(issue => issue.tone === 'red')
        ? 'red'
        : conflicts.length > 0
            ? 'amber'
            : metrics.activeTriggers + metrics.enabledSequences > 0
                ? 'emerald'
                : 'slate'
    const selectedItems = selected.sequenceKeys
        .map(key => itemsByKey.get(key))
        .filter((item): item is SequenceAutomationListItem => Boolean(item))
    const packs = Object.values(AUTOMATION_SEQUENCE_PACKS)

    return (
        <section className="mb-6 overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-sm">
            <div className="border-b border-black/[0.06] bg-[#F7F8FA] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <Sparkles size={13} />
                            Centro unico de automatizaciones
                        </div>
                        <h2 className="text-xl font-bold text-[#0F172A]">Automatiza por objetivo, no por modulo tecnico.</h2>
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                            El cliente elige que quiere lograr y el panel muestra si conviene flujo, disparador, secuencia o plantilla.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAdvancedMode(value => !value)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        <Wand2 size={14} />
                        {advancedMode ? 'Ver modo simple' : 'Ver modo avanzado'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-[1.35fr_0.95fr]">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {[
                            { label: 'Automatizaciones activas', value: metrics.activeTriggers + metrics.enabledSequences, icon: Zap },
                            { label: 'Seguimientos en curso', value: metrics.activeRuns, icon: PlayCircle },
                            { label: 'Reactivacion 30 dias', value: `${metrics.reactivationRate}%`, icon: BarChart3 },
                        ].map(card => {
                            const Icon = card.icon
                            return (
                                <div key={card.label} className="rounded-lg border border-black/[0.07] bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <Icon size={17} className="text-cyan-700" />
                                        {loading && <span className="text-[10px] text-slate-400">Cargando</span>}
                                    </div>
                                    <p className="text-2xl font-bold text-[#0F172A]">{card.value}</p>
                                    <p className="mt-1 text-xs text-slate-500">{card.label}</p>
                                </div>
                            )
                        })}
                    </div>

                    <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">1. Objetivo</p>
                                <h3 className="text-sm font-bold text-[#0F172A]">Que quieres automatizar?</h3>
                            </div>
                            <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${toneClass(healthTone)}`}>
                                {healthTone === 'emerald' ? 'Salud OK' : healthTone === 'red' ? 'Revisar antes' : healthTone === 'amber' ? 'Atencion' : 'Sin activar'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {OBJECTIVES.map(objective => {
                                const active = objective.key === selectedKey
                                return (
                                    <button
                                        key={objective.key}
                                        type="button"
                                        onClick={() => setSelectedKey(objective.key)}
                                        className={`rounded-lg border p-4 text-left transition-colors ${
                                            active ? 'border-cyan-300 bg-cyan-50' : 'border-black/[0.07] bg-white hover:border-slate-300 hover:bg-[#F7F8FA]'
                                        }`}
                                    >
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <p className="text-sm font-bold text-[#0F172A]">{objective.title}</p>
                                            {active && <CheckCircle2 size={16} className="text-cyan-700" />}
                                        </div>
                                        <p className="text-xs leading-relaxed text-slate-500">{objective.plainGoal}</p>
                                        <p className="mt-2 text-[11px] font-semibold text-cyan-700">{objective.bestTool}</p>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="rounded-lg border border-black/[0.07] bg-[#F7F8FA] p-4">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">2. Wizard por objetivo</p>
                                <h3 className="text-base font-bold text-[#0F172A]">{selected.title}</h3>
                                <p className="mt-1 text-xs text-slate-500">{selected.plainGoal}</p>
                            </div>
                            <Link href={selected.primaryHref(assistantId)}>
                                <Button className="h-9 rounded-lg bg-[#0F172A] px-4 text-xs text-white hover:bg-[#1E293B]">
                                    {selected.primaryLabel}
                                    <ArrowRight size={14} className="ml-2" />
                                </Button>
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                            {selected.timeline.map((step, index) => (
                                <div key={step} className="rounded-lg border border-black/[0.06] bg-white p-3">
                                    <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">
                                        {index + 1}
                                    </span>
                                    <p className="text-xs leading-relaxed text-slate-600">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border border-black/[0.07] p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <PackageCheck size={17} className="text-emerald-700" />
                                <h3 className="text-sm font-bold text-[#0F172A]">Biblioteca de packs</h3>
                            </div>
                            <div className="space-y-2">
                                {packs.map(pack => {
                                    const activeCount = pack.sequenceKeys.filter(key => itemsByKey.get(key)?.enabled).length
                                    return (
                                        <Link
                                            key={pack.key}
                                            href={`/dashboard/assistants/${assistantId}/triggers#seguimientos`}
                                            className="block rounded-lg border border-black/[0.06] bg-white p-3 hover:border-emerald-200 hover:bg-emerald-50/40"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-bold text-[#0F172A]">{pack.title}</p>
                                                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{pack.description}</p>
                                                </div>
                                                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                                    {activeCount}/{pack.sequenceKeys.length}
                                                </span>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="rounded-lg border border-black/[0.07] p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <TestTube2 size={17} className="text-cyan-700" />
                                <h3 className="text-sm font-bold text-[#0F172A]">Probar con cliente de ejemplo</h3>
                            </div>
                            <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
                                <p className="text-xs font-semibold text-[#0F172A]">Simulacion: {selected.title}</p>
                                <div className="mt-3 space-y-2">
                                    {selected.timeline.slice(0, 4).map((step, index) => (
                                        <div key={step} className="flex items-start gap-2 text-xs text-slate-600">
                                            <span className="mt-0.5 h-2 w-2 rounded-full bg-cyan-600" />
                                            <span>{index === 0 ? `Cliente ejemplo: ${step.toLowerCase()}` : step}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                                Esta prueba no envia mensajes reales. Sirve para revisar el orden antes de activar.
                            </p>
                        </div>
                    </div>
                </div>

                <aside className="space-y-4">
                    <div className={`rounded-lg border p-4 ${toneClass(healthTone)}`}>
                        <div className="mb-3 flex items-center gap-2">
                            <HeartPulse size={17} />
                            <h3 className="text-sm font-bold">Estado de salud</h3>
                        </div>
                        <p className="text-xs leading-relaxed">
                            {healthTone === 'emerald'
                                ? 'Tus automatizaciones principales no muestran bloqueos criticos.'
                                : healthTone === 'red'
                                    ? 'Hay reglas que pueden fallar si no configuras plantillas para 24h.'
                                    : healthTone === 'amber'
                                        ? 'Hay avisos que conviene revisar antes de escalar.'
                                        : 'Aun no hay automatizaciones activas para medir.'}
                        </p>
                    </div>

                    <div className="rounded-lg border border-black/[0.07] p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <ShieldAlert size={17} className="text-amber-700" />
                            <h3 className="text-sm font-bold text-[#0F172A]">Detector de conflictos</h3>
                        </div>
                        {conflicts.length === 0 ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                                Sin conflictos visibles. Prueba cada automatizacion antes de activarla masivamente.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {conflicts.slice(0, 5).map(issue => (
                                    <div key={`${issue.title}-${issue.detail}`} className={`rounded-lg border p-3 ${toneClass(issue.tone)}`}>
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold">{issue.title}</p>
                                                <p className="mt-1 text-[11px] leading-relaxed">{issue.detail}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-black/[0.07] p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <FileText size={17} className="text-slate-700" />
                            <h3 className="text-sm font-bold text-[#0F172A]">Plantillas vinculadas</h3>
                        </div>
                        {linkedTemplates.length === 0 ? (
                            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                                Todavia no hay plantillas vinculadas a secuencias.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {linkedTemplates.slice(0, 6).map(template => {
                                    const status = templateStatus(template.name, templates)
                                    return (
                                        <div key={`${template.sequence}-${template.step}`} className="rounded-lg border border-black/[0.06] p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-bold text-[#0F172A]">{template.name || 'Sin plantilla'}</p>
                                                    <p className="mt-1 text-[11px] text-slate-500">{template.sequence} - {template.step}</p>
                                                </div>
                                                <span className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold ${toneClass(status.tone)}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {advancedMode && (
                        <>
                            <div className="rounded-lg border border-black/[0.07] p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <MapIcon size={17} className="text-cyan-700" />
                                    <h3 className="text-sm font-bold text-[#0F172A]">Mapa del bot</h3>
                                </div>
                                <div className="space-y-2 text-xs text-slate-600">
                                    {[
                                        { icon: MessageSquare, label: 'Cliente escribe o queda pendiente' },
                                        { icon: Zap, label: `${metrics.activeTriggers} disparadores revisan reglas` },
                                        { icon: GitBranch, label: 'Flujos guian conversaciones paso a paso' },
                                        { icon: Bot, label: `${metrics.enabledSequences} secuencias hacen seguimiento` },
                                        { icon: FileText, label: `${metrics.linkedTemplates} plantillas cubren mensajes fuera de 24h` },
                                    ].map(node => {
                                        const Icon = node.icon
                                        return (
                                            <div key={node.label} className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                                <Icon size={14} className="text-slate-500" />
                                                <span>{node.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="rounded-lg border border-black/[0.07] p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <Layers3 size={17} className="text-slate-700" />
                                    <h3 className="text-sm font-bold text-[#0F172A]">Modo simple / avanzado</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-2 text-xs text-slate-600">
                                    <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700">Simple: objetivo, audiencia, tiempo, mensaje y activar.</div>
                                    <div className="rounded-lg bg-slate-50 p-3 text-slate-600">Avanzado: condiciones, acciones, plantillas, conflictos, metricas y mapa.</div>
                                </div>
                            </div>
                        </>
                    )}
                </aside>
            </div>

            <div className="border-t border-black/[0.06] bg-[#F7F8FA] p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    {[
                        { label: 'Iniciadas 30 dias', value: metrics.started, icon: ClipboardCheck },
                        { label: 'Mensajes enviados', value: metrics.sent, icon: MessageSquare },
                        { label: 'Respondieron', value: metrics.replied, icon: CheckCircle2 },
                        { label: 'Avanzaron', value: metrics.advanced, icon: BarChart3 },
                    ].map(card => {
                        const Icon = card.icon
                        return (
                            <div key={card.label} className="rounded-lg border border-black/[0.07] bg-white p-3">
                                <div className="mb-2 flex items-center gap-2 text-slate-500">
                                    <Icon size={14} />
                                    <span className="text-[11px] font-semibold">{card.label}</span>
                                </div>
                                <p className="text-xl font-bold text-[#0F172A]">{card.value}</p>
                            </div>
                        )
                    })}
                </div>

                {selectedItems.length > 0 && (
                    <div className="mt-4 rounded-lg border border-black/[0.07] bg-white p-4">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Automatizaciones conectadas a este objetivo</p>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {selectedItems.map(item => (
                                <Link
                                    key={item.key}
                                    href={`/dashboard/assistants/${assistantId}/triggers#seguimientos`}
                                    className="rounded-lg border border-black/[0.06] p-3 hover:border-cyan-200 hover:bg-cyan-50/40"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold text-[#0F172A]">{item.title}</p>
                                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.outcomeLabel}</p>
                                        </div>
                                        <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${item.enabled ? toneClass('emerald') : toneClass('slate')}`}>
                                            {item.enabled ? 'Activa' : 'Lista'}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
