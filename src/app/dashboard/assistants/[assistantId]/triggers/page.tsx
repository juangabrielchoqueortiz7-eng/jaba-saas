'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
    Search, Plus, Trash2, Edit, Zap, Clock, Workflow, Calendar, Play,
    CheckCircle, AlertCircle, Loader2, HelpCircle, ChevronDown, ChevronUp,
    History, X, RefreshCw, Copy,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getTriggers, toggleTrigger, deleteTrigger, duplicateTrigger } from './actions'
import type { TriggerListItem } from './actions'
import SequenceAutomationsPanel from './SequenceAutomationsPanel'
import AutomationSetupGuide from '@/components/dashboard/AutomationSetupGuide'

// ── Helpers ────────────────────────────────────────────────────────────────

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'logic': return <Zap className="text-yellow-400" size={16} />
        case 'time': return <Clock className="text-blue-400" size={16} />
        case 'scheduled': return <Calendar className="text-indigo-400" size={16} />
        default: return <Workflow className="text-purple-400" size={16} />
    }
}

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'logic': return 'Palabra clave'
        case 'time': return 'Por inactividad'
        case 'flow': return 'Inicia un flujo'
        case 'scheduled': return 'Programado'
        default: return type
    }
}

// ── Logs Modal ─────────────────────────────────────────────────────────────

interface Execution {
    id: string
    trigger_id: string
    chat_id: string | null
    status: 'success' | 'failed'
    conditions_met: boolean
    conditions_evaluated: number
    actions_executed: number
    actions_failed: number
    action_details: Array<{ type: string; success: boolean; error?: string }>
    errors: string[] | null
    created_at: string
    chat: { phone_number: string; contact_name: string } | null
}

interface LogsStats { total: number; successful: number; failed: number }
type TriggerRunResponse = { executed?: number; skipped?: number; error?: string }
type TriggerExecutionResponse = { executions?: Execution[]; stats?: LogsStats }

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

