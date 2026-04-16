'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { BarChart3, BellRing, CheckCircle2, ChevronDown, ChevronUp, Clock3, Loader2, MessageSquareQuote, Pencil, PlayCircle, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    AUTOMATION_SEQUENCE_PACKS,
    AUTOMATION_SEQUENCE_PRESETS,
    formatDelayLabel,
    renderAutomationSequenceTemplate,
    type AutomationSequenceCustomPackDefinition,
    type AutomationSequencePackKey,
    type AutomationSequenceSimulationContext,
    type AutomationSequenceKey,
} from '@/lib/automation-sequence-config'
import { getBusinessGoalTitles } from '@/lib/business-goals'
import {
    deleteCustomSequenceAutomationPack,
    getSequenceAutomationPanelData,
    installCustomSequenceAutomationPack,
    installSequenceAutomationPack,
    saveSequenceAutomationConfig,
    saveCustomSequenceAutomationPack,
    type SequenceAutomationListItem,
} from './actions'

const VARIABLE_HINTS = [
    '{{planName}}',
    '{{amountWithParens}}',
    '{{serviceName}}',
    '{{paymentMethods}}',
    '{{customerEmailLine}}',
    '{{goalCta}}',
]

type SequenceEditorState = {
    key: AutomationSequenceKey
    enabled: boolean
    firstDelayMinutes: string
    secondDelayMinutes: string
    firstMessage: string
    secondMessage: string
}

type SimulationScenario = 'no_reply' | 'reply_after_first' | 'payment_before_first' | 'payment_after_first'

type SimulationDraft = AutomationSequenceSimulationContext & {
    scenario: SimulationScenario
}

type CustomPackEditorState = {
    key?: string
    title: string
    sequenceKeys: AutomationSequenceKey[]
}

type AutomationRecommendation = {
    id: string
    title: string
    detail: string
    reason: string
    ctaLabel: string
    tone: 'emerald' | 'blue' | 'amber'
    sequenceKey?: AutomationSequenceKey
    packKey?: AutomationSequencePackKey
    customPackKeys?: AutomationSequenceKey[]
}

const SIMULATION_SCENARIOS: Array<{
    id: SimulationScenario
    title: string
    description: string
}> = [
    {
        id: 'no_reply',
        title: 'El cliente no responde',
        description: 'La secuencia completa manda los dos seguimientos.',
    },
    {
        id: 'reply_after_first',
        title: 'Responde después del primer mensaje',
        description: 'Manda el primer recordatorio y luego se detiene sola.',
    },
    {
        id: 'payment_before_first',
        title: 'Paga antes del primer seguimiento',
        description: 'La secuencia se cancela antes de enviar cualquier mensaje.',
    },
    {
        id: 'payment_after_first',
        title: 'Paga después del primer mensaje',
        description: 'Manda el primer recordatorio y se detiene antes del segundo.',
    },
]

function isExactPackInstalled(sequenceKeys: AutomationSequenceKey[], items: SequenceAutomationListItem[]): boolean {
    return sequenceKeys.every((key) => items.some((item) => item.key === key && item.enabled))
        && items.filter((item) => !sequenceKeys.includes(item.key)).every((item) => !item.enabled)
}

