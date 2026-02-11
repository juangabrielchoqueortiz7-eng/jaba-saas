'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Save, ArrowLeft, Trash2, Tag, Bell, MessageSquare, ToggleLeft, Filter, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { saveTrigger, getTrigger } from './actions'

// Types
type ActionType = 'update_status' | 'add_tag' | 'notify_admin' | 'send_message' | 'toggle_bot'
type ConditionType = 'last_message' | 'message_count' | 'contains_words' | 'has_tag' | 'template_sent' | 'schedule'

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

interface TriggerBuilderProps {
    assistantId: string
    triggerId?: string
}

export default function TriggerBuilder({ assistantId, triggerId }: TriggerBuilderProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(!!triggerId)
    const [activeTab, setActiveTab] = useState<'conditions' | 'actions'>('conditions') // New Tab Logic

    // Form State
    const [name, setName] = useState('')
    const [type, setType] = useState<'logic' | 'time' | 'flow'>('logic')
    const [description, setDescription] = useState('')
    const [actions, setActions] = useState<TriggerAction[]>([])
    const [conditions, setConditions] = useState<TriggerCondition[]>([]) // New Condition State

    // Load Data
    useEffect(() => {
        if (triggerId) {
            getTrigger(triggerId).then(data => {
                if (data) {
                    setName(data.name)
                    setType(data.type)
                    setDescription(data.description || '')
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

        startTransition(async () => {
            try {
                await saveTrigger(assistantId, {
                    id: triggerId,
                    name,
                    type,
                    description,
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

    // --- Action Helpers ---
    const addAction = (type: ActionType) => {
        const newAction: TriggerAction = { type, payload: getDefaultActionPayload(type) }
        setActions([...actions, newAction])
    }
    const removeAction = (index: number) => setActions(actions.filter((_, i) => i !== index))
    const updateActionPayload = (index: number, key: string, value: any) => {
        const newActions = [...actions]
        newActions[index].payload = { ...newActions[index].payload, [key]: value }
        setActions(newActions)
    }

    // --- Condition Helpers ---
    const addCondition = (type: ConditionType) => {
        const newCondition: TriggerCondition = { type, operator: 'equals', value: '' }
        setConditions([...conditions, newCondition])
    }
    const removeCondition = (index: number) => setConditions(conditions.filter((_, i) => i !== index))
    const updateCondition = (index: number, key: keyof TriggerCondition, value: any) => {
        const newConditions = [...conditions]
        // @ts-ignore
        newConditions[index][key] = value
        setConditions(newConditions)
    }

    const getDefaultActionPayload = (type: ActionType) => {
        switch (type) {
            case 'update_status': return { status: 'lead' }
            case 'add_tag': return { tag: '' }
            case 'notify_admin': return { title: 'Notificación', message: '' }
            case 'send_message': return { message: '' }
            case 'toggle_bot': return { active: false }
            default: return {}
        }
    }

    if (isLoading) return <div className="p-8 text-white">Cargando disparador...</div>

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-200">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button className="h-9 w-9 p-0 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
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
                {/* LEFT: Configuración General (3 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">Disparador</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej: Confirmación pago"
                                    className="bg-slate-950 border-slate-800 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={type} onValueChange={(v: any) => setType(v as any)}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="logic">🧠 Lógica IA</SelectItem>
                                        <SelectItem value="time">⏰ Tiempo</SelectItem>
                                        <SelectItem value="flow">Flujo Manual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {type === 'logic' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label className="flex items-center gap-2">
                                        Descripción Lógica
                                        <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                            IA
                                        </span>
                                    </Label>
                                    <Textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Describe cuándo activar. Ej: 'Cliente envía comprobante'"
                                        className="bg-slate-950 border-slate-800 text-white h-32 resize-none"
                                    />
                                </div>
                            )}

                            {type === 'time' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label>Minutos de espera</Label>
                                    <Input
                                        type="number"
                                        placeholder="30"
                                        className="bg-slate-950 border-slate-800 text-white"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT: Tabs (9 cols) */}
                <div className="lg:col-span-8">
                    {/* Custom Tabs Header */}
                    <div className="flex border-b border-slate-800 mb-6">
                        <button
                            onClick={() => setActiveTab('conditions')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'conditions'
                                ? 'border-red-500 text-red-500'
                                : 'border-transparent text-slate-400 hover:text-white'
                                }`}
                        >
                            Condiciones ({conditions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'actions'
                                ? 'border-green-500 text-green-500'
                                : 'border-transparent text-slate-400 hover:text-white'
                                }`}
                        >
                            Acciones ({actions.length})
                        </button>
                    </div>

                    {/* CONTENT: CONDITIONS */}
                    {activeTab === 'conditions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-lg border border-slate-800">
                                <h3 className="text-white font-medium">Reglas de filtro</h3>
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
                                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                                    <Filter className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                                    <p className="text-slate-500">No hay condiciones definidas.</p>
                                    <p className="text-xs text-slate-600">El disparador se ejecutará siempre si la lógica coincide.</p>
                                </div>
                            ) : (
                                conditions.map((cond, index) => (
                                    <Card key={index} className="bg-slate-900 border-slate-800 relative">
                                        <button
                                            onClick={() => removeCondition(index)}
                                            className="absolute top-2 right-2 text-slate-500 hover:text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <CardContent className="p-4 pt-8 grid grid-cols-1 md:grid-cols-3 gap-4">

                                            {/* Type Read-only label */}
                                            <div className="flex items-center text-sm font-medium text-red-400">
                                                {cond.type === 'has_tag' && 'Etiqueta Actual'}
                                                {cond.type === 'contains_words' && 'Mensaje Contiene'}
                                                {cond.type === 'last_message' && 'Último Mensaje Enviado'}
                                                {cond.type === 'message_count' && 'Conteo de Mensajes'}
                                            </div>

                                            {/* Operator */}
                                            <Select
                                                value={cond.operator}
                                                onValueChange={(v) => updateCondition(index, 'operator', v)}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-950 border-slate-800 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="equals">Es igual a</SelectItem>
                                                    <SelectItem value="contains">Contiene</SelectItem>
                                                    <SelectItem value="not_equals">No es igual</SelectItem>
                                                    <SelectItem value="greater_than">Mayor que</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {/* Value */}
                                            <Input
                                                className="h-9 bg-slate-950 border-slate-800"
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

                    {/* CONTENT: ACTIONS */}
                    {activeTab === 'actions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-lg border border-slate-800">
                                <h3 className="text-white font-medium">Secuencia de ejecución</h3>
                                <Select onValueChange={(v) => addAction(v as ActionType)}>
                                    <SelectTrigger className="w-[200px] bg-green-600 border-green-500 text-white h-9">
                                        <SelectValue placeholder="Agregar acción" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="update_status">🔄 Cambiar Estado</SelectItem>
                                        <SelectItem value="add_tag">🏷️ Agregar Etiqueta</SelectItem>
                                        <SelectItem value="send_message">💬 Enviar Mensaje</SelectItem>
                                        <SelectItem value="notify_admin">🔔 Notificar Admin</SelectItem>
                                        <SelectItem value="toggle_bot">🤖 Apagar/Encender Bot</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {actions.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                                    <AlertCircle className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                                    <p className="text-slate-500">No hay acciones configuradas.</p>
                                </div>
                            ) : (
                                actions.map((action, index) => (
                                    <div key={index} className="bg-slate-900 border border-slate-800 rounded-lg p-4 relative">
                                        <div className="absolute top-2 right-2">
                                            <Button className="h-6 w-6 p-0 bg-transparent hover:bg-slate-800 text-slate-500 hover:text-red-400" onClick={() => removeAction(index)}>
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
                                                {action.type === 'send_message' && 'Enviar Mensaje (Plantilla)'}
                                            </span>
                                        </div>

                                        {/* Dynamic Fields */}
                                        {action.type === 'update_status' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Label className="text-xs">Nuevo Estado</Label>
                                                <Select
                                                    value={action.payload.status}
                                                    onValueChange={(v) => updateActionPayload(index, 'status', v)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-800">
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

                                        {action.type === 'add_tag' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Etiqueta</Label>
                                                <Input
                                                    className="h-8 text-xs bg-slate-950 border-slate-800"
                                                    placeholder="Ej: PAGO_RECIBIDO"
                                                    value={action.payload.tag}
                                                    onChange={(e) => updateActionPayload(index, 'tag', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {action.type === 'send_message' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Mensaje</Label>
                                                <Input
                                                    className="h-8 text-xs bg-slate-950 border-slate-800"
                                                    placeholder="Escribe el mensaje..."
                                                    value={action.payload.message}
                                                    onChange={(e) => updateActionPayload(index, 'message', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {action.type === 'notify_admin' && (
                                            <div className="space-y-2">
                                                <Input
                                                    className="h-8 text-xs bg-slate-900 border-slate-800"
                                                    placeholder="Título"
                                                    value={action.payload.title}
                                                    onChange={(e) => updateActionPayload(index, 'title', e.target.value)}
                                                />
                                                <Textarea
                                                    className="h-16 text-xs bg-slate-900 border-slate-800 resize-none"
                                                    placeholder="Mensaje..."
                                                    value={action.payload.message}
                                                    onChange={(e) => updateActionPayload(index, 'message', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {action.type === 'toggle_bot' && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    className={`h-8 px-3 text-xs ${action.payload.active ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}
                                                    onClick={() => updateActionPayload(index, 'active', true)}
                                                >
                                                    ENCENDER
                                                </Button>
                                                <Button
                                                    className={`h-8 px-3 text-xs ${!action.payload.active ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}
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
