'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Save, ArrowLeft, Trash2, Tag, Bell, MessageSquare, ToggleLeft, Filter, AlertCircle, Calendar, Send, Users, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { saveTrigger, getTrigger } from './actions'
import { getFlows, type ConversationFlow } from '../flows/actions'

// ── Types ──────────────────────────────────────────────────────────────────────
type ActionType = 'update_status' | 'add_tag' | 'notify_admin' | 'send_message' | 'toggle_bot' | 'send_meta_template'
type ConditionType = 'last_message' | 'message_count' | 'contains_words' | 'has_tag' | 'template_sent' | 'schedule'
type TriggerType = 'logic' | 'time' | 'flow' | 'scheduled'

type TriggerAction = {
    id?: string
    type: ActionType
    payload: any
}

type TriggerCondition = {
    id?: string
    type: ConditionType
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'not_equals'
    value: string
}

interface ScheduleConfig {
    send_days: 'expiration' | '1_day_before' | '3_days_before' | '7_days_before' | 'daily'
    audience_type: 'service' | 'tag' | 'all'
    audience_value: string
}

interface MetaTemplate {
    id: string
    name: string
    status: string
    language: string
    components: Array<{ type: string; text?: string; format?: string }>
}

interface TriggerBuilderProps {
    assistantId: string
    triggerId?: string
}

const SEND_DAYS_LABELS: Record<string, string> = {
    expiration: 'El día de vencimiento',
    '1_day_before': '1 día antes de vencer',
    '3_days_before': '3 días antes de vencer',
    '7_days_before': '7 días antes de vencer',
    daily: 'Todos los días (sin filtro de fecha)',
}

const AUDIENCE_TYPE_LABELS: Record<string, string> = {
    service: 'Por servicio (Canva / ChatGPT / Gemini)',
    tag: 'Por etiqueta del chat',
    all: 'Todas las suscripciones activas',
}

