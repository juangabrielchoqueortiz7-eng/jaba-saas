'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Trash2, Edit, FileText, Bell, BellOff, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Settings2, Save, Send } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getSubscriptionSettings, updateSubscriptionSettings, type Template } from './actions'
import MetaTemplateBuilder from './MetaTemplateBuilder'
import BroadcastModal from './BroadcastModal'

type MetaTemplate = {
    id: string
    name: string
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED'
    category: string
    language: string
    components: Array<{
        type: string
        text?: string
        format?: string
        buttons?: Array<{ type: string; text: string }>
    }>
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    APPROVED: { label: 'Aprobada', className: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 size={12} /> },
    PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
    REJECTED: { label: 'Rechazada', className: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
    PAUSED: { label: 'Pausada', className: 'bg-slate-100 text-slate-500 border-slate-200', icon: <AlertCircle size={12} /> },
    DISABLED: { label: 'Desactivada', className: 'bg-slate-100 text-slate-500 border-slate-200', icon: <XCircle size={12} /> },
}

const CATEGORY_LABELS: Record<string, string> = {
    MARKETING: 'Marketing',
    UTILITY: 'Utilidad',
    AUTHENTICATION: 'Autenticación',
}


export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [search, setSearch] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [newTemplate, setNewTemplate] = useState({ name: '', content: '' })
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTemplate, setEditTemplate] = useState({ name: '', content: '' })
    const [isPending, startTransition] = useTransition()
    const [settings, setSettings] = useState<any>(null)
    const [isSavingSettings, setIsSavingSettings] = useState(false)

    // Meta templates state
    const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
    const [metaLoading, setMetaLoading] = useState(false)
    const [metaError, setMetaError] = useState<string | null>(null)
    const [expandedMeta, setExpandedMeta] = useState<Set<string>>(new Set())
    const [metaSearch, setMetaSearch] = useState('')

    const [builderOpen, setBuilderOpen] = useState(false)
    const [broadcastOpen, setBroadcastOpen] = useState(false)

    // Template config per service
    type ServiceKey = 'CANVA' | 'CHATGPT' | 'GEMINI'
    type PhaseConfig = { reminder: string; followup: string; urgency: string }
    type TemplateConfig = Record<ServiceKey, PhaseConfig>
    const EMPTY_CONFIG: TemplateConfig = {
        CANVA:   { reminder: '', followup: '', urgency: '' },
        CHATGPT: { reminder: '', followup: '', urgency: '' },
        GEMINI:  { reminder: '', followup: '', urgency: '' },
    }
    const [templateConfig, setTemplateConfig] = useState<TemplateConfig>(EMPTY_CONFIG)
    const [isSavingConfig, setIsSavingConfig] = useState(false)
    const [configSaved, setConfigSaved] = useState(false)

    // Load templates on mount
    useEffect(() => {
        loadTemplates()
        loadSettings()
        loadMetaTemplates()
    }, [])

    const loadMetaTemplates = async () => {
        setMetaLoading(true)
        setMetaError(null)
        try {
            const res = await fetch('/api/meta-templates')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al cargar plantillas de Meta')
            setMetaTemplates(data.templates || [])
        } catch (err: any) {
            setMetaError(err.message)
        } finally {
            setMetaLoading(false)
        }
    }

    const toggleMetaExpand = (id: string) => {
        setExpandedMeta(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const getBodyText = (components: MetaTemplate['components']) => {
        const body = components.find(c => c.type === 'BODY')
        return body?.text || ''
    }

    const getHeaderText = (components: MetaTemplate['components']) => {
        const header = components.find(c => c.type === 'HEADER')
        if (!header) return null
        if (header.format === 'IMAGE') return '🖼️ Imagen'
        if (header.format === 'VIDEO') return '🎥 Video'
        if (header.format === 'DOCUMENT') return '📄 Documento'
        return header.text || null
    }

    const getFooterText = (components: MetaTemplate['components']) => {
        const footer = components.find(c => c.type === 'FOOTER')
        return footer?.text || null
    }

    const getButtons = (components: MetaTemplate['components']) => {
        const buttons = components.find(c => c.type === 'BUTTONS')
        return buttons?.buttons || []
    }

    const loadSettings = async () => {
        const data = await getSubscriptionSettings()
        setSettings(data || { enable_auto_notifications: true })
        if (data?.template_config) {
            setTemplateConfig({ ...EMPTY_CONFIG, ...data.template_config })
        }
    }

    const saveTemplateConfig = async () => {
        setIsSavingConfig(true)
        try {
            await updateSubscriptionSettings({ template_config: templateConfig })
            setConfigSaved(true)
            setTimeout(() => setConfigSaved(false), 2500)
        } catch (e) {
            console.error(e)
            alert('Error al guardar la configuración')
        } finally {
            setIsSavingConfig(false)
        }
    }

    const setServiceTemplate = (service: ServiceKey, phase: keyof PhaseConfig, value: string) => {
        setTemplateConfig(prev => ({
            ...prev,
            [service]: { ...prev[service], [phase]: value }
        }))
    }

    const toggleNotifications = async (checked: boolean) => {
        setSettings((prev: any) => ({ ...prev, enable_auto_notifications: checked }))
        setIsSavingSettings(true)
        try {
            await updateSubscriptionSettings({ enable_auto_notifications: checked })
        } catch (e) {
            console.error(e)
            alert("Error al actualizar configuración")
        } finally {
            setIsSavingSettings(false)
        }
    }

    const loadTemplates = async () => {
        const data = await getTemplates()
        setTemplates(data)
    }

    const handleCreate = async () => {
        if (!newTemplate.name || !newTemplate.content) return

        startTransition(async () => {
            try {
                await createTemplate(newTemplate.name, newTemplate.content)
                await loadTemplates()
                setIsCreating(false)
                setNewTemplate({ name: '', content: '' })
            } catch (error) {
                console.error("Error creating template:", error)
                alert("Error al crear la plantilla")
            }
        })
    }

    const handleStartEdit = (template: Template) => {
        setEditingId(template.id)
        setEditTemplate({ name: template.name, content: template.content })
    }

    const handleSaveEdit = async () => {
        if (!editingId || !editTemplate.name || !editTemplate.content) return
        startTransition(async () => {
            try {
                await updateTemplate(editingId, editTemplate.name, editTemplate.content)
                await loadTemplates()
                setEditingId(null)
            } catch (error) {
                console.error("Error updating template:", error)
                alert("Error al guardar los cambios")
            }
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return

        startTransition(async () => {
            try {
                await deleteTemplate(id)
                await loadTemplates()
            } catch (error) {
                console.error("Error deleting template:", error)
            }
        })
    }

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.content.toLowerCase().includes(search.toLowerCase())
    )


    return (
        <div className="p-8 max-w-7xl mx-auto text-[#0F172A]">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Plantillas de Respuesta</h1>
                    <p className="text-slate-500">Crea respuestas rápidas para usar en tus conversaciones.</p>
                </div>
                {!builderOpen && (
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setBroadcastOpen(true)}
                            className="bg-[#eab308] hover:bg-[#ca8a04] text-white gap-2"
                        >
                            <Send size={18} />
                            Envío Masivo
                        </Button>
                        <Button
                            onClick={() => setBuilderOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                        >
                            <Plus size={20} />
                            Nueva Plantilla Meta
                        </Button>
                    </div>
                )}
            </div>

            {builderOpen && (
                <MetaTemplateBuilder
                    onSuccess={async () => { setBuilderOpen(false); await loadMetaTemplates() }}
                    onCancel={() => setBuilderOpen(false)}
                />
            )}

            {settings && (
                <Card className="mb-8 border-slate-200 bg-white opacity-90 overflow-hidden">
                    <div className="bg-white/80 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-lg ${settings.enable_auto_notifications ? 'bg-green-500/10 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                {settings.enable_auto_notifications ? <Bell size={22} /> : <BellOff size={22} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[#0F172A]">Notificaciones Automáticas (Meta)</h3>
                                <p className="text-sm text-slate-500">Controla el envío automático de Recordatorios y Remarketing.</p>
                            </div>
                        </div>
                        <label className="flex items-center cursor-pointer gap-3 min-w-[120px] justify-end">
                            <span className="text-sm text-slate-600 font-medium">{settings.enable_auto_notifications ? 'Activado' : 'Desactivado'}</span>
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={settings.enable_auto_notifications} onChange={e => toggleNotifications(e.target.checked)} disabled={isSavingSettings} />
                                <div className={`w-10 h-6 rounded-full shadow-inner transition-colors ${settings.enable_auto_notifications ? 'bg-green-600' : 'bg-slate-300'}`}></div>
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.enable_auto_notifications ? 'translate-x-4' : ''}`}></div>
                            </div>
                        </label>
                    </div>
                    <div className="p-4 bg-slate-50 text-xs text-slate-500 flex flex-col gap-2">
                        <p>ℹ️ Las plantillas de Meta se ejecutan automáticamente los días de vencimiento. Los horarios de envío generales están administrados por Vercel. Envían automáticamente los planes de compra como botones interactivos en WhatsApp.</p>
                    </div>
                </Card>
            )}

            {/* ── Configuración de plantillas por servicio ── */}
            {settings && (
                <Card className="mb-8 border-slate-200 bg-white overflow-hidden">
                    <div className="bg-white/80 p-5 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                <Settings2 size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[#0F172A]">Plantillas por Servicio</h3>
                                <p className="text-sm text-slate-500">Elige qué plantilla Meta enviar a cada tipo de suscripción en cada fase del recordatorio.</p>
                            </div>
                        </div>
                        <Button
                            onClick={saveTemplateConfig}
                            disabled={isSavingConfig}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-sm"
                        >
                            <Save size={14} />
                            {isSavingConfig ? 'Guardando...' : configSaved ? '✓ Guardado' : 'Guardar'}
                        </Button>
                    </div>
                    <div className="p-5 space-y-6">
                        {/* Column headers */}
                        <div className="grid grid-cols-4 gap-3 text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                            <div>Servicio</div>
                            <div>📅 Recordatorio</div>
                            <div>🔔 Remarketing</div>
                            <div>⚠️ Último Aviso</div>
                        </div>
                        {(['CANVA', 'CHATGPT', 'GEMINI'] as ServiceKey[]).map(service => (
                            <div key={service} className="grid grid-cols-4 gap-3 items-center">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                        service === 'CANVA' ? 'bg-violet-50 text-violet-600' :
                                        service === 'CHATGPT' ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-blue-50 text-blue-600'
                                    }`}>{service}</span>
                                </div>
                                {(['reminder', 'followup', 'urgency'] as (keyof PhaseConfig)[]).map(phase => (
                                    <Select
                                        key={phase}
                                        value={templateConfig[service][phase] || '_none'}
                                        onValueChange={v => setServiceTemplate(service, phase, v === '_none' ? '' : v)}
                                    >
                                        <SelectTrigger className="bg-[#F7F8FA] border-slate-200 text-[#0F172A] text-xs h-9">
                                            <SelectValue placeholder="Sin plantilla" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_none" className="text-slate-500 text-xs">Sin plantilla (hardcoded)</SelectItem>
                                            {metaTemplates
                                                .filter(t => t.status === 'APPROVED')
                                                .map(t => (
                                                    <SelectItem key={t.id} value={t.name} className="text-xs">
                                                        <span className="font-mono">{t.name}</span>
                                                        <span className="text-slate-500 ml-1">{t.language}</span>
                                                    </SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                ))}
                            </div>
                        ))}
                        <p className="text-[11px] text-slate-600 pt-1">
                            Si no seleccionas una plantilla, el sistema usará las plantillas por defecto (<code>recordatorio_renovacion_v1</code>, <code>remarketing_suscripcion_v1</code>, <code>ultimo_aviso_renovacion_v1</code>). Solo se muestran plantillas con estado APROBADO.
                        </p>
                    </div>
                </Card>
            )}

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar plantillas..."
                    className="pl-10 bg-[#F7F8FA] border-slate-200 text-[#0F172A] w-full max-w-md"
                />
            </div>

            <div className="space-y-4">
                {filteredTemplates.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No tienes plantillas creadas aún.</p>
                    </div>
                ) : (
                    filteredTemplates.map(template => (
                        <div key={template.id} className="rounded-xl bg-white border border-slate-200 hover:border-indigo-400/50 transition-colors group shadow-sm">
                            {editingId === template.id ? (
                                <div className="p-4 space-y-3">
                                    <Input
                                        value={editTemplate.name}
                                        onChange={e => setEditTemplate(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Nombre de la plantilla..."
                                        className="bg-[#F7F8FA] border-slate-200 text-[#0F172A]"
                                    />
                                    <Textarea
                                        value={editTemplate.content}
                                        onChange={e => setEditTemplate(prev => ({ ...prev, content: e.target.value }))}
                                        placeholder="Escribe el mensaje aquí..."
                                        className="bg-[#F7F8FA] border-slate-200 text-[#0F172A] h-28"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button onClick={() => setEditingId(null)} className="bg-transparent hover:bg-slate-100 text-slate-500">
                                            Cancelar
                                        </Button>
                                        <Button onClick={handleSaveEdit} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                            {isPending ? 'Guardando...' : 'Guardar cambios'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-[#0F172A] text-lg">{template.name}</h3>
                                            <p className="text-slate-500 text-sm line-clamp-1 max-w-2xl">{template.content}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            onClick={() => handleStartEdit(template)}
                                            className="h-8 w-8 p-0 bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                                            title="Editar plantilla"
                                        >
                                            <Edit size={18} />
                                        </Button>
                                        <Button
                                            className="h-8 w-8 p-0 bg-transparent text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDelete(template.id)}
                                            title="Eliminar plantilla"
                                        >
                                            <Trash2 size={18} />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* ── Plantillas de Meta ── */}
            <div className="mt-12">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-[#0F172A]">Plantillas de Meta</h2>
                        <p className="text-slate-500 text-sm mt-1">Plantillas aprobadas en tu cuenta de WhatsApp Business.</p>
                    </div>
                    <button
                        onClick={loadMetaTemplates}
                        disabled={metaLoading}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-[#0F172A] hover:border-slate-400 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={metaLoading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>

                {metaError ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                        <AlertCircle size={18} className="shrink-0" />
                        {metaError}
                    </div>
                ) : metaLoading ? (
                    <div className="text-center py-12 text-slate-500">
                        <RefreshCw size={32} className="animate-spin mx-auto mb-3 opacity-30" />
                        <p>Cargando plantillas desde Meta...</p>
                    </div>
                ) : metaTemplates.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No se encontraron plantillas en tu cuenta de Meta.</p>
                    </div>
                ) : (
                    <>
                        {/* Stats row */}
                        <div className="flex flex-wrap gap-3 mb-5">
                            {(['APPROVED', 'PENDING', 'REJECTED', 'PAUSED'] as const).map(status => {
                                const count = metaTemplates.filter(t => t.status === status).length
                                if (count === 0) return null
                                const cfg = STATUS_CONFIG[status]
                                return (
                                    <span key={status} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}>
                                        {cfg.icon} {cfg.label}: {count}
                                    </span>
                                )
                            })}
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 text-slate-500">
                                Total: {metaTemplates.length}
                            </span>
                        </div>

                        {/* Search */}
                        <div className="relative mb-5">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                value={metaSearch}
                                onChange={e => setMetaSearch(e.target.value)}
                                placeholder="Buscar plantilla de Meta..."
                                className="pl-9 pr-4 py-2 text-sm w-full max-w-sm rounded-lg bg-[#F7F8FA] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Template list */}
                        <div className="space-y-3">
                            {metaTemplates
                                .filter(t => t.name.toLowerCase().includes(metaSearch.toLowerCase()))
                                .map(template => {
                                    const cfg = STATUS_CONFIG[template.status] || STATUS_CONFIG.PAUSED
                                    const isExpanded = expandedMeta.has(template.id)
                                    const bodyText = getBodyText(template.components)
                                    const headerText = getHeaderText(template.components)
                                    const footerText = getFooterText(template.components)
                                    const buttons = getButtons(template.components)

                                    return (
                                        <div key={template.id} className="rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden shadow-sm">
                                            {/* Header row */}
                                            <div
                                                className="flex items-center justify-between p-4 cursor-pointer"
                                                onClick={() => toggleMetaExpand(template.id)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                                                        <FileText size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-[#0F172A] font-medium text-sm">{template.name}</span>
                                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.className}`}>
                                                                {cfg.icon} {cfg.label}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200 text-slate-500">
                                                                {CATEGORY_LABELS[template.category] || template.category}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] border border-slate-200 text-slate-500">
                                                                {template.language}
                                                            </span>
                                                        </div>
                                                        {!isExpanded && bodyText && (
                                                            <p className="text-slate-500 text-xs mt-1 line-clamp-1">{bodyText}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-slate-500 shrink-0 ml-2">
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </div>
                                            </div>

                                            {/* Expanded content */}
                                            {isExpanded && (
                                                <div className="border-t border-slate-200 p-4 space-y-3 bg-slate-50">
                                                    {headerText && (
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Encabezado</span>
                                                            <p className="text-slate-700 text-sm mt-1 font-medium">{headerText}</p>
                                                        </div>
                                                    )}
                                                    {bodyText && (
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cuerpo</span>
                                                            <p className="text-slate-700 text-sm mt-1 whitespace-pre-wrap">{bodyText}</p>
                                                        </div>
                                                    )}
                                                    {footerText && (
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pie</span>
                                                            <p className="text-slate-400 text-xs mt-1 italic">{footerText}</p>
                                                        </div>
                                                    )}
                                                    {buttons.length > 0 && (
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Botones</span>
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                {buttons.map((btn, i) => (
                                                                    <span key={i} className="px-3 py-1 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600">
                                                                        {btn.text}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                        </div>
                    </>
                )}
            </div>

            {broadcastOpen && (
                <BroadcastModal
                    metaTemplates={metaTemplates}
                    onClose={() => setBroadcastOpen(false)}
                />
            )}
        </div>
    )
}