function buildAutomationRecommendations({
    items,
    customPacks,
    activeGoals,
}: {
    items: SequenceAutomationListItem[]
    customPacks: AutomationSequenceCustomPackDefinition[]
    activeGoals: string[]
}): AutomationRecommendation[] {
    if (items.length === 0) return []

    const recommendations: AutomationRecommendation[] = []
    const salesPack = AUTOMATION_SEQUENCE_PACKS.sales_recovery
    const leadPack = AUTOMATION_SEQUENCE_PACKS.lead_capture
    const bookingPack = AUTOMATION_SEQUENCE_PACKS.booking_recovery
    const supportPack = AUTOMATION_SEQUENCE_PACKS.support_sla
    const renewalPack = AUTOMATION_SEQUENCE_PACKS.renewal_recovery
    const enabledItems = items.filter((item) => item.enabled)
    const pausedItemsWithSignals = items
        .filter((item) => !item.enabled && (item.metrics.startedLast30Days > 0 || item.activeRuns > 0))
        .sort((a, b) => b.metrics.startedLast30Days - a.metrics.startedLast30Days)
    const bestPerformer = [...items]
        .filter((item) => item.enabled && (item.metrics.repliedLast30Days > 0 || item.metrics.advancedLast30Days > 0))
        .sort((a, b) => (
            (b.metrics.repliedLast30Days + b.metrics.advancedLast30Days)
            - (a.metrics.repliedLast30Days + a.metrics.advancedLast30Days)
        ))[0]
    const paymentFollowup = items.find((item) => item.key === 'sales_pending_payment_followup')
    const renewalFollowup = items.find((item) => item.key === 'renewal_pending_payment_followup')

    if (
        (activeGoals.includes('sell_more') || activeGoals.includes('capture_leads'))
        && !isExactPackInstalled(salesPack.sequenceKeys, items)
    ) {
        recommendations.push({
            id: 'recommended-sales-pack',
            title: 'Activa recuperacion de ventas',
            detail: 'Tu foco apunta a vender o captar leads. Este pack cubre falta de correo y falta de pago sin tocar tus mensajes actuales.',
            reason: 'Recomendado por el foco activo',
            ctaLabel: 'Instalar pack ventas',
            tone: 'emerald',
            packKey: 'sales_recovery',
        })
    }

    if (
        activeGoals.includes('capture_leads')
        && !isExactPackInstalled(leadPack.sequenceKeys, items)
    ) {
        recommendations.push({
            id: 'recommended-lead-pack',
            title: 'Recupera leads que se enfrien',
            detail: 'Tu foco incluye captar leads. Este pack vuelve a escribir cuando alguien pide informacion y no avanza.',
            reason: 'Recomendado por leads',
            ctaLabel: 'Instalar pack leads',
            tone: 'emerald',
            packKey: 'lead_capture',
        })
    }

    if (
        activeGoals.includes('book_appointments')
        && !isExactPackInstalled(bookingPack.sequenceKeys, items)
    ) {
        recommendations.push({
            id: 'recommended-booking-pack',
            title: 'Cierra reservas pendientes',
            detail: 'Tu foco incluye agenda o reservas. Este pack recuerda al cliente confirmar fecha, hora o datos faltantes.',
            reason: 'Recomendado por reservas',
            ctaLabel: 'Instalar pack reservas',
            tone: 'blue',
            packKey: 'booking_recovery',
        })
    }

    if (
        activeGoals.includes('support_customers')
        && !isExactPackInstalled(supportPack.sequenceKeys, items)
    ) {
        recommendations.push({
            id: 'recommended-support-pack',
            title: 'Evita soportes sin seguimiento',
            detail: 'Tu foco incluye soporte. Este pack mantiene vivos los casos donde falta informacion o confirmacion del cliente.',
            reason: 'Recomendado por soporte',
            ctaLabel: 'Instalar pack soporte',
            tone: 'amber',
            packKey: 'support_sla',
        })
    }

    if (
        activeGoals.includes('renew_clients')
        && !isExactPackInstalled(renewalPack.sequenceKeys, items)
    ) {
        recommendations.push({
            id: 'recommended-renewal-pack',
            title: 'Refuerza renovaciones pendientes',
            detail: 'Tienes renovaciones como foco activo. Este pack mantiene seguimiento cuando el cliente ya eligio renovar pero aun falta pago.',
            reason: 'Recomendado por objetivo',
            ctaLabel: 'Instalar pack renovacion',
            tone: 'blue',
            packKey: 'renewal_recovery',
        })
    }

    if (paymentFollowup && !paymentFollowup.enabled && paymentFollowup.metrics.startedLast30Days > 0) {
        recommendations.push({
            id: 'payment-followup-paused',
            title: 'Hay señales de pago pendiente',
            detail: `Esta secuencia tuvo ${paymentFollowup.metrics.startedLast30Days} activacion${paymentFollowup.metrics.startedLast30Days === 1 ? '' : 'es'} recientes. Activarla ayuda a recuperar comprobantes sin seguimiento manual.`,
            reason: 'Detectado en ultimos 30 dias',
            ctaLabel: 'Activar falta pago',
            tone: 'amber',
            sequenceKey: paymentFollowup.key,
        })
    }

    if (renewalFollowup && !renewalFollowup.enabled && renewalFollowup.metrics.startedLast30Days > 0) {
        recommendations.push({
            id: 'renewal-followup-paused',
            title: 'No dejes renovaciones sin empuje',
            detail: `Vimos ${renewalFollowup.metrics.startedLast30Days} renovacion${renewalFollowup.metrics.startedLast30Days === 1 ? '' : 'es'} con movimiento reciente. Conviene dejar esta secuencia activa.`,
            reason: 'Actividad reciente',
            ctaLabel: 'Activar renovaciones',
            tone: 'blue',
            sequenceKey: renewalFollowup.key,
        })
    }

    const pausedCandidate = pausedItemsWithSignals.find((item) => (
        item.key !== paymentFollowup?.key && item.key !== renewalFollowup?.key
    ))
    if (pausedCandidate) {
        recommendations.push({
            id: `paused-${pausedCandidate.key}`,
            title: `Reactiva ${pausedCandidate.shortTitle.toLowerCase()}`,
            detail: `Ya tuvo actividad reciente. Si vuelve a pasar, el cliente recibira seguimiento sin que alguien tenga que escribir manualmente.`,
            reason: 'Secuencia pausada con senales',
            ctaLabel: 'Activar secuencia',
            tone: 'amber',
            sequenceKey: pausedCandidate.key,
        })
    }

    if (bestPerformer && customPacks.length === 0) {
        recommendations.push({
            id: 'save-winning-pack',
            title: 'Guarda lo que ya esta funcionando',
            detail: `${bestPerformer.shortTitle} genero ${bestPerformer.metrics.repliedLast30Days + bestPerformer.metrics.advancedLast30Days} avance${bestPerformer.metrics.repliedLast30Days + bestPerformer.metrics.advancedLast30Days === 1 ? '' : 's'} reciente${bestPerformer.metrics.repliedLast30Days + bestPerformer.metrics.advancedLast30Days === 1 ? '' : 's'}. Puedes convertir tus secuencias activas en un pack propio.`,
            reason: 'Basado en resultados',
            ctaLabel: 'Crear pack propio',
            tone: 'emerald',
            customPackKeys: enabledItems.length > 0 ? enabledItems.map((item) => item.key) : [bestPerformer.key],
        })
    }

    if (recommendations.length === 0) {
        recommendations.push({
            id: 'simulate-first',
            title: 'Prueba antes de tocar chats reales',
            detail: 'Tus secuencias no muestran riesgos importantes. Simula una de ellas para validar mensajes, tiempos y cancelaciones antes de hacer mas cambios.',
            reason: 'Panel saludable',
            ctaLabel: 'Simular primera secuencia',
            tone: 'blue',
            sequenceKey: items[0].key,
        })
    }

    return recommendations.slice(0, 3)
}

function clampDelayValue(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(Math.max(parsed, 1), 10080)
}

function buildEditorState(item: SequenceAutomationListItem): SequenceEditorState {
    return {
        key: item.key,
        enabled: item.enabled,
        firstDelayMinutes: String(item.firstDelayMinutes),
        secondDelayMinutes: String(item.secondDelayMinutes),
        firstMessage: item.firstMessage,
        secondMessage: item.secondMessage,
    }
}

function buildSimulationDraft(item: SequenceAutomationListItem): SimulationDraft {
    return {
        ...item.simulationDefaults,
        scenario: 'no_reply',
    }
}

function buildCustomPackEditorState(
    pack: AutomationSequenceCustomPackDefinition | null,
    fallbackKeys: AutomationSequenceKey[],
): CustomPackEditorState {
    return {
        key: pack?.key,
        title: pack?.title || '',
        sequenceKeys: pack?.sequenceKeys || fallbackKeys,
    }
}