function detectTemplateVars(components: MetaTemplate['components']): number {
    const body = components.find(c => c.type === 'BODY')
    if (!body?.text) return 0
    const matches = body.text.match(/\{\{(\d+)\}\}/g)
    return matches ? new Set(matches).size : 0
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TriggerBuilder({ assistantId, triggerId }: TriggerBuilderProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(!!triggerId)
    const [activeTab, setActiveTab] = useState<'conditions' | 'actions'>('conditions')

    // Form state
    const [name, setName] = useState('')
    const [type, setType] = useState<TriggerType>('logic')
    const [description, setDescription] = useState('')
    const [timeMinutes, setTimeMinutes] = useState('30')
    const [flows, setFlows] = useState<ConversationFlow[]>([])
    const [selectedFlowId, setSelectedFlowId] = useState('')
    const [actions, setActions] = useState<TriggerAction[]>([])
    const [conditions, setConditions] = useState<TriggerCondition[]>([])

    // Scheduled config
    const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
        send_days: 'expiration',
        audience_type: 'service',
        audience_value: 'CANVA',
    })

    // Meta templates
    const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])

    // Load flows and Meta templates
    useEffect(() => {
        getFlows().then(setFlows)
        fetch('/api/meta-templates')
            .then(r => r.json())
            .then(d => {
                if (d.templates) {
                    setMetaTemplates(d.templates.filter((t: MetaTemplate) => t.status === 'APPROVED'))
                }
            })
            .catch(() => {})
    }, [])

    // Load existing trigger data
    useEffect(() => {
        if (triggerId) {
            getTrigger(triggerId).then(data => {
                if (data) {
                    setName(data.name)
                    setType(data.type as TriggerType)
                    if (data.type === 'time') {
                        setTimeMinutes(data.description || '30')
                    } else if (data.type === 'flow') {
                        setSelectedFlowId(data.description || '')
                    } else if (data.type === 'scheduled') {
                        try {
                            const cfg = JSON.parse(data.description || '{}') as ScheduleConfig
                            setScheduleConfig(cfg)
                        } catch {}
                    } else {
                        setDescription(data.description || '')
                    }
                    setActions(data.trigger_actions || [])
                    setConditions(data.trigger_conditions || [])
                }
                setIsLoading(false)
            })
        }
    }, [triggerId])

    const handleSave = () => {
        if (!name) return alert('El nombre es obligatorio')
        if (type === 'logic' && !description) return alert('La descripción lógica es obligatoria')
        if (type === 'time' && (!timeMinutes || parseInt(timeMinutes) < 1)) return alert('Ingresa los minutos de espera')
        if (type === 'flow' && !selectedFlowId) return alert('Selecciona un flujo')
        if (type === 'scheduled' && scheduleConfig.audience_type !== 'all' && !scheduleConfig.audience_value) {
            return alert('Define el valor del filtro de audiencia')
        }

        const descriptionToSave =
            type === 'time' ? timeMinutes :
            type === 'flow' ? selectedFlowId :
            type === 'scheduled' ? JSON.stringify(scheduleConfig) :
            description

        startTransition(async () => {
            try {
                await saveTrigger(assistantId, {
                    id: triggerId,
                    name,
                    type,
                    description: descriptionToSave,
                    actions,
                    conditions
                })
                router.push(`/dashboard/assistants/${assistantId}/triggers`)
            } catch (error) {
                console.error(error)
                alert('Error al guardar')
            }
        })
    }

    // ── Action helpers ─────────────────────────────────────────────────────────
    const addAction = (actionType: ActionType) => {
        setActions([...actions, { type: actionType, payload: getDefaultPayload(actionType) }])
    }
    const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i))
    const updateActionPayload = (i: number, key: string, value: any) => {
        const next = [...actions]
        next[i].payload = { ...next[i].payload, [key]: value }
        setActions(next)
    }

    // ── Condition helpers ──────────────────────────────────────────────────────
    const addCondition = (condType: ConditionType) => {
        setConditions([...conditions, { type: condType, operator: 'equals', value: '' }])
    }
    const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i))
    const updateCondition = (i: number, key: keyof TriggerCondition, value: any) => {
        const next = [...conditions]
        // @ts-ignore
        next[i][key] = value
        setConditions(next)
    }

    const getDefaultPayload = (actionType: ActionType) => {
        switch (actionType) {
            case 'update_status': return { status: 'lead' }
            case 'add_tag': return { tag: '' }
            case 'notify_admin': return { title: 'Notificación', message: '' }
            case 'send_message': return { message: '' }
            case 'toggle_bot': return { active: false }
            case 'send_meta_template': return { templateName: '', language: 'es', variables: [] }
            default: return {}
        }
    }

    const getTemplateVarCount = (templateName: string): number => {
        const tpl = metaTemplates.find(t => t.name === templateName)
        if (!tpl) return 0
        return detectTemplateVars(tpl.components)
    }

    if (isLoading) return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
            <div className="h-8 w-48 bg-black/[0.06] rounded-md" />
            <div className="space-y-4">
                <div className="h-12 bg-black/[0.06] rounded-lg" />
                <div className="h-32 bg-black/[0.06] rounded-lg" />
                <div className="h-12 bg-black/[0.06] rounded-lg" />
            </div>
        </div>
    )

    return (
        <div className="p-8 max-w-7xl mx-auto text-[#0F172A]">
            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        className="h-9 w-9 p-0 bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-[#0F172A] mb-1">
                            {triggerId ? 'Editar Disparador' : 'Nuevo Disparador'}
                        </h1>
                        <p className="text-slate-400">Automatización avanzada</p>
                    </div>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className="bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                    <Save size={18} />
                    {isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ── LEFT: Config ── */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-white border-black/[0.08]">
                        <CardHeader>
                            <CardTitle className="text-[#0F172A] text-lg">Disparador</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Name */}
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej: Recordatorio Canva"
                                    className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                                />
                            </div>

                            {/* Type */}
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={type} onValueChange={(v) => setType(v as TriggerType)}>
                                    <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="logic">🧠 Lógica IA</SelectItem>
                                        <SelectItem value="time">⏰ Tiempo (sin respuesta)</SelectItem>
                                        <SelectItem value="flow">🔄 Flujo Manual</SelectItem>
                                        <SelectItem value="scheduled">📅 Programado (suscripciones)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Logic */}
                            {type === 'logic' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label className="flex items-center gap-2">
                                        Descripción Lógica
                                        <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">IA</span>
                                    </Label>
                                    <Textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Describe cuándo activar. Ej: 'Cliente envía comprobante'"
                                        className="bg-[#F7F8FA] border-black/[0.08] text-white h-32 resize-none"
                                    />
                                </div>
                            )}

                            {/* Flow */}
                            {type === 'flow' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label>Flujo a ejecutar</Label>
                                    <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
                                        <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                                            <SelectValue placeholder="Selecciona un flujo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {flows.length === 0 && (
                                                <SelectItem value="_none">No hay flujos creados</SelectItem>
                                            )}
                                            {flows.map(f => (
                                                <SelectItem key={f.id} value={f.id}>
                                                    {f.is_active ? '● ' : '○ '}{f.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500">El flujo se iniciará cuando este disparador se active.</p>
                                </div>
                            )}

                            {/* Time */}
                            {type === 'time' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label>Minutos sin respuesta</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={10080}
                                        value={timeMinutes}
                                        onChange={e => setTimeMinutes(e.target.value)}
                                        placeholder="30"
                                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Se activa si el cliente no responde en {timeMinutes || '?'} min.
                                        {parseInt(timeMinutes) >= 60 && ` (${Math.round(parseInt(timeMinutes) / 60 * 10) / 10}h)`}
                                    </p>
                                </div>
                            )}

                            {/* Scheduled */}
                            {type === 'scheduled' && (
                                <div className="space-y-4 animate-in fade-in">
                                    {/* Info banner */}
                                    <div className="flex gap-2 p-3 rounded-lg bg-indigo-900/20 border border-indigo-800/40 text-xs text-indigo-300">
                                        <Calendar size={14} className="shrink-0 mt-0.5" />
                                        <span>Este disparador se ejecuta automáticamente una vez al día. Activa la acción <strong>Enviar Plantilla Meta</strong> en el panel de acciones.</span>
                                    </div>

                                    {/* Audiencia */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-1.5"><Users size={13} /> Audiencia</Label>
                                        <Select
                                            value={scheduleConfig.audience_type}
                                            onValueChange={v => setScheduleConfig(prev => ({
                                                ...prev,
                                                audience_type: v as ScheduleConfig['audience_type'],
                                                audience_value: v === 'service' ? 'CANVA' : ''
                                            }))}
                                        >
                                            <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="service">Por servicio</SelectItem>
                                                <SelectItem value="tag">Por etiqueta</SelectItem>
                                                <SelectItem value="all">Todas las activas</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Audience value */}
                                    {scheduleConfig.audience_type === 'service' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-400">Servicio</Label>
                                            <Select
                                                value={scheduleConfig.audience_value}
                                                onValueChange={v => setScheduleConfig(prev => ({ ...prev, audience_value: v }))}
                                            >
                                                <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CANVA">Canva</SelectItem>
                                                    <SelectItem value="CHATGPT">ChatGPT</SelectItem>
                                                    <SelectItem value="GEMINI">Gemini</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {scheduleConfig.audience_type === 'tag' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-400">Etiqueta del chat</Label>
                                            <Input
                                                className="bg-[#F7F8FA] border-black/[0.08] text-sm"
                                                placeholder="Ej: VIP, CLIENTE_ACTIVO"
                                                value={scheduleConfig.audience_value}
                                                onChange={e => setScheduleConfig(prev => ({ ...prev, audience_value: e.target.value }))}
                                            />
                                        </div>
                                    )}

                                    {/* Cuándo enviar */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-1.5"><Clock size={13} /> Cuándo enviar</Label>
                                        <Select
                                            value={scheduleConfig.send_days}
                                            onValueChange={v => setScheduleConfig(prev => ({ ...prev, send_days: v as ScheduleConfig['send_days'] }))}
                                        >
                                            <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="expiration">El día de vencimiento</SelectItem>
                                                <SelectItem value="1_day_before">1 día antes de vencer</SelectItem>
                                                <SelectItem value="3_days_before">3 días antes de vencer</SelectItem>
                                                <SelectItem value="7_days_before">7 días antes de vencer</SelectItem>
                                                <SelectItem value="daily">Todos los días</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            {SEND_DAYS_LABELS[scheduleConfig.send_days]}
                                        </p>
                                    </div>

                                    {/* Summary */}
                                    <div className="p-3 rounded-lg bg-[#F7F8FA] text-xs text-slate-400 space-y-1">
                                        <p className="font-semibold text-[#0F172A]">Resumen del envío:</p>
                                        <p>
                                            {scheduleConfig.audience_type === 'service' && `Suscriptores de ${scheduleConfig.audience_value}`}
                                            {scheduleConfig.audience_type === 'tag' && `Chats con etiqueta "${scheduleConfig.audience_value}"`}
                                            {scheduleConfig.audience_type === 'all' && 'Todos los suscriptores activos'}
                                            {' · '}
                                            {SEND_DAYS_LABELS[scheduleConfig.send_days]}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── RIGHT: Tabs ── */}
                <div className="lg:col-span-8">
                    <div className="flex border-b border-black/[0.08] mb-6">
                        <button
                            onClick={() => setActiveTab('conditions')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'conditions'
                                ? 'border-red-500 text-red-500'
                                : 'border-transparent text-slate-400 hover:text-[#0F172A]'}`}
                        >
                            Condiciones ({conditions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'actions'
                                ? 'border-green-500 text-green-500'
                                : 'border-transparent text-slate-400 hover:text-[#0F172A]'}`}
                        >
                            Acciones ({actions.length})
                        </button>
                    </div>

                    {/* ── CONDITIONS ── */}
                    {activeTab === 'conditions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-black/[0.08]">
                                <h3 className="text-[#0F172A] font-medium">Reglas de filtro</h3>
                                <Select onValueChange={(v) => addCondition(v as ConditionType)}>
                                    <SelectTrigger className="w-[200px] bg-red-600 border-red-500 text-white h-9">
                                        <SelectValue placeholder="Agregar condición" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="has_tag">🏷️ Tiene Etiqueta</SelectItem>
                                        <SelectItem value="contains_words">💬 Contiene Palabras</SelectItem>
                                        <SelectItem value="last_message">📩 Último mensaje</SelectItem>
                                        <SelectItem value="message_count">🔢 Cantidad mensajes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {conditions.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-black/[0.08] rounded-xl">
                                    <Filter className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                                    <p className="text-slate-500">No hay condiciones definidas.</p>
                                    <p className="text-xs text-slate-600">El disparador se ejecutará siempre si la lógica coincide.</p>
                                </div>
                            ) : (
                                conditions.map((cond, index) => (
                                    <Card key={index} className="bg-white border-black/[0.08] relative">
                                        <button
                                            onClick={() => removeCondition(index)}
                                            className="absolute top-2 right-2 text-slate-500 hover:text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <CardContent className="p-4 pt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="flex items-center text-sm font-medium text-red-400">
                                                {cond.type === 'has_tag' && 'Etiqueta Actual'}
                                                {cond.type === 'contains_words' && 'Mensaje Contiene'}
                                                {cond.type === 'last_message' && 'Último Mensaje Enviado'}
                                                {cond.type === 'message_count' && 'Conteo de Mensajes'}
                                            </div>
                                            <Select
                                                value={cond.operator}
                                                onValueChange={(v) => updateCondition(index, 'operator', v)}
                                            >
                                                <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="equals">Es igual a</SelectItem>
                                                    <SelectItem value="contains">Contiene</SelectItem>
                                                    <SelectItem value="not_equals">No es igual</SelectItem>
                                                    <SelectItem value="greater_than">Mayor que</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                className="h-9 bg-[#F7F8FA] border-black/[0.08]"
                                                placeholder="Valor..."
                                                value={cond.value}
                                                onChange={(e) => updateCondition(index, 'value', e.target.value)}
                                            />
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}

                    {/* ── ACTIONS ── */}
                    {activeTab === 'actions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-black/[0.08]">
                                <h3 className="text-[#0F172A] font-medium">Secuencia de ejecución</h3>
                                <Select onValueChange={(v) => addAction(v as ActionType)}>
                                    <SelectTrigger className="w-[220px] bg-green-600 border-green-500 text-white h-9">
                                        <SelectValue placeholder="Agregar acción" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="send_meta_template">📋 Enviar Plantilla Meta</SelectItem>
                                        <SelectItem value="send_message">💬 Enviar Mensaje</SelectItem>
                                        <SelectItem value="add_tag">🏷️ Agregar Etiqueta</SelectItem>
                                        <SelectItem value="update_status">🔄 Cambiar Estado</SelectItem>
                                        <SelectItem value="notify_admin">🔔 Notificar Admin</SelectItem>
                                        <SelectItem value="toggle_bot">🤖 Apagar/Encender Bot</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {actions.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-black/[0.08] rounded-xl">
                                    <AlertCircle className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                                    <p className="text-slate-500">No hay acciones configuradas.</p>
                                    <p className="text-xs text-slate-600">Agrega al menos una acción para que el disparador haga algo.</p>
                                </div>
                            ) : (
                                actions.map((action, index) => (
                                    <div key={index} className="bg-white border border-black/[0.08] rounded-lg p-4 relative">
                                        <div className="absolute top-2 right-2">
                                            <Button
                                                className="h-6 w-6 p-0 bg-transparent hover:bg-[#F7F8FA] text-slate-500 hover:text-red-400"
                                                onClick={() => removeAction(index)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3 text-green-400 font-medium text-sm">
                                            <span className="bg-green-500/10 px-2 py-1 rounded text-xs uppercase tracking-wide">
                                                Paso {index + 1}
                                            </span>
                                            <span>
                                                {action.type === 'update_status' && 'Cambiar Estado'}
                                                {action.type === 'add_tag' && 'Agregar Etiqueta'}
                                                {action.type === 'notify_admin' && 'Notificar Admin'}
                                                {action.type === 'toggle_bot' && 'Controlar Bot'}
                                                {action.type === 'send_message' && 'Enviar Mensaje'}
                                                {action.type === 'send_meta_template' && 'Enviar Plantilla Meta'}
                                            </span>
                                        </div>

                                        {/* ── send_meta_template ── */}
                                        {action.type === 'send_meta_template' && (
                                            <div className="space-y-3">
                                                {metaTemplates.length === 0 ? (
                                                    <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
                                                        No se encontraron plantillas aprobadas en Meta. Asegúrate de tener el WABA ID configurado en Ajustes y al menos una plantilla con estado APPROVED.
                                                    </p>
                                                ) : (
                                                    <>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-400">Plantilla Meta (solo aprobadas)</Label>
                                                            <Select
                                                                value={action.payload.templateName || ''}
                                                                onValueChange={v => {
                                                                    const tpl = metaTemplates.find(t => t.name === v)
                                                                    const varCount = tpl ? detectTemplateVars(tpl.components) : 0
                                                                    updateActionPayload(index, 'templateName', v)
                                                                    updateActionPayload(index, 'language', tpl?.language || 'es')
                                                                    // Reset variables array to correct size
                                                                    const next = [...actions]
                                                                    next[index].payload = {
                                                                        ...next[index].payload,
                                                                        templateName: v,
                                                                        language: tpl?.language || 'es',
                                                                        variables: Array(varCount).fill('')
                                                                    }
                                                                    setActions(next)
                                                                }}
                                                            >
                                                                <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm">
                                                                    <SelectValue placeholder="Selecciona una plantilla..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {metaTemplates.map(tpl => (
                                                                        <SelectItem key={tpl.id} value={tpl.name}>
                                                                            <span className="font-mono text-xs">{tpl.name}</span>
                                                                            <span className="text-slate-500 text-xs ml-2">{tpl.language}</span>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Preview body */}
                                                        {action.payload.templateName && (() => {
                                                            const tpl = metaTemplates.find(t => t.name === action.payload.templateName)
                                                            const body = tpl?.components.find(c => c.type === 'BODY')
                                                            if (!body?.text) return null
                                                            return (
                                                                <div className="p-3 rounded-lg bg-[#F7F8FA] text-xs text-slate-400 font-mono whitespace-pre-wrap">
                                                                    {body.text}
                                                                </div>
                                                            )
                                                        })()}

                                                        {/* Variable inputs */}
                                                        {action.payload.templateName && getTemplateVarCount(action.payload.templateName) > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                                    Variables de la plantilla
                                                                </p>
                                                                <p className="text-[11px] text-slate-500">
                                                                    Usa: <code className="bg-[#F7F8FA] px-1 rounded">{'{numero}'}</code>{' '}
                                                                    <code className="bg-[#F7F8FA] px-1 rounded">{'{nombre}'}</code>{' '}
                                                                    <code className="bg-[#F7F8FA] px-1 rounded">{'{vencimiento}'}</code>{' '}
                                                                    <code className="bg-[#F7F8FA] px-1 rounded">{'{correo}'}</code>{' '}
                                                                    <code className="bg-[#F7F8FA] px-1 rounded">{'{servicio}'}</code>
                                                                </p>
                                                                {Array.from({ length: getTemplateVarCount(action.payload.templateName) }).map((_, vi) => (
                                                                    <div key={vi} className="flex items-center gap-2">
                                                                        <span className="text-xs text-indigo-400 font-mono w-10 shrink-0">
                                                                            {`{{${vi + 1}}}`}
                                                                        </span>
                                                                        <Input
                                                                            className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
                                                                            placeholder={`Valor para {{${vi + 1}}} — ej: {nombre}`}
                                                                            value={(action.payload.variables || [])[vi] || ''}
                                                                            onChange={e => {
                                                                                const vars = [...(action.payload.variables || [])]
                                                                                vars[vi] = e.target.value
                                                                                updateActionPayload(index, 'variables', vars)
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* ── send_message ── */}
                                        {action.type === 'send_message' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Mensaje</Label>
                                                <Input
                                                    className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
                                                    placeholder="Escribe el mensaje... usa {nombre}, {telefono}"
                                                    value={action.payload.message}
                                                    onChange={(e) => updateActionPayload(index, 'message', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {/* ── add_tag ── */}
                                        {action.type === 'add_tag' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Etiqueta</Label>
                                                <Input
                                                    className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
                                                    placeholder="Ej: PAGO_RECIBIDO"
                                                    value={action.payload.tag}
                                                    onChange={(e) => updateActionPayload(index, 'tag', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {/* ── update_status ── */}
                                        {action.type === 'update_status' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Label className="text-xs self-center">Nuevo Estado</Label>
                                                <Select
                                                    value={action.payload.status}
                                                    onValueChange={(v) => updateActionPayload(index, 'status', v)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="lead">Lead</SelectItem>
                                                        <SelectItem value="closed">Venta Cerrada</SelectItem>
                                                        <SelectItem value="support">Soporte</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {/* ── notify_admin ── */}
                                        {action.type === 'notify_admin' && (
                                            <div className="space-y-2">
                                                <Input
                                                    className="h-8 text-xs bg-white border-black/[0.08]"
                                                    placeholder="Título"
                                                    value={action.payload.title}
                                                    onChange={(e) => updateActionPayload(index, 'title', e.target.value)}
                                                />
                                                <Textarea
                                                    className="h-16 text-xs bg-white border-black/[0.08] resize-none"
                                                    placeholder="Mensaje..."
                                                    value={action.payload.message}
                                                    onChange={(e) => updateActionPayload(index, 'message', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {/* ── toggle_bot ── */}
                                        {action.type === 'toggle_bot' && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    className={`h-8 px-3 text-xs ${action.payload.active ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
                                                    onClick={() => updateActionPayload(index, 'active', true)}
                                                >
                                                    ENCENDER
                                                </Button>
                                                <Button
                                                    className={`h-8 px-3 text-xs ${!action.payload.active ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
                                                    onClick={() => updateActionPayload(index, 'active', false)}
                                                >
                                                    APAGAR
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