function LogsModal({ triggerId, triggerName, onClose }: { triggerId: string; triggerName: string; onClose: () => void }) {
    const [executions, setExecutions] = useState<Execution[]>([])
    const [stats, setStats] = useState<LogsStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string | null>(null)

    const load = useCallback(async (showSpinner = false) => {
        if (showSpinner) setLoading(true)
        try {
            const res = await fetch(`/api/trigger-executions?triggerId=${triggerId}&limit=30`)
            const data = await res.json() as TriggerExecutionResponse
            if (res.ok) {
                setExecutions(data.executions || [])
                setStats(data.stats || null)
            }
        } catch {}
        setLoading(false)
    }, [triggerId])

    useEffect(() => {
        let cancelled = false
        fetch(`/api/trigger-executions?triggerId=${triggerId}&limit=30`)
            .then(res => res.json() as Promise<TriggerExecutionResponse>)
            .then(data => {
                if (cancelled) return
                setExecutions(data.executions || [])
                setStats(data.stats || null)
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => { cancelled = true }
    }, [triggerId])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-black/[0.08]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.07]">
                    <div>
                        <h2 className="font-bold text-[#0F172A] text-base">Historial — ¿cuándo se activó?</h2>
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{triggerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => void load(true)}
                            className="p-2 rounded-lg hover:bg-[#F7F8FA] text-slate-400 hover:text-slate-600 transition-colors"
                            title="Actualizar"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-[#F7F8FA] text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Stats bar */}
                {stats && (
                    <div className="flex gap-4 px-6 py-3 bg-[#F7F8FA] border-b border-black/[0.06]">
                        <div className="text-center">
                            <p className="text-lg font-bold text-[#0F172A]">{stats.total}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                        </div>
                        <div className="w-px bg-black/[0.07]" />
                        <div className="text-center">
                            <p className="text-lg font-bold text-emerald-600">{stats.successful}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Exitosas</p>
                        </div>
                        <div className="w-px bg-black/[0.07]" />
                        <div className="text-center">
                            <p className="text-lg font-bold text-red-500">{stats.failed}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Fallidas</p>
                        </div>
                        {stats.total > 0 && (
                            <>
                                <div className="w-px bg-black/[0.07]" />
                                <div className="text-center">
                                    <p className="text-lg font-bold text-indigo-600">
                                        {Math.round((stats.successful / stats.total) * 100)}%
                                    </p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Éxito</p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-black/[0.05]">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-slate-300" />
                        </div>
                    ) : executions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <History size={32} className="text-slate-200" />
                            <p className="text-sm text-slate-400">Sin ejecuciones registradas todavía</p>
                            <p className="text-xs text-slate-300">El historial aparecerá aquí cuando la automatización se active</p>
                        </div>
                    ) : (
                        executions.map(exec => (
                            <div key={exec.id} className="px-6 py-3">
                                <button
                                    className="w-full text-left"
                                    onClick={() => setExpanded(expanded === exec.id ? null : exec.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Status dot */}
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${exec.status === 'success' ? 'bg-emerald-500' : 'bg-red-400'}`} />

                                        {/* Contact */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[#0F172A] truncate">
                                                {exec.chat?.contact_name || exec.chat?.phone_number || 'Sin contacto'}
                                            </p>
                                            {exec.chat?.contact_name && (
                                                <p className="text-[11px] text-slate-400">{exec.chat.phone_number}</p>
                                            )}
                                        </div>

                                        {/* Actions summary */}
                                        <div className="text-right flex-shrink-0">
                                            <div className="flex items-center gap-2 justify-end">
                                                {exec.status === 'success'
                                                    ? <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1"><CheckCircle size={10} /> OK</span>
                                                    : <span className="text-[10px] font-medium text-red-500 flex items-center gap-1"><AlertCircle size={10} /> Error</span>
                                                }
                                                <span className="text-[10px] text-slate-300">
                                                    {exec.actions_executed ?? 0}✓ {exec.actions_failed ?? 0}✗
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-300 mt-0.5">
                                                {new Date(exec.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                                            </p>
                                        </div>

                                        <ChevronDown
                                            size={13}
                                            className={`text-slate-300 flex-shrink-0 transition-transform ${expanded === exec.id ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </button>

                                {/* Expanded details */}
                                {expanded === exec.id && (
                                    <div className="mt-3 ml-5 space-y-2">
                                        {/* Action details */}
                                        {(exec.action_details || []).map((ad, i) => (
                                            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                                                ad.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                            }`}>
                                                {ad.success ? <CheckCircle size={11} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />}
                                                <div>
                                                    <span className="font-medium">{ad.type}</span>
                                                    {ad.error && <p className="text-[10px] opacity-70 mt-0.5">{ad.error}</p>}
                                                </div>
                                            </div>
                                        ))}
                                        {/* Errors */}
                                        {exec.errors?.map((e, i) => (
                                            <div key={i} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">
                                                {e}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TriggersPage() {
    const params = useParams()
    const assistantId = params?.assistantId as string

    const [triggers, setTriggers] = useState<TriggerListItem[]>([])
    const [search, setSearch] = useState('')
    const [showHelp, setShowHelp] = useState(false)
    const [, startTransition] = useTransition()
    const [runningId, setRunningId] = useState<string | null>(null)
    const [runResult, setRunResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)
    const [logsModal, setLogsModal] = useState<{ id: string; name: string } | null>(null)

    const loadTriggers = useCallback(async () => {
        const data = await getTriggers()
        setTriggers(data)
    }, [])

    useEffect(() => { void loadTriggers() }, [loadTriggers])

    const handleToggle = (id: string, currentState: boolean) => {
        setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentState } : t))
        startTransition(async () => {
            try {
                await toggleTrigger(id, currentState)
            } catch {
                setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: currentState } : t))
            }
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar esta automatización?')) return
        startTransition(async () => {
            await deleteTrigger(id)
            await loadTriggers()
        })
    }

    const handleDuplicate = async (id: string) => {
        startTransition(async () => {
            await duplicateTrigger(id)
            await loadTriggers()
        })
    }

    const handleRun = async (id: string) => {
        setRunningId(id)
        setRunResult(null)
        try {
            const res = await fetch('/api/run-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggerId: id }),
            })
            const data = await res.json() as TriggerRunResponse
            if (!res.ok) {
                setRunResult({ id, ok: false, msg: data.error || 'Error al ejecutar' })
            } else {
                setRunResult({ id, ok: true, msg: `${data.executed ?? 0} enviados, ${data.skipped ?? 0} omitidos` })
                await loadTriggers()
            }
        } catch (err: unknown) {
            setRunResult({ id, ok: false, msg: getErrorMessage(err, 'Error desconocido') })
        } finally {
            setRunningId(null)
            setTimeout(() => setRunResult(null), 5000)
        }
    }

    const filtered = triggers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-700">
            {/* Logs Modal */}
            {logsModal && (
                <LogsModal
                    triggerId={logsModal.id}
                    triggerName={logsModal.name}
                    onClose={() => setLogsModal(null)}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Disparadores</h1>
                    <p className="text-[rgba(15,23,42,0.45)]">Reglas que hacen que tu bot actúe solo, sin que tú hagas nada.</p>
                </div>
                <Link href={`/dashboard/assistants/${assistantId}/triggers/new`}>
                    <Button className="bg-[#eab308] hover:bg-[#ca8a04] text-white gap-2">
                        <Plus size={20} />
                        Nuevo Disparador
                    </Button>
                </Link>
            </div>

            <AutomationSetupGuide section="triggers" />

            <div id="seguimientos">
                <SequenceAutomationsPanel />
            </div>

            {/* Info Card */}
            <div className="mb-6 rounded-[14px] border border-[#eab308]/30 bg-[#fefce8] overflow-hidden">
                <button
                    onClick={() => setShowHelp(v => !v)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 bg-transparent border-none cursor-pointer text-left"
                >
                    <HelpCircle size={16} className="text-[#ca8a04] flex-shrink-0" />
                    <span className="flex-1 font-semibold text-sm text-[#0F172A]">¿Qué son las Disparadores? — Haz clic para aprender</span>
                    {showHelp ? <ChevronUp size={16} className="text-[#ca8a04]" /> : <ChevronDown size={16} className="text-[#ca8a04]" />}
                </button>
                {showHelp && (
                    <div className="px-5 pb-5 space-y-4">
                        <p className="text-sm text-[#0F172A]/65 leading-relaxed">
                            Una automatización es una <strong>regla de &quot;si pasa X, haz Y&quot;</strong> que funciona sola las 24 horas.
                            Ejemplo: si un cliente lleva 30 minutos sin responder → el bot le envía un recordatorio automáticamente.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { icon: <Zap size={16} className="text-yellow-500" />, title: 'Por palabra clave', desc: 'Se activa cuando el cliente escribe ciertas palabras. Ej: "precio", "ayuda".' },
                                { icon: <Clock size={16} className="text-blue-500" />, title: 'Por inactividad', desc: 'Se activa si el cliente no responde en X minutos.' },
                                { icon: <Calendar size={16} className="text-indigo-500" />, title: 'Programado', desc: 'Se activa en un día específico. Ej: día de vencimiento.' },
                                { icon: <Workflow size={16} className="text-purple-500" />, title: 'Inicia un flujo', desc: 'Inicia una conversación guiada paso a paso.' },
                            ].map((item, i) => (
                                <div key={i} className="bg-white border border-black/[0.07] rounded-xl p-3">
                                    <div className="mb-2">{item.icon}</div>
                                    <p className="font-bold text-xs text-[#0F172A] mb-1">{item.title}</p>
                                    <p className="text-[11px] text-[#0F172A]/50 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="bg-[#fef9c3] border border-[#eab308]/30 rounded-lg px-4 py-3 text-xs text-[#0F172A]/65">
                            <strong>📋 ¿Cómo crear una?</strong> Haz clic en &quot;Nuevo Disparador&quot;, elige una plantilla rápida o créala desde cero. Solo necesitas decirle: <em>¿cuándo se activa?</em> y <em>¿qué hace?</em> Luego actívala con el interruptor y listo.
                        </div>
                    </div>
                )}
            </div>

            {/* Quick templates banner */}
            {triggers.length === 0 && (
                <div className="rounded-[14px] border border-[#eab308]/20 bg-[#fefce8]/60 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-[#ca8a04]" />
                        <span className="font-semibold text-sm text-[#0F172A]">Plantillas listas para usar — empieza en 1 clic ✨</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { emoji: '💰', name: 'Consulta de precio', desc: 'Responde automáticamente cuando preguntan precios' },
                            { emoji: '⏰', name: 'Recordatorio inactividad', desc: 'Avisa si el cliente no responde en 30 min' },
                            { emoji: '📅', name: 'Aviso de vencimiento', desc: 'Notifica cuando una suscripción está por vencer' },
                            { emoji: '🏷️', name: 'Etiquetar interesados', desc: 'Etiqueta clientes que preguntan por servicios' },
                        ].map((t, i) => (
                            <Link key={i} href={`/dashboard/assistants/${assistantId}/triggers/new`}>
                                <div className="bg-white border border-black/[0.07] rounded-xl p-3 hover:border-[#eab308]/50 hover:shadow-sm transition-all cursor-pointer group h-full">
                                    <div className="text-xl mb-1.5">{t.emoji}</div>
                                    <p className="font-semibold text-xs text-[#0F172A] mb-1 group-hover:text-[#ca8a04] transition-colors">{t.name}</p>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">{t.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar automatizaciones..."
                    className="pl-10 bg-white border-black/[0.08] text-[#0F172A] w-full max-w-md"
                />
            </div>

            {/* Table */}
            <Card className="bg-white border-black/[0.08] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-500">
                        <thead className="bg-[#F7F8FA] text-[rgba(37,211,102,0.7)] uppercase font-semibold text-xs tracking-wider">
                            <tr>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">Nombre</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4 text-center">Pasos</th>
                                <th className="p-4 text-center">Activa</th>
                                <th className="p-4">Última vez</th>
                                <th className="p-4 text-right">Opciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.05]">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        No hay automatizaciones creadas. ¡Crea tu primera regla automática!
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((trigger, i) => (
                                    <tr key={trigger.id} className="hover:bg-[#F7F8FA]/60 transition-colors group">
                                        <td className="p-4 text-center">{i + 1}</td>
                                        <td className="p-4 font-medium text-[#0F172A]">{trigger.name}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 px-2 py-1 bg-[#F7F8FA] rounded-md w-fit">
                                                {getTypeIcon(trigger.type)}
                                                <span className="text-xs">{getTypeLabel(trigger.type)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="bg-[#F7F8FA] px-3 py-1 rounded text-xs">
                                                {trigger.action_count}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleToggle(trigger.id, trigger.is_active)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${trigger.is_active ? 'bg-[#eab308]' : 'bg-slate-200'}`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${trigger.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                                                />
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            {runResult?.id === trigger.id ? (
                                                <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit ${runResult?.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                    {runResult?.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                                                    {runResult?.msg}
                                                </span>
                                            ) : trigger.last_run_at ? (
                                                <span className="text-xs text-slate-400">
                                                    {new Date(trigger.last_run_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">Nunca</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Logs button — always visible */}
                                                <Button
                                                    className="h-8 w-8 p-0 bg-transparent hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 transition-colors"
                                                    onClick={() => setLogsModal({ id: trigger.id, name: trigger.name })}
                                                    title="Ver historial"
                                                >
                                                    <History size={15} />
                                                </Button>
                                                {/* Run button */}
                                                {(trigger.type === 'time' || trigger.type === 'scheduled') && (
                                                    <Button
                                                        className="h-8 w-8 p-0 bg-transparent hover:bg-emerald-50 text-slate-300 hover:text-emerald-500 transition-colors"
                                                        onClick={() => handleRun(trigger.id)}
                                                        disabled={runningId === trigger.id}
                                                        title="Ejecutar ahora"
                                                    >
                                                        {runningId === trigger.id
                                                            ? <Loader2 size={15} className="animate-spin" />
                                                            : <Play size={15} />
                                                        }
                                                    </Button>
                                                )}
                                                <Button
                                                    className="h-8 w-8 p-0 bg-transparent hover:bg-[#F7F8FA] text-slate-300 hover:text-slate-500 transition-colors"
                                                    onClick={() => handleDuplicate(trigger.id)}
                                                    title="Duplicar"
                                                >
                                                    <Copy size={15} />
                                                </Button>
                                                <Link href={`/dashboard/assistants/${assistantId}/triggers/${trigger.id}`}>
                                                    <Button className="h-8 w-8 p-0 bg-transparent hover:bg-[#F7F8FA] text-slate-300 hover:text-slate-600 transition-colors">
                                                        <Edit size={15} />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    className="h-8 w-8 p-0 bg-transparent hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                                                    onClick={() => handleDelete(trigger.id)}
                                                >
                                                    <Trash2 size={15} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