function SimulationModal({
    item,
    onClose,
}: {
    item: SequenceAutomationListItem
    onClose: () => void
}) {
    const [draft, setDraft] = useState<SimulationDraft>(() => buildSimulationDraft(item))
    const focusTitles = getBusinessGoalTitles(draft.goals)

    const firstMessage = renderAutomationSequenceTemplate(item.firstMessage, draft)
    const secondMessage = renderAutomationSequenceTemplate(item.secondMessage, draft)

    const timeline = useMemo(() => {
        switch (draft.scenario) {
            case 'payment_before_first':
                return [
                    {
                        title: 'La secuencia se crea',
                        detail: 'El pedido entra al estado correcto y queda esperando el primer seguimiento.',
                        when: 'Ahora',
                        tone: 'blue',
                    },
                    {
                        title: 'Se cancela antes de enviar',
                        detail: 'Si el pedido cambia a completado o revisión antes del primer recordatorio, no se manda ningún mensaje.',
                        when: `Antes de ${formatDelayLabel(item.firstDelayMinutes)}`,
                        tone: 'emerald',
                    },
                ]
            case 'reply_after_first':
                return [
                    {
                        title: 'Primer seguimiento',
                        detail: firstMessage,
                        when: `Después de ${formatDelayLabel(item.firstDelayMinutes)}`,
                        tone: 'blue',
                    },
                    {
                        title: 'El cliente responde',
                        detail: 'La secuencia se detiene sola y no envía el segundo mensaje.',
                        when: 'Después del primer mensaje',
                        tone: 'emerald',
                    },
                ]
            case 'payment_after_first':
                return [
                    {
                        title: 'Primer seguimiento',
                        detail: firstMessage,
                        when: `Después de ${formatDelayLabel(item.firstDelayMinutes)}`,
                        tone: 'blue',
                    },
                    {
                        title: 'La conversación avanza',
                        detail: 'Si el pedido cambia a completado o revisión después del primer seguimiento, el segundo ya no sale.',
                        when: `Antes de ${formatDelayLabel(item.secondDelayMinutes)} más`,
                        tone: 'emerald',
                    },
                ]
            default:
                return [
                    {
                        title: 'Primer seguimiento',
                        detail: firstMessage,
                        when: `Después de ${formatDelayLabel(item.firstDelayMinutes)}`,
                        tone: 'blue',
                    },
                    {
                        title: 'Segundo seguimiento',
                        detail: secondMessage,
                        when: `${formatDelayLabel(item.secondDelayMinutes)} más tarde`,
                        tone: 'violet',
                    },
                    {
                        title: 'La secuencia termina',
                        detail: 'Si no hubo respuesta ni cambio de estado, ya no insiste más.',
                        when: 'Después del segundo mensaje',
                        tone: 'slate',
                    },
                ]
        }
    }, [draft, firstMessage, item.firstDelayMinutes, item.secondDelayMinutes, secondMessage])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-5xl rounded-lg border border-black/[0.08] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-black/[0.06] px-5 py-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Simulación previa</p>
                        <h3 className="text-lg font-semibold text-[#0F172A] mt-1">{item.title}</h3>
                        <p className="text-sm text-slate-500 mt-1">Prueba un caso de ejemplo y mira qué pasaría antes de activar o editar.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-2 text-slate-400 transition-colors hover:bg-[#F7F8FA] hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="max-h-[78vh] overflow-y-auto px-5 py-5">
                    <div className="grid gap-5 lg:grid-cols-[1.1fr_1.4fr]">
                        <div className="space-y-4">
                            <Card className="border-black/[0.08]">
                                <CardContent className="p-4">
                                    <p className="text-sm font-semibold text-[#0F172A]">Caso de ejemplo</p>
                                    <p className="text-xs text-slate-500 mt-1">Cambia estos datos y la simulación se actualiza al instante.</p>

                                    <div className="mt-4 grid gap-3">
                                        <div>
                                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plan</Label>
                                            <Input value={draft.planName} onChange={(event) => setDraft((current) => ({ ...current, planName: event.target.value }))} className="mt-1" />
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Monto</Label>
                                                <Input type="number" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: Number.parseFloat(event.target.value || '0') || 0 }))} className="mt-1" />
                                            </div>
                                            <div>
                                                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Moneda</Label>
                                                <Input value={draft.currencySymbol} onChange={(event) => setDraft((current) => ({ ...current, currencySymbol: event.target.value }))} className="mt-1" />
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Servicio</Label>
                                            <Input value={draft.serviceName} onChange={(event) => setDraft((current) => ({ ...current, serviceName: event.target.value }))} className="mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Medios de pago</Label>
                                            <Input value={draft.paymentMethods} onChange={(event) => setDraft((current) => ({ ...current, paymentMethods: event.target.value }))} className="mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Correo del cliente</Label>
                                            <Input value={draft.customerEmail || ''} onChange={(event) => setDraft((current) => ({ ...current, customerEmail: event.target.value }))} className="mt-1" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-black/[0.08]">
                                <CardContent className="p-4">
                                    <p className="text-sm font-semibold text-[#0F172A]">Qué pasaría</p>
                                    <p className="text-xs text-slate-500 mt-1">Elige una situación realista para probar la secuencia.</p>

                                    <div className="mt-4 space-y-2">
                                        {SIMULATION_SCENARIOS.map((scenario) => (
                                            <button
                                                key={scenario.id}
                                                type="button"
                                                onClick={() => setDraft((current) => ({ ...current, scenario: scenario.id }))}
                                                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                                                    draft.scenario === scenario.id
                                                        ? 'border-[#25D366]/35 bg-[#25D366]/8'
                                                        : 'border-black/[0.06] bg-white hover:bg-[#F7F8FA]'
                                                }`}
                                            >
                                                <p className="text-sm font-medium text-[#0F172A]">{scenario.title}</p>
                                                <p className="text-[12px] text-slate-500 mt-1">{scenario.description}</p>
                                            </button>
                                        ))}
                                    </div>

                                    {focusTitles.length > 0 && (
                                        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">CTA según el foco activo</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {focusTitles.map((goal) => (
                                                    <span key={goal} className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-700">
                                                        {goal}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-black/[0.08]">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <PlayCircle size={16} className="text-[#128C7E]" />
                                    <p className="text-sm font-semibold text-[#0F172A]">Vista paso a paso</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Así se vería la automatización con el ejemplo que acabas de cargar.</p>

                                <div className="mt-4 space-y-3">
                                    {timeline.map((step, index) => (
                                        <div key={`${step.title}-${index}`} className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-4 py-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-[#0F172A]">{step.title}</p>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">{step.when}</p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                    step.tone === 'emerald'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : step.tone === 'violet'
                                                            ? 'bg-violet-50 text-violet-700'
                                                            : step.tone === 'blue'
                                                                ? 'bg-blue-50 text-blue-600'
                                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    Paso {index + 1}
                                                </span>
                                            </div>

                                            <div className="mt-3 whitespace-pre-line rounded-lg border border-white bg-white px-3 py-3 text-sm text-slate-600">
                                                {step.detail}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Reglas que siempre se respetan</p>
                                    <ul className="mt-2 space-y-1 text-[12px] text-amber-800">
                                        <li>Se cancela si el cliente responde al chat.</li>
                                        <li>Se cancela si la orden pasa a completada o revisión.</li>
                                        <li>Se cancela si un humano toma el control del chat.</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-black/[0.06] px-5 py-4">
                    <Button type="button" onClick={onClose} className="bg-[#F7F8FA] text-slate-600 hover:bg-[#EEF1F4]">
                        Cerrar simulación
                    </Button>
                </div>
            </div>
        </div>
    )
}

function EditorModal({
    item,
    onClose,
    onSaved,
}: {
    item: SequenceAutomationListItem
    onClose: () => void
    onSaved: (nextItem: SequenceAutomationListItem) => void
}) {
    const [draft, setDraft] = useState<SequenceEditorState>(() => buildEditorState(item))
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const preset = AUTOMATION_SEQUENCE_PRESETS[item.key]

    const handleRestore = () => {
        const defaults = preset.defaults
        setDraft({
            key: item.key,
            enabled: defaults.enabled,
            firstDelayMinutes: String(defaults.firstDelayMinutes),
            secondDelayMinutes: String(defaults.secondDelayMinutes),
            firstMessage: defaults.firstMessage,
            secondMessage: defaults.secondMessage,
        })
        setError(null)
    }

    const handleSave = () => {
        const firstDelayMinutes = clampDelayValue(draft.firstDelayMinutes, item.firstDelayMinutes)
        const secondDelayMinutes = clampDelayValue(draft.secondDelayMinutes, item.secondDelayMinutes)
        const firstMessage = draft.firstMessage.trim()
        const secondMessage = draft.secondMessage.trim()

        if (!firstMessage || !secondMessage) {
            setError('Los dos mensajes deben tener contenido para que la secuencia funcione bien.')
            return
        }

        setError(null)
        startTransition(async () => {
            try {
                await saveSequenceAutomationConfig({
                    key: draft.key,
                    enabled: draft.enabled,
                    firstDelayMinutes,
                    secondDelayMinutes,
                    firstMessage,
                    secondMessage,
                })

                onSaved({
                    ...item,
                    enabled: draft.enabled,
                    firstDelayMinutes,
                    secondDelayMinutes,
                    firstMessage,
                    secondMessage,
                })
                onClose()
            } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la secuencia.')
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-3xl rounded-lg border border-black/[0.08] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-black/[0.06] px-5 py-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Editar seguimiento</p>
                        <h3 className="text-lg font-semibold text-[#0F172A] mt-1">{item.title}</h3>
                        <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-2 text-slate-400 transition-colors hover:bg-[#F7F8FA] hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="max-h-[78vh] overflow-y-auto px-5 py-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="border-black/[0.08]">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-[#0F172A]">
                                    <Clock3 size={16} className="text-[#ca8a04]" />
                                    <p className="text-sm font-semibold">Cuándo se manda</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">El cliente no ve estos tiempos. Solo decides cuánto esperar antes de recordar.</p>

                                <div className="mt-4 space-y-3">
                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Primer seguimiento</label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={10080}
                                            value={draft.firstDelayMinutes}
                                            onChange={(event) => setDraft((current) => ({ ...current, firstDelayMinutes: event.target.value }))}
                                            className="mt-1"
                                        />
                                        <p className="text-[11px] text-slate-400 mt-1">Se enviara despues de {formatDelayLabel(clampDelayValue(draft.firstDelayMinutes, item.firstDelayMinutes))}.</p>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Segundo seguimiento</label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={10080}
                                            value={draft.secondDelayMinutes}
                                            onChange={(event) => setDraft((current) => ({ ...current, secondDelayMinutes: event.target.value }))}
                                            className="mt-1"
                                        />
                                        <p className="text-[11px] text-slate-400 mt-1">Se enviara despues de {formatDelayLabel(clampDelayValue(draft.secondDelayMinutes, item.secondDelayMinutes))}.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-black/[0.08]">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-[#0F172A]">
                                    <Sparkles size={16} className="text-[#128C7E]" />
                                    <p className="text-sm font-semibold">Ayuda rápida</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">{item.helperText}</p>

                                <div className="mt-4 rounded-lg border border-[#25D366]/15 bg-[#25D366]/5 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Variables útiles</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {VARIABLE_HINTS.map((variable) => (
                                            <span
                                                key={variable}
                                                className="rounded-full border border-[#25D366]/20 bg-white px-2 py-1 text-[11px] font-medium text-[#128C7E]"
                                            >
                                                {variable}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-3">
                                        Puedes dejarlas tal cual para que el sistema complete plan, monto, correo y CTA automaticamente.
                                    </p>
                                </div>

                                <div className="mt-4 flex items-center justify-between rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                    <div>
                                        <p className="text-sm font-medium text-[#0F172A]">Secuencia activa</p>
                                        <p className="text-[11px] text-slate-500">Si la apagas, no se crearán nuevos seguimientos de este tipo.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${draft.enabled ? 'bg-[#eab308]' : 'bg-slate-200'}`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${draft.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                                        />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <Card className="border-black/[0.08]">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-[#0F172A]">
                                    <MessageSquareQuote size={16} className="text-blue-500" />
                                    <p className="text-sm font-semibold">Primer mensaje</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Es el recordatorio inicial. Conviene que sea corto y directo.</p>
                                <Textarea
                                    value={draft.firstMessage}
                                    onChange={(event) => setDraft((current) => ({ ...current, firstMessage: event.target.value }))}
                                    className="mt-3 min-h-[180px]"
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-black/[0.08]">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-[#0F172A]">
                                    <BellRing size={16} className="text-violet-500" />
                                    <p className="text-sm font-semibold">Segundo mensaje</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Es el ultimo empujón antes de dejar de insistir.</p>
                                <Textarea
                                    value={draft.secondMessage}
                                    onChange={(event) => setDraft((current) => ({ ...current, secondMessage: event.target.value }))}
                                    className="mt-3 min-h-[180px]"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-4">
                    <Button
                        type="button"
                        onClick={handleRestore}
                        className="bg-[#F7F8FA] text-slate-600 hover:bg-[#EEF1F4]"
                    >
                        <RefreshCw size={14} className="mr-2" />
                        Restaurar recomendado
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={onClose}
                            className="bg-[#F7F8FA] text-slate-600 hover:bg-[#EEF1F4]"
                        >
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleSave}>
                            {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                            Guardar secuencia
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CustomPackModal({
    pack,
    items,
    fallbackKeys,
    onClose,
    onSaved,
}: {
    pack: AutomationSequenceCustomPackDefinition | null
    items: SequenceAutomationListItem[]
    fallbackKeys: AutomationSequenceKey[]
    onClose: () => void
    onSaved: () => void
}) {
    const [draft, setDraft] = useState<CustomPackEditorState>(() => buildCustomPackEditorState(pack, fallbackKeys))
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const selectedCount = draft.sequenceKeys.length

    const toggleSequence = (key: AutomationSequenceKey) => {
        setDraft((current) => ({
            ...current,
            sequenceKeys: current.sequenceKeys.includes(key)
                ? current.sequenceKeys.filter((entry) => entry !== key)
                : [...current.sequenceKeys, key],
        }))
    }

    const handleUseCurrent = () => {
        setDraft((current) => ({
            ...current,
            sequenceKeys: fallbackKeys,
        }))
        setError(null)
    }

    const handleSave = () => {
        if (draft.title.trim().length < 3) {
            setError('Ponle un nombre corto y claro al pack para reconocerlo rapido.')
            return
        }

        if (draft.sequenceKeys.length === 0) {
            setError('Elige al menos una secuencia antes de guardar el pack.')
            return
        }

        setError(null)
        startTransition(async () => {
            try {
                await saveCustomSequenceAutomationPack({
                    key: draft.key,
                    title: draft.title,
                    sequenceKeys: draft.sequenceKeys,
                })
                onSaved()
                onClose()
            } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el pack propio.')
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-3xl rounded-lg border border-black/[0.08] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-black/[0.06] px-5 py-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Pack propio</p>
                        <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
                            {pack ? 'Edita tu pack' : 'Crea un pack facil de reutilizar'}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Guarda una combinacion de secuencias para activarla en un clic cada vez que la necesites.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-2 text-slate-400 transition-colors hover:bg-[#F7F8FA] hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="max-h-[78vh] overflow-y-auto px-5 py-5">
                    <Card className="border-black/[0.08]">
                        <CardContent className="p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="flex-1">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nombre del pack</Label>
                                    <Input
                                        value={draft.title}
                                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                                        placeholder="Ej: Mi pack de cierre"
                                        className="mt-1"
                                    />
                                    <p className="mt-2 text-[12px] text-slate-500">
                                        Usa un nombre que el cliente entienda rapido, por ejemplo cierre, soporte o renovaciones.
                                    </p>
                                </div>

                                <div className="rounded-lg border border-[#25D366]/20 bg-[#25D366]/8 px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Listo para guardar</p>
                                    <p className="mt-1 text-sm text-[#0F172A]">
                                        {selectedCount} secuencia{selectedCount === 1 ? '' : 's'} seleccionada{selectedCount === 1 ? '' : 's'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={handleUseCurrent}
                                    className="bg-[#F7F8FA] text-slate-700 hover:bg-[#EEF1F4]"
                                >
                                    Usar las activas ahora
                                </Button>
                                <p className="text-[12px] text-slate-500">
                                    Si ya dejaste encendido lo que te gusta, lo copiamos aqui con un clic.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-[#0F172A]">Que incluye este pack</p>
                                <p className="text-xs text-slate-500 mt-1">Marca solo las secuencias que quieres encender juntas.</p>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => {
                                const selected = draft.sequenceKeys.includes(item.key)

                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => toggleSequence(item.key)}
                                        className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                                            selected
                                                ? 'border-[#25D366]/35 bg-[#25D366]/8'
                                                : 'border-black/[0.08] bg-white hover:bg-[#F7F8FA]'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-[#0F172A]">{item.shortTitle}</p>
                                                <p className="mt-1 text-[12px] text-slate-500">{item.description}</p>
                                            </div>
                                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                selected
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {selected ? 'Incluida' : 'Opcional'}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-4">
                    <p className="text-[12px] text-slate-500">
                        Guardar un pack no cambia mensajes ni tiempos. Solo te deja reutilizar la combinacion.
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={onClose}
                            className="bg-[#F7F8FA] text-slate-600 hover:bg-[#EEF1F4]"
                        >
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleSave}>
                            {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                            {pack ? 'Guardar cambios' : 'Guardar pack'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function SequenceAutomationsPanel() {
    const [items, setItems] = useState<SequenceAutomationListItem[]>([])
    const [customPacks, setCustomPacks] = useState<AutomationSequenceCustomPackDefinition[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingKey, setEditingKey] = useState<AutomationSequenceKey | null>(null)
    const [simulatingKey, setSimulatingKey] = useState<AutomationSequenceKey | null>(null)
    const [savingKey, setSavingKey] = useState<AutomationSequenceKey | null>(null)
    const [editingCustomPackKey, setEditingCustomPackKey] = useState<string | null>(null)
    const [customPackFallbackKeys, setCustomPackFallbackKeys] = useState<AutomationSequenceKey[]>([])
    const [installingPackKey, setInstallingPackKey] = useState<string | null>(null)
    const [deletingPackKey, setDeletingPackKey] = useState<string | null>(null)
    const [expandedKey, setExpandedKey] = useState<AutomationSequenceKey | null>(null)

    const editingItem = useMemo(
        () => items.find((item) => item.key === editingKey) ?? null,
        [editingKey, items],
    )
    const simulatingItem = useMemo(
        () => items.find((item) => item.key === simulatingKey) ?? null,
        [items, simulatingKey],
    )
    const editingCustomPack = useMemo(
        () => customPacks.find((pack) => pack.key === editingCustomPackKey) ?? null,
        [customPacks, editingCustomPackKey],
    )
    const activeGoals = useMemo(
        () => items[0]?.simulationDefaults.goals || [],
        [items],
    )
    const packCards = Object.values(AUTOMATION_SEQUENCE_PACKS)
    const enabledKeys = items.filter((item) => item.enabled).map((item) => item.key)
    const recommendations = useMemo(
        () => buildAutomationRecommendations({ items, customPacks, activeGoals }),
        [activeGoals, customPacks, items],
    )

    const loadSequenceConfigs = useCallback(async () => {
        const panelData = await getSequenceAutomationPanelData()
        setItems(panelData.items)
        setCustomPacks(panelData.customPacks)
        setError(null)
    }, [])

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const panelData = await getSequenceAutomationPanelData()
                if (!cancelled) {
                    setItems(panelData.items)
                    setCustomPacks(panelData.customPacks)
                    setError(null)
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el panel de secuencias.')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        void load()
        return () => { cancelled = true }
    }, [])

    const handleToggle = async (item: SequenceAutomationListItem) => {
        const nextItem = {
            ...item,
            enabled: !item.enabled,
            activeRuns: item.enabled ? 0 : item.activeRuns,
        }
        setItems((current) => current.map((entry) => entry.key === item.key ? nextItem : entry))
        setSavingKey(item.key)

        try {
            await saveSequenceAutomationConfig({
                key: item.key,
                enabled: nextItem.enabled,
                firstDelayMinutes: item.firstDelayMinutes,
                secondDelayMinutes: item.secondDelayMinutes,
                firstMessage: item.firstMessage,
                secondMessage: item.secondMessage,
            })
        } catch (toggleError) {
            setItems((current) => current.map((entry) => entry.key === item.key ? item : entry))
            setError(toggleError instanceof Error ? toggleError.message : 'No se pudo actualizar la secuencia.')
        } finally {
            setSavingKey(null)
        }
    }

    const handleInstallPack = async (packKey: AutomationSequencePackKey) => {
        setInstallingPackKey(packKey)
        try {
            await installSequenceAutomationPack(packKey)
            await loadSequenceConfigs()
        } catch (installError) {
            setError(installError instanceof Error ? installError.message : 'No se pudo instalar el pack.')
        } finally {
            setInstallingPackKey(null)
        }
    }

    const handleInstallCustomPack = async (packKey: string) => {
        setInstallingPackKey(packKey)
        try {
            await installCustomSequenceAutomationPack(packKey)
            await loadSequenceConfigs()
        } catch (installError) {
            setError(installError instanceof Error ? installError.message : 'No se pudo instalar el pack propio.')
        } finally {
            setInstallingPackKey(null)
        }
    }

    const handleDeleteCustomPack = async (packKey: string) => {
        setDeletingPackKey(packKey)
        try {
            await deleteCustomSequenceAutomationPack(packKey)
            await loadSequenceConfigs()
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'No se pudo borrar el pack propio.')
        } finally {
            setDeletingPackKey(null)
        }
    }

    const handleOpenCustomPackModal = (fallbackKeys: AutomationSequenceKey[] = enabledKeys) => {
        setCustomPackFallbackKeys(fallbackKeys)
        setEditingCustomPackKey('__new__')
    }

    const handleRecommendationClick = async (recommendation: AutomationRecommendation) => {
        if (recommendation.packKey) {
            await handleInstallPack(recommendation.packKey)
            return
        }

        if (recommendation.customPackKeys) {
            handleOpenCustomPackModal(recommendation.customPackKeys)
            return
        }

        if (recommendation.sequenceKey) {
            const item = items.find((entry) => entry.key === recommendation.sequenceKey)
            if (!item) return

            if (item.enabled) {
                setSimulatingKey(item.key)
                return
            }

            await handleToggle(item)
        }
    }

    return (
        <div className="mb-6">
            {editingItem && (
                <EditorModal
                    item={editingItem}
                    onClose={() => setEditingKey(null)}
                    onSaved={(nextItem) => {
                        setItems((current) => current.map((entry) => entry.key === nextItem.key ? nextItem : entry))
                        setError(null)
                    }}
                />
            )}
            {simulatingItem && (
                <SimulationModal
                    item={simulatingItem}
                    onClose={() => setSimulatingKey(null)}
                />
            )}
            {editingCustomPackKey !== null && (
                <CustomPackModal
                    pack={editingCustomPack}
                    items={items}
                    fallbackKeys={customPackFallbackKeys.length > 0 ? customPackFallbackKeys : enabledKeys}
                    onClose={() => setEditingCustomPackKey(null)}
                    onSaved={() => {
                        void loadSequenceConfigs()
                    }}
                />
            )}

            <div className="rounded-lg border border-[#25D366]/15 bg-[#25D366]/5 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Seguimientos automáticos</p>
                        <h2 className="text-xl font-semibold text-[#0F172A] mt-1">Activa recordatorios listos, sin perderte en configuraciones</h2>
                        <p className="text-sm text-slate-500 mt-2 max-w-3xl">
                            Estas secuencias ya entienden cuándo deben esperar, volver a escribir y detenerse si el cliente responde, paga o pasa a revisión.
                        </p>
                    </div>

                    <div className="rounded-lg border border-[#25D366]/20 bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Cómo funciona</p>
                        <p className="text-xs text-slate-500 mt-1">Primero activas. Luego, si quieres, ajustas tiempos y copy con lenguaje simple.</p>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={22} className="animate-spin text-slate-300" />
                    </div>
                ) : (
                    <>
                        <div className="mt-5 rounded-lg border border-black/[0.06] bg-white p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recomendaciones inteligentes</p>
                                    <h3 className="mt-1 text-base font-semibold text-[#0F172A]">Siguiente mejor accion</h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Priorizamos segun tu foco activo, actividad reciente y resultados de los ultimos 30 dias.
                                    </p>
                                </div>
                                <span className="rounded-full border border-[#25D366]/20 bg-[#25D366]/10 px-3 py-1 text-[11px] font-semibold text-[#128C7E]">
                                    {recommendations.length} sugerencia{recommendations.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                {recommendations.map((recommendation) => (
                                    <Card key={recommendation.id} className="border-black/[0.08]">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                        recommendation.tone === 'emerald'
                                                            ? 'bg-emerald-50 text-emerald-600'
                                                            : recommendation.tone === 'amber'
                                                                ? 'bg-amber-50 text-amber-600'
                                                                : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                        {recommendation.reason}
                                                    </span>
                                                    <h4 className="mt-3 text-base font-semibold text-[#0F172A]">{recommendation.title}</h4>
                                                </div>
                                                <Sparkles size={18} className={
                                                    recommendation.tone === 'emerald'
                                                        ? 'text-emerald-500'
                                                        : recommendation.tone === 'amber'
                                                            ? 'text-amber-500'
                                                            : 'text-blue-500'
                                                } />
                                            </div>

                                            <p className="mt-3 min-h-[72px] text-sm text-slate-500">{recommendation.detail}</p>

                                            <Button
                                                type="button"
                                                onClick={() => void handleRecommendationClick(recommendation)}
                                                disabled={Boolean(recommendation.packKey && installingPackKey === recommendation.packKey)}
                                                className="mt-4 w-full"
                                            >
                                                {recommendation.packKey && installingPackKey === recommendation.packKey
                                                    ? <Loader2 size={14} className="mr-2 animate-spin" />
                                                    : null
                                                }
                                                {recommendation.ctaLabel}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        <div className="mt-5 rounded-lg border border-black/[0.06] bg-white p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Packs listos</p>
                                    <h3 className="text-base font-semibold text-[#0F172A] mt-1">Instala una estrategia completa en un clic</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Cada pack solo activa o pausa secuencias. Tus mensajes personalizados se mantienen.
                                    </p>
                                </div>
                                {activeGoals.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {getBusinessGoalTitles(activeGoals).map((goal) => (
                                            <span key={goal} className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">
                                                {goal}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                {packCards.map((pack) => {
                                    const enabledInPack = pack.sequenceKeys.filter((key) => enabledKeys.includes(key)).length
                                    const isInstalled =
                                        pack.sequenceKeys.every((key) => enabledKeys.includes(key))
                                        && items.filter((item) => !pack.sequenceKeys.includes(item.key)).every((item) => !item.enabled)
                                    const isRecommended = pack.recommendedGoals?.some((goal) => activeGoals.includes(goal)) ?? false

                                    return (
                                        <Card key={pack.key} className="border-black/[0.08]">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {isRecommended && (
                                                                <span className="rounded-full border border-[#25D366]/20 bg-[#25D366]/10 px-2 py-1 text-[10px] font-semibold text-[#128C7E]">
                                                                    Recomendado
                                                                </span>
                                                            )}
                                                            {isInstalled && (
                                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                                                                    Activo ahora
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-base font-semibold text-[#0F172A] mt-2">{pack.title}</h4>
                                                    </div>
                                                    <span className="rounded-full border border-black/[0.08] bg-[#F7F8FA] px-2 py-1 text-[11px] font-medium text-slate-500">
                                                        {pack.sequenceKeys.length} sec.
                                                    </span>
                                                </div>

                                                <p className="text-sm text-slate-500 mt-3">{pack.description}</p>
                                                <p className="text-[12px] text-slate-400 mt-2">{pack.helperText}</p>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {pack.sequenceKeys.map((key) => (
                                                        <span key={key} className="rounded-full border border-black/[0.08] bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                                                            {AUTOMATION_SEQUENCE_PRESETS[key].shortTitle}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="mt-4 flex items-center justify-between gap-3">
                                                    <p className="text-[11px] text-slate-400">
                                                        {enabledInPack} de {pack.sequenceKeys.length} secuencias activas en este pack
                                                    </p>
                                                    <Button
                                                        type="button"
                                                        onClick={() => void handleInstallPack(pack.key)}
                                                        disabled={installingPackKey === pack.key}
                                                        className={isInstalled ? 'bg-[#F7F8FA] text-slate-700 hover:bg-[#EEF1F4]' : ''}
                                                    >
                                                        {installingPackKey === pack.key ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                                                        {isInstalled ? 'Reinstalar pack' : 'Instalar pack'}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="mt-5 rounded-lg border border-black/[0.06] bg-white p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tus packs</p>
                                    <h3 className="mt-1 text-base font-semibold text-[#0F172A]">Guarda tus combinaciones favoritas</h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Crea un pack propio para activar varias secuencias juntas sin volver a armarlas desde cero.
                                    </p>
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => handleOpenCustomPackModal()}
                                    className="bg-[#F7F8FA] text-slate-700 hover:bg-[#EEF1F4]"
                                >
                                    <Plus size={14} className="mr-2" />
                                    Crear pack propio
                                </Button>
                            </div>

                            {customPacks.length === 0 ? (
                                <div className="mt-4 rounded-lg border border-dashed border-black/[0.08] px-4 py-5">
                                    <p className="text-sm font-medium text-[#0F172A]">Todavia no tienes packs propios.</p>
                                    <p className="mt-1 text-[12px] text-slate-500">
                                        Puedes guardar las secuencias activas que mas te funcionen y luego reutilizarlas en un clic.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                    {customPacks.map((pack) => {
                                        const enabledInPack = pack.sequenceKeys.filter((key) => enabledKeys.includes(key)).length
                                        const isInstalled =
                                            pack.sequenceKeys.every((key) => enabledKeys.includes(key))
                                            && items.filter((item) => !pack.sequenceKeys.includes(item.key)).every((item) => !item.enabled)

                                        return (
                                            <Card key={pack.key} className="border-black/[0.08]">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">
                                                                    Pack propio
                                                                </span>
                                                                {isInstalled && (
                                                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                                                                        Activo ahora
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 className="mt-2 text-base font-semibold text-[#0F172A]">{pack.title}</h4>
                                                        </div>
                                                        <span className="rounded-full border border-black/[0.08] bg-[#F7F8FA] px-2 py-1 text-[11px] font-medium text-slate-500">
                                                            {pack.sequenceKeys.length} sec.
                                                        </span>
                                                    </div>

                                                    <p className="mt-3 text-sm text-slate-500">
                                                        Activa {pack.sequenceKeys.length} secuencia{pack.sequenceKeys.length === 1 ? '' : 's'} en el orden que ya configuraste.
                                                    </p>

                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {pack.sequenceKeys.map((key) => (
                                                            <span key={key} className="rounded-full border border-black/[0.08] bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                                                                {AUTOMATION_SEQUENCE_PRESETS[key].shortTitle}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    <div className="mt-4 rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Listo para usar</p>
                                                        <p className="mt-1 text-sm text-[#0F172A]">
                                                            {enabledInPack} de {pack.sequenceKeys.length} secuencia{pack.sequenceKeys.length === 1 ? '' : 's'} ya estan activas en este pack.
                                                        </p>
                                                        <p className="mt-2 text-[11px] text-slate-400">
                                                            Actualizado {new Date(pack.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            onClick={() => void handleInstallCustomPack(pack.key)}
                                                            disabled={installingPackKey === pack.key}
                                                            className={isInstalled ? 'bg-[#F7F8FA] text-slate-700 hover:bg-[#EEF1F4]' : ''}
                                                        >
                                                            {installingPackKey === pack.key ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                                                            {isInstalled ? 'Reaplicar pack' : 'Usar pack'}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            onClick={() => setEditingCustomPackKey(pack.key)}
                                                            className="bg-[#F7F8FA] text-slate-700 hover:bg-[#EEF1F4]"
                                                        >
                                                            <Pencil size={14} className="mr-2" />
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            onClick={() => void handleDeleteCustomPack(pack.key)}
                                                            disabled={deletingPackKey === pack.key}
                                                            className="bg-white text-rose-600 hover:bg-rose-50"
                                                        >
                                                            {deletingPackKey === pack.key ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Trash2 size={14} className="mr-2" />}
                                                            Borrar
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-3">
                            {items.map((item) => (
                                <Card key={item.key} className="border-black/[0.08]">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.triggerLabel}</p>
                                            <h3 className="text-base font-semibold text-[#0F172A] mt-1">{item.title}</h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleToggle(item)}
                                            disabled={savingKey === item.key}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${item.enabled ? 'bg-[#eab308]' : 'bg-slate-200'}`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${item.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </div>

                                    <p className="text-sm text-slate-500 mt-3 min-h-[60px]">{item.description}</p>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                                            1er envio: {formatDelayLabel(item.firstDelayMinutes)}
                                        </span>
                                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">
                                            2do envio: {formatDelayLabel(item.secondDelayMinutes)}
                                        </span>
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                            {item.activeRuns} chat{item.activeRuns === 1 ? '' : 's'} en espera
                                        </span>
                                    </div>

                                    <div className="mt-4 rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lo que busca</p>
                                        <p className="text-sm text-[#0F172A] mt-1">{item.outcomeLabel}</p>
                                        <div className="mt-3 flex items-start gap-2 text-[12px] text-slate-500">
                                            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                                            <span>Se cancela sola si el cliente responde, si el pedido cambia de estado o si entra a revisión.</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-lg border border-black/[0.06] bg-white px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 size={14} className="text-[#128C7E]" />
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Últimos 30 días</p>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <div className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                                <p className="text-[10px] text-slate-400">Se activaron</p>
                                                <p className="text-lg font-semibold text-[#0F172A]">{item.metrics.startedLast30Days}</p>
                                            </div>
                                            <div className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                                <p className="text-[10px] text-slate-400">Mensajes enviados</p>
                                                <p className="text-lg font-semibold text-[#0F172A]">{item.metrics.sentLast30Days}</p>
                                            </div>
                                            <div className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                                <p className="text-[10px] text-slate-400">Respondieron</p>
                                                <p className="text-lg font-semibold text-emerald-600">{item.metrics.repliedLast30Days}</p>
                                            </div>
                                            <div className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                                <p className="text-[10px] text-slate-400">Conversaciones que avanzaron</p>
                                                <p className="text-lg font-semibold text-[#128C7E]">{item.metrics.advancedLast30Days}</p>
                                            </div>
                                            <div className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                                <p className="text-[10px] text-slate-400">Completadas sin respuesta</p>
                                                <p className="text-lg font-semibold text-slate-600">{item.metrics.completedLast30Days}</p>
                                            </div>
                                            <div className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                                <p className="text-[10px] text-slate-400">Tasa de reactivacion</p>
                                                <p className="text-lg font-semibold text-blue-600">{item.metrics.reactivationRate}%</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
                                            <p className="text-[11px] text-slate-500">
                                                Canceladas por respuesta: <span className="font-semibold text-emerald-600">{item.metrics.cancelledByReplyLast30Days}</span>
                                                {' '}- por conversion/avance: <span className="font-semibold text-[#128C7E]">{item.metrics.cancelledByConversionLast30Days}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedKey((current) => current === item.key ? null : item.key)}
                                            className="flex w-full items-center justify-between rounded-lg border border-black/[0.06] bg-[#F7F8FA] px-3 py-2 text-left"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-[#0F172A]">Actividad reciente</p>
                                                <p className="text-[11px] text-slate-500">Lo último que pasó con esta secuencia.</p>
                                            </div>
                                            {expandedKey === item.key
                                                ? <ChevronUp size={16} className="text-slate-400" />
                                                : <ChevronDown size={16} className="text-slate-400" />
                                            }
                                        </button>

                                        {expandedKey === item.key && (
                                            <div className="mt-3 space-y-2">
                                                {item.recentActivity.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-black/[0.08] px-3 py-4 text-sm text-slate-400">
                                                        Aun no hubo actividad reciente para esta secuencia.
                                                    </div>
                                                ) : item.recentActivity.map((activity) => (
                                                    <div key={activity.id} className="rounded-lg border border-black/[0.06] bg-white px-3 py-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-medium text-[#0F172A]">{activity.summary}</p>
                                                                <p className="text-[12px] text-slate-500 mt-1">{activity.detail}</p>
                                                            </div>
                                                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                                activity.tone === 'emerald'
                                                                    ? 'bg-emerald-50 text-emerald-600'
                                                                    : activity.tone === 'blue'
                                                                        ? 'bg-blue-50 text-blue-600'
                                                                        : activity.tone === 'amber'
                                                                            ? 'bg-amber-50 text-amber-600'
                                                                            : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                {activity.statusLabel}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 mt-2">
                                                            {new Date(activity.timestamp).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 flex items-center gap-2">
                                        <Button
                                            type="button"
                                            onClick={() => setSimulatingKey(item.key)}
                                            className="bg-white text-[#128C7E] hover:bg-[#F1FCF5]"
                                        >
                                            <PlayCircle size={14} className="mr-2" />
                                            Simular
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => setEditingKey(item.key)}
                                            className="bg-[#F7F8FA] text-slate-700 hover:bg-[#EEF1F4]"
                                        >
                                            <Pencil size={14} className="mr-2" />
                                            Editar
                                        </Button>
                                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${item.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {savingKey === item.key ? 'Guardando...' : item.enabled ? 'Activa' : 'Pausada'}
                                        </span>
                                    </div>
                                </CardContent>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
