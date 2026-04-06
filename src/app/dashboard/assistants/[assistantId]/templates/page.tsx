'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Plus, Search, FileText, Bell, BellOff, RefreshCw, CheckCircle2, XCircle,
    Clock, AlertCircle, ChevronDown, ChevronUp, Settings2, Save, Send, Copy
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSubscriptionSettings, updateSubscriptionSettings } from './actions'
import MetaTemplateBuilder from './MetaTemplateBuilder'
import SimpleTemplateWizard from './SimpleTemplateWizard'
import BroadcastModal from './BroadcastModal'
import { toast } from 'sonner'

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

type Tab = 'templates' | 'broadcast' | 'config'

export default function TemplatesPage() {
    const [tab, setTab] = useState<Tab>('templates')

    // Meta templates
    const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
    const [metaLoading, setMetaLoading] = useState(false)
    const [metaError, setMetaError] = useState<string | null>(null)
    const [expandedMeta, setExpandedMeta] = useState<Set<string>>(new Set())
    const [metaSearch, setMetaSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('ALL')

    // Builder state
    const [builderOpen, setBuilderOpen] = useState(false)
    const [useAdvancedBuilder, setUseAdvancedBuilder] = useState(false)
    const [duplicateBody, setDuplicateBody] = useState<string | undefined>(undefined)

    // Config state
    const [settings, setSettings] = useState<any>(null)
    const [isSavingSettings, setIsSavingSettings] = useState(false)
    type ServiceKey = string
    type PhaseConfig = { reminder: string; followup: string; urgency: string }
    type TemplateConfig = Record<ServiceKey, PhaseConfig>
    const DEFAULT_SERVICES = ['CANVA', 'CHATGPT', 'GEMINI', 'NETFLIX', 'SPOTIFY', 'OTRO']
    const EMPTY_CONFIG: TemplateConfig = Object.fromEntries(
        DEFAULT_SERVICES.map(s => [s, { reminder: '', followup: '', urgency: '' }])
    )
    const [templateConfig, setTemplateConfig] = useState<TemplateConfig>(EMPTY_CONFIG)
    const [isSavingConfig, setIsSavingConfig] = useState(false)
    const [configSaved, setConfigSaved] = useState(false)

    useEffect(() => {
        loadMetaTemplates()
        loadSettings()
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

    const loadSettings = async () => {
        const data = await getSubscriptionSettings()
        setSettings(data || { enable_auto_notifications: true })
        if (data?.template_config) {
            setTemplateConfig({ ...EMPTY_CONFIG, ...data.template_config })
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

    const getBodyText = (components: MetaTemplate['components']) =>
        components.find(c => c.type === 'BODY')?.text || ''

    const getHeaderText = (components: MetaTemplate['components']) => {
        const header = components.find(c => c.type === 'HEADER')
        if (!header) return null
        if (header.format === 'IMAGE') return '🖼️ Imagen'
        if (header.format === 'VIDEO') return '🎥 Video'
        if (header.format === 'DOCUMENT') return '📄 Documento'
        return header.text || null
    }

    const getFooterText = (components: MetaTemplate['components']) =>
        components.find(c => c.type === 'FOOTER')?.text || null

    const getButtons = (components: MetaTemplate['components']) =>
        components.find(c => c.type === 'BUTTONS')?.buttons || []

    const handleDuplicate = (template: MetaTemplate) => {
        const body = getBodyText(template.components)
        setDuplicateBody(body)
        setUseAdvancedBuilder(false)
        setBuilderOpen(true)
        setTab('templates')
        toast.success(`Duplicando "${template.name}" — edita el mensaje y envía como nueva plantilla`)
    }

    const handleBuilderClose = () => {
        setBuilderOpen(false)
        setUseAdvancedBuilder(false)
        setDuplicateBody(undefined)
    }

    const handleBuilderSuccess = async () => {
        handleBuilderClose()
        await loadMetaTemplates()
    }

    // Config handlers
    const saveTemplateConfig = async () => {
        setIsSavingConfig(true)
        try {
            await updateSubscriptionSettings({ template_config: templateConfig })
            setConfigSaved(true)
            setTimeout(() => setConfigSaved(false), 2500)
        } catch (e) {
            console.error(e)
            toast.error('Error al guardar la configuración')
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
            toast.error('Error al actualizar configuración')
        } finally {
            setIsSavingSettings(false)
        }
    }

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'templates', label: 'Plantillas', icon: <FileText size={16} /> },
        { id: 'broadcast', label: 'Envío Masivo', icon: <Send size={16} /> },
        { id: 'config', label: 'Configuración', icon: <Settings2 size={16} /> },
    ]

    return (
        <div className="p-8 max-w-7xl mx-auto text-[#0F172A]">

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-[#0F172A] mb-1">Plantillas WhatsApp</h1>
                    <p className="text-slate-500 text-sm">Gestiona tus plantillas de Meta, envíos masivos y configuración de notificaciones.</p>
                </div>
                {!builderOpen && tab === 'templates' && (
                    <Button
                        onClick={() => { setBuilderOpen(true); setDuplicateBody(undefined); setUseAdvancedBuilder(false) }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    >
                        <Plus size={18} />
                        Nueva Plantilla
                    </Button>
                )}
            </div>

            {/* ── Builder (when open) ── */}
            {builderOpen && !useAdvancedBuilder && (
                <SimpleTemplateWizard
                    onSuccess={handleBuilderSuccess}
                    onCancel={handleBuilderClose}
                    onAdvancedMode={() => setUseAdvancedBuilder(true)}
                    initialBody={duplicateBody}
                />
            )}
            {builderOpen && useAdvancedBuilder && (
                <MetaTemplateBuilder
                    onSuccess={handleBuilderSuccess}
                    onCancel={handleBuilderClose}
                />
            )}

            {/* ── Tabs ── */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            tab === t.id
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* ── TAB: PLANTILLAS ── */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            {tab === 'templates' && (
                <div>
                    {metaError ? (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                            <AlertCircle size={18} className="shrink-0" />
                            {metaError}
                        </div>
                    ) : metaLoading ? (
                        <div className="text-center py-16 text-slate-500">
                            <RefreshCw size={32} className="animate-spin mx-auto mb-3 opacity-30" />
                            <p>Cargando plantillas desde Meta...</p>
                        </div>
                    ) : metaTemplates.length === 0 ? (
                        <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <FileText size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="font-medium mb-1">No tienes plantillas en Meta</p>
                            <p className="text-xs">Crea tu primera plantilla con el botón "Nueva Plantilla".</p>
                        </div>
                    ) : (
                        <>
                            {/* Stats (clickable to filter) + refresh */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setStatusFilter('ALL')}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                            statusFilter === 'ALL'
                                                ? 'border-indigo-400 bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200'
                                                : 'border-slate-200 text-slate-500 hover:border-slate-400'
                                        }`}
                                    >
                                        Todas: {metaTemplates.length}
                                    </button>
                                    {(['APPROVED', 'PENDING', 'REJECTED', 'PAUSED'] as const).map(status => {
                                        const count = metaTemplates.filter(t => t.status === status).length
                                        if (count === 0) return null
                                        const cfg = STATUS_CONFIG[status]
                                        return (
                                            <button
                                                key={status}
                                                onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                                    statusFilter === status
                                                        ? `${cfg.className} ring-1 ring-current/20`
                                                        : `${cfg.className} opacity-70 hover:opacity-100`
                                                }`}
                                            >
                                                {cfg.icon} {cfg.label}: {count}
                                            </button>
                                        )
                                    })}
                                </div>
                                <button
                                    onClick={loadMetaTemplates}
                                    disabled={metaLoading}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-[#0F172A] hover:border-slate-400 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw size={12} className={metaLoading ? 'animate-spin' : ''} />
                                    Actualizar
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative mb-5">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    value={metaSearch}
                                    onChange={e => setMetaSearch(e.target.value)}
                                    placeholder="Buscar plantilla..."
                                    className="pl-9 pr-4 py-2 text-sm w-full max-w-sm rounded-lg bg-[#F7F8FA] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Template list */}
                            <div className="space-y-3">
                                {metaTemplates
                                    .filter(t => statusFilter === 'ALL' || t.status === statusFilter)
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
                                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
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
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        {template.status === 'APPROVED' && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleDuplicate(template) }}
                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                                                                title="Duplicar como nueva plantilla"
                                                            >
                                                                <Copy size={12} />
                                                                Duplicar
                                                            </button>
                                                        )}
                                                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
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
            )}

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* ── TAB: ENVÍO MASIVO ── */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            {tab === 'broadcast' && (
                <BroadcastModal
                    metaTemplates={metaTemplates}
                    onClose={() => setTab('templates')}
                    inline
                />
            )}

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* ── TAB: CONFIGURACIÓN ── */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            {tab === 'config' && settings && (
                <div className="space-y-6">

                    {/* Notifications toggle */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-lg ${settings.enable_auto_notifications ? 'bg-green-500/10 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {settings.enable_auto_notifications ? <Bell size={22} /> : <BellOff size={22} />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#0F172A]">Notificaciones Automáticas</h3>
                                    <p className="text-sm text-slate-500">Controla el envío automático de Recordatorios y Remarketing vía Meta.</p>
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
                        <div className="px-5 pb-4 text-xs text-slate-500">
                            Las plantillas se envían automáticamente en los horarios configurados en el servidor. Solo se envían a suscripciones próximas a vencer.
                        </div>
                    </div>

                    {/* Template config per service */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                        <div className="p-5 flex items-center justify-between border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                    <Settings2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#0F172A]">Plantillas por Servicio</h3>
                                    <p className="text-sm text-slate-500">Elige qué plantilla Meta enviar a cada servicio en cada fase del recordatorio.</p>
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
                            <div className="grid grid-cols-4 gap-3 text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                                <div>Servicio</div>
                                <div className="group relative cursor-help">
                                    Recordatorio
                                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-56 p-2.5 rounded-lg bg-[#0F172A] text-white text-[11px] font-normal normal-case tracking-normal shadow-lg leading-relaxed">
                                        Primer aviso: se envía ~7 días antes de que venza la suscripción del cliente.
                                        <div className="absolute top-full left-4 w-2 h-2 bg-[#0F172A] rotate-45 -mt-1" />
                                    </div>
                                </div>
                                <div className="group relative cursor-help">
                                    Remarketing
                                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-56 p-2.5 rounded-lg bg-[#0F172A] text-white text-[11px] font-normal normal-case tracking-normal shadow-lg leading-relaxed">
                                        Segundo aviso: se envía ~2 días antes del vencimiento si el cliente no renovó tras el primer recordatorio.
                                        <div className="absolute top-full left-4 w-2 h-2 bg-[#0F172A] rotate-45 -mt-1" />
                                    </div>
                                </div>
                                <div className="group relative cursor-help">
                                    Último Aviso
                                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-56 p-2.5 rounded-lg bg-[#0F172A] text-white text-[11px] font-normal normal-case tracking-normal shadow-lg leading-relaxed">
                                        Aviso urgente: se envía el mismo día del vencimiento o 24h antes. Última oportunidad para renovar.
                                        <div className="absolute top-full left-4 w-2 h-2 bg-[#0F172A] rotate-45 -mt-1" />
                                    </div>
                                </div>
                            </div>
                            {DEFAULT_SERVICES.map(service => (
                                <div key={service} className="grid grid-cols-4 gap-3 items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">{service}</span>
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
                                                <SelectItem value="_none" className="text-slate-500 text-xs">Sin plantilla (por defecto)</SelectItem>
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
                            <p className="text-[11px] text-slate-500 pt-1">
                                Si no seleccionas una plantilla, el sistema usará las plantillas por defecto. Solo se muestran plantillas con estado APROBADO.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
