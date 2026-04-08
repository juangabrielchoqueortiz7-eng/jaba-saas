'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
    Plus, Search, FileText, Bell, BellOff, RefreshCw, CheckCircle2, XCircle,
    Clock, AlertCircle, Settings2, Save, Send, Copy, MessageSquare, Zap, Image, Video, FileIcon, Globe
} from 'lucide-react'
import { getSubscriptionSettings, updateSubscriptionSettings } from './actions'
import MetaTemplateBuilder from './MetaTemplateBuilder'
import SimpleTemplateWizard from './SimpleTemplateWizard'
import BroadcastModal from './BroadcastModal'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { COMMON_TIMEZONES } from '@/lib/timezone-utils'

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

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
    APPROVED:  { label: 'Aprobada',    dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    PENDING:   { label: 'En revisión', dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    REJECTED:  { label: 'Rechazada',   dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700 border-red-200' },
    PAUSED:    { label: 'Pausada',     dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 border-slate-200' },
    DISABLED:  { label: 'Desactivada', dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    MARKETING:      { label: 'Marketing',      color: 'text-purple-600 bg-purple-50',  icon: <Zap size={11} /> },
    UTILITY:        { label: 'Utilidad',        color: 'text-blue-600 bg-blue-50',      icon: <Settings2 size={11} /> },
    AUTHENTICATION: { label: 'Autenticación',   color: 'text-orange-600 bg-orange-50',  icon: <CheckCircle2 size={11} /> },
}

const LANG_FLAGS: Record<string, string> = {
    es: '🇪🇸', en: '🇺🇸', en_US: '🇺🇸', es_MX: '🇲🇽', es_AR: '🇦🇷', pt_BR: '🇧🇷', pt: '🇧🇷',
}

type Tab = 'templates' | 'broadcast' | 'config'

// ── WhatsApp Bubble Preview ────────────────────────────────────────────────────

function WhatsAppPreview({ template }: { template: MetaTemplate }) {
    const header = template.components.find(c => c.type === 'HEADER')
    const body = template.components.find(c => c.type === 'BODY')
    const footer = template.components.find(c => c.type === 'FOOTER')
    const buttonsComp = template.components.find(c => c.type === 'BUTTONS')
    const buttons = buttonsComp?.buttons || []

    return (
        <div className="bg-[#E5DDD5] rounded-xl p-4 flex flex-col items-start gap-1"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h60v60H0z\' fill=\'%23e5ddd5\'/%3E%3C/svg%3E")' }}>
            <div className="bg-white rounded-xl rounded-tl-sm shadow-sm w-full max-w-[280px] overflow-hidden">
                {/* Header */}
                {header && (
                    header.format === 'IMAGE' ? (
                        <div className="bg-slate-200 h-28 flex items-center justify-center">
                            <Image size={28} className="text-slate-400" />
                            <span className="ml-2 text-slate-400 text-xs">Imagen</span>
                        </div>
                    ) : header.format === 'VIDEO' ? (
                        <div className="bg-slate-900 h-28 flex items-center justify-center">
                            <Video size={28} className="text-white/50" />
                            <span className="ml-2 text-white/50 text-xs">Video</span>
                        </div>
                    ) : header.format === 'DOCUMENT' ? (
                        <div className="bg-slate-100 px-3 py-2 flex items-center gap-2 border-b border-slate-200">
                            <FileIcon size={18} className="text-slate-500" />
                            <span className="text-slate-600 text-xs font-medium">Documento adjunto</span>
                        </div>
                    ) : header.text ? (
                        <div className="px-3 pt-3 pb-1">
                            <p className="text-[#111B21] font-bold text-sm">{header.text}</p>
                        </div>
                    ) : null
                )}

                {/* Body */}
                {body?.text && (
                    <div className="px-3 py-2">
                        <p className="text-[#111B21] text-[13px] leading-relaxed whitespace-pre-wrap">{body.text}</p>
                    </div>
                )}

                {/* Footer */}
                {footer?.text && (
                    <div className="px-3 pb-2">
                        <p className="text-[#667781] text-[11px]">{footer.text}</p>
                    </div>
                )}

                {/* Timestamp */}
                <div className="flex justify-end px-3 pb-2">
                    <span className="text-[10px] text-[#667781]">14:32 ✓✓</span>
                </div>

                {/* Buttons */}
                {buttons.length > 0 && (
                    <div className="border-t border-[#E9EDEF]">
                        {buttons.map((btn, i) => (
                            <div key={i} className={`text-center py-2.5 text-[#00A884] text-[13px] font-medium ${i > 0 ? 'border-t border-[#E9EDEF]' : ''}`}>
                                {btn.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Template Card ──────────────────────────────────────────────────────────────

function TemplateCard({ template, onDuplicate }: { template: MetaTemplate; onDuplicate: (t: MetaTemplate) => void }) {
    const [expanded, setExpanded] = useState(false)
    const cfg = STATUS_CONFIG[template.status] || STATUS_CONFIG.PAUSED
    const catCfg = CATEGORY_CONFIG[template.category]
    const flag = LANG_FLAGS[template.language] || '🌐'
    const body = template.components.find(c => c.type === 'BODY')?.text || ''
    const hasMedia = template.components.some(c => c.type === 'HEADER' && ['IMAGE','VIDEO','DOCUMENT'].includes(c.format || ''))
    const btnCount = template.components.find(c => c.type === 'BUTTONS')?.buttons?.length || 0

    return (
        <div className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
            expanded ? 'border-indigo-200 shadow-md' : 'border-black/[0.08] hover:border-slate-300 hover:shadow-sm'
        }`}>
            {/* Card header */}
            <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
                {/* Icon */}
                <div className={`p-2.5 rounded-xl shrink-0 ${
                    template.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                    template.status === 'PENDING'  ? 'bg-amber-50 text-amber-500' :
                    template.status === 'REJECTED' ? 'bg-red-50 text-red-500' :
                    'bg-slate-100 text-slate-400'
                }`}>
                    <MessageSquare size={18} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-[#0F172A] text-sm truncate">{template.name}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{flag} {template.language}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Status */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                        </span>
                        {/* Category */}
                        {catCfg && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${catCfg.color}`}>
                                {catCfg.icon} {catCfg.label}
                            </span>
                        )}
                        {/* Extras */}
                        {hasMedia && <span className="text-[11px] text-slate-400">📎 Con media</span>}
                        {btnCount > 0 && <span className="text-[11px] text-slate-400">🔘 {btnCount} botón{btnCount > 1 ? 'es' : ''}</span>}
                    </div>
                    {!expanded && body && (
                        <p className="text-slate-400 text-xs mt-1.5 line-clamp-1">{body}</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {template.status === 'APPROVED' && (
                        <button
                            onClick={e => { e.stopPropagation(); onDuplicate(template) }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                        >
                            <Copy size={12} /> Duplicar
                        </button>
                    )}
                    <div className={`text-slate-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 10.5L3 5.5h10l-5 5z"/></svg>
                    </div>
                </div>
            </div>

            {/* Expanded: WhatsApp preview */}
            {expanded && (
                <div className="border-t border-black/[0.06] p-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F7F8FA]">
                    {/* Left: raw content */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contenido</p>
                        {template.components.map((comp, i) => {
                            if (comp.type === 'HEADER') return (
                                <div key={i}>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Encabezado</p>
                                    <p className="text-sm text-[#0F172A] font-semibold">
                                        {comp.format === 'IMAGE' ? '🖼️ Imagen' :
                                         comp.format === 'VIDEO' ? '🎥 Video' :
                                         comp.format === 'DOCUMENT' ? '📄 Documento' :
                                         comp.text}
                                    </p>
                                </div>
                            )
                            if (comp.type === 'BODY') return (
                                <div key={i}>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Mensaje</p>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{comp.text}</p>
                                </div>
                            )
                            if (comp.type === 'FOOTER') return (
                                <div key={i}>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Pie de mensaje</p>
                                    <p className="text-xs text-slate-400 italic">{comp.text}</p>
                                </div>
                            )
                            if (comp.type === 'BUTTONS' && comp.buttons?.length) return (
                                <div key={i}>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Botones</p>
                                    <div className="flex flex-wrap gap-2">
                                        {comp.buttons.map((btn, bi) => (
                                            <span key={bi} className="px-3 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 font-medium">
                                                {btn.text}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )
                            return null
                        })}
                    </div>

                    {/* Right: WhatsApp visual preview */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Vista previa en WhatsApp</p>
                        <WhatsAppPreview template={template} />
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
    const [tab, setTab] = useState<Tab>('templates')
    const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
    const [metaLoading, setMetaLoading] = useState(false)
    const [metaError, setMetaError] = useState<string | null>(null)
    const [metaSearch, setMetaSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('ALL')
    const [builderOpen, setBuilderOpen] = useState(false)
    const [useAdvancedBuilder, setUseAdvancedBuilder] = useState(false)
    const [duplicateBody, setDuplicateBody] = useState<string | undefined>(undefined)
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

    // Scheduling config state
    const [schedConfig, setSchedConfig] = useState({
        timezone: 'America/La_Paz',
        reminder_hour: 9,
        followup_hour: 18,
        urgency_hour: 9,
    })
    const [isSavingSchedConfig, setIsSavingSchedConfig] = useState(false)
    const [schedConfigSaved, setSchedConfigSaved] = useState(false)

    useEffect(() => { loadMetaTemplates(); loadSettings(); loadSchedConfig() }, [])

    const loadMetaTemplates = async () => {
        setMetaLoading(true); setMetaError(null)
        try {
            const res = await fetch('/api/meta-templates')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al cargar plantillas de Meta')
            setMetaTemplates(data.templates || [])
        } catch (err: any) { setMetaError(err.message) }
        finally { setMetaLoading(false) }
    }

    const loadSettings = async () => {
        const data = await getSubscriptionSettings()
        setSettings(data || { enable_auto_notifications: true })
        if (data?.template_config) setTemplateConfig({ ...EMPTY_CONFIG, ...data.template_config })
    }

    const handleDuplicate = (template: MetaTemplate) => {
        const body = template.components.find(c => c.type === 'BODY')?.text || ''
        setDuplicateBody(body)
        setUseAdvancedBuilder(false)
        setBuilderOpen(true)
        setTab('templates')
        toast.success(`Duplicando "${template.name}"`)
    }

    const handleBuilderClose = () => { setBuilderOpen(false); setUseAdvancedBuilder(false); setDuplicateBody(undefined) }
    const handleBuilderSuccess = async () => { handleBuilderClose(); await loadMetaTemplates() }

    const saveTemplateConfig = async () => {
        setIsSavingConfig(true)
        try {
            await updateSubscriptionSettings({ template_config: templateConfig })
            setConfigSaved(true); setTimeout(() => setConfigSaved(false), 2500)
        } catch { toast.error('Error al guardar la configuración') }
        finally { setIsSavingConfig(false) }
    }

    const setServiceTemplate = (service: ServiceKey, phase: keyof PhaseConfig, value: string) => {
        setTemplateConfig(prev => ({ ...prev, [service]: { ...prev[service], [phase]: value } }))
    }

    const loadSchedConfig = async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase
                .from('scheduling_config')
                .select('*')
                .eq('user_id', user.id)
                .single()
            if (data) setSchedConfig({
                timezone: data.timezone || 'America/La_Paz',
                reminder_hour: data.reminder_hour ?? 9,
                followup_hour: data.followup_hour ?? 18,
                urgency_hour: data.urgency_hour ?? 9,
            })
        } catch { /* sin config previa, usa defaults */ }
    }

    const saveSchedConfig = async () => {
        setIsSavingSchedConfig(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user')
            const { error } = await supabase
                .from('scheduling_config')
                .upsert({ user_id: user.id, ...schedConfig }, { onConflict: 'user_id' })
            if (error) throw error
            setSchedConfigSaved(true)
            setTimeout(() => setSchedConfigSaved(false), 2500)
        } catch { toast.error('Error al guardar los horarios') }
        finally { setIsSavingSchedConfig(false) }
    }

    const toggleNotifications = async (checked: boolean) => {
        setSettings((prev: any) => ({ ...prev, enable_auto_notifications: checked }))
        setIsSavingSettings(true)
        try { await updateSubscriptionSettings({ enable_auto_notifications: checked }) }
        catch { toast.error('Error al actualizar configuración') }
        finally { setIsSavingSettings(false) }
    }

    const filtered = metaTemplates
        .filter(t => statusFilter === 'ALL' || t.status === statusFilter)
        .filter(t => t.name.toLowerCase().includes(metaSearch.toLowerCase()))

    const approvedCount  = metaTemplates.filter(t => t.status === 'APPROVED').length
    const pendingCount   = metaTemplates.filter(t => t.status === 'PENDING').length
    const rejectedCount  = metaTemplates.filter(t => t.status === 'REJECTED').length

    const TABS = [
        { id: 'templates' as Tab, label: 'Mis Plantillas',  icon: <FileText size={15} /> },
        { id: 'broadcast' as Tab, label: 'Envío Masivo',    icon: <Send size={15} /> },
        { id: 'config'    as Tab, label: 'Configuración',   icon: <Settings2 size={15} /> },
    ]

    return (
        <div className="min-h-screen bg-[#F7F8FA]">
            <div className="max-w-6xl mx-auto p-6 md:p-8">

                {/* ── Header ── */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#0F172A]">Plantillas de WhatsApp</h1>
                        <p className="text-slate-500 text-sm mt-1">Crea y gestiona tus mensajes aprobados por Meta para envíos masivos y notificaciones.</p>
                    </div>
                    {!builderOpen && tab === 'templates' && (
                        <Button
                            onClick={() => { setBuilderOpen(true); setDuplicateBody(undefined); setUseAdvancedBuilder(false) }}
                            className="bg-[#25D366] hover:bg-[#20B858] text-white gap-2 rounded-xl shadow-sm"
                        >
                            <Plus size={16} /> Nueva Plantilla
                        </Button>
                    )}
                </div>

                {/* ── Builder ── */}
                {builderOpen && !useAdvancedBuilder && (
                    <div className="mb-6">
                        <SimpleTemplateWizard
                            onSuccess={handleBuilderSuccess}
                            onCancel={handleBuilderClose}
                            onAdvancedMode={() => setUseAdvancedBuilder(true)}
                            initialBody={duplicateBody}
                        />
                    </div>
                )}
                {builderOpen && useAdvancedBuilder && (
                    <div className="mb-6">
                        <MetaTemplateBuilder onSuccess={handleBuilderSuccess} onCancel={handleBuilderClose} />
                    </div>
                )}

                {/* ── Tabs ── */}
                <div className="flex gap-1 bg-white rounded-xl border border-black/[0.08] p-1 mb-6 w-fit shadow-sm">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                tab === t.id
                                    ? 'bg-[#0F172A] text-white shadow-sm'
                                    : 'text-slate-500 hover:text-[#0F172A]'
                            }`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* ══════════════════════════════════════════ */}
                {/* TAB: PLANTILLAS                           */}
                {/* ══════════════════════════════════════════ */}
                {tab === 'templates' && (
                    <div>
                        {metaError ? (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm">
                                <AlertCircle size={18} className="shrink-0" /> {metaError}
                            </div>
                        ) : metaLoading ? (
                            <div className="text-center py-20 text-slate-400">
                                <RefreshCw size={28} className="animate-spin mx-auto mb-3" />
                                <p className="text-sm">Cargando plantillas desde Meta...</p>
                            </div>
                        ) : metaTemplates.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <MessageSquare size={28} className="text-slate-300" />
                                </div>
                                <p className="font-semibold text-slate-600 mb-1">Aún no tienes plantillas</p>
                                <p className="text-xs text-slate-400 mb-4">Crea tu primera plantilla con el botón "Nueva Plantilla"</p>
                                <Button
                                    onClick={() => setBuilderOpen(true)}
                                    className="bg-[#25D366] hover:bg-[#20B858] text-white gap-2 rounded-xl"
                                >
                                    <Plus size={15} /> Crear primera plantilla
                                </Button>
                            </div>
                        ) : (
                            <>
                                {/* Stats row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                    {[
                                        { label: 'Total',      value: metaTemplates.length, color: 'bg-white',            text: 'text-[#0F172A]',    filter: 'ALL' },
                                        { label: 'Aprobadas',  value: approvedCount,         color: 'bg-emerald-50',        text: 'text-emerald-700',  filter: 'APPROVED' },
                                        { label: 'En revisión',value: pendingCount,           color: 'bg-amber-50',          text: 'text-amber-700',    filter: 'PENDING' },
                                        { label: 'Rechazadas', value: rejectedCount,          color: 'bg-red-50',            text: 'text-red-700',      filter: 'REJECTED' },
                                    ].map(stat => (
                                        <button
                                            key={stat.filter}
                                            onClick={() => setStatusFilter(statusFilter === stat.filter ? 'ALL' : stat.filter)}
                                            className={`${stat.color} rounded-2xl border p-4 text-left transition-all hover:shadow-sm ${
                                                statusFilter === stat.filter ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-black/[0.08]'
                                            }`}
                                        >
                                            <p className={`text-2xl font-bold ${stat.text}`}>{stat.value}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                                        </button>
                                    ))}
                                </div>

                                {/* Search + refresh */}
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                        <input
                                            value={metaSearch}
                                            onChange={e => setMetaSearch(e.target.value)}
                                            placeholder="Buscar por nombre..."
                                            className="pl-9 pr-4 py-2.5 text-sm w-full rounded-xl bg-white border border-black/[0.08] text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <button
                                        onClick={loadMetaTemplates}
                                        disabled={metaLoading}
                                        className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl bg-white border border-black/[0.08] text-slate-600 hover:text-[#0F172A] hover:border-slate-300 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={13} className={metaLoading ? 'animate-spin' : ''} />
                                        Actualizar
                                    </button>
                                </div>

                                {/* Template cards */}
                                {filtered.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                                        <Search size={24} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">No hay plantillas que coincidan</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filtered.map(template => (
                                            <TemplateCard
                                                key={template.id}
                                                template={template}
                                                onDuplicate={handleDuplicate}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════ */}
                {/* TAB: ENVÍO MASIVO                         */}
                {/* ══════════════════════════════════════════ */}
                {tab === 'broadcast' && (
                    <BroadcastModal metaTemplates={metaTemplates} onClose={() => setTab('templates')} inline />
                )}

                {/* ══════════════════════════════════════════ */}
                {/* TAB: CONFIGURACIÓN                        */}
                {/* ══════════════════════════════════════════ */}
                {tab === 'config' && settings && (
                    <div className="space-y-5">

                        {/* Notifications toggle */}
                        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                            <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${settings.enable_auto_notifications ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {settings.enable_auto_notifications ? <Bell size={20} /> : <BellOff size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-[#0F172A]">Notificaciones automáticas</h3>
                                        <p className="text-sm text-slate-500">Recordatorios y remarketing vía WhatsApp para suscripciones próximas a vencer.</p>
                                    </div>
                                </div>
                                <label className="flex items-center cursor-pointer gap-3 shrink-0">
                                    <span className={`text-sm font-medium ${settings.enable_auto_notifications ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {settings.enable_auto_notifications ? 'Activado' : 'Desactivado'}
                                    </span>
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={settings.enable_auto_notifications} onChange={e => toggleNotifications(e.target.checked)} disabled={isSavingSettings} />
                                        <div className={`w-11 h-6 rounded-full transition-colors ${settings.enable_auto_notifications ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.enable_auto_notifications ? 'translate-x-5' : ''}`} />
                                    </div>
                                </label>
                            </div>
                            <div className="px-5 pb-4 bg-slate-50 border-t border-black/[0.06]">
                                <p className="text-xs text-slate-400">Los mensajes se envían automáticamente según el horario del servidor. Solo aplica a suscripciones próximas a vencer.</p>
                            </div>
                        </div>

                        {/* Scheduling config */}
                        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                            <div className="p-5 flex items-center justify-between border-b border-black/[0.06]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-[#0F172A]">Horarios de envío</h3>
                                        <p className="text-sm text-slate-500">Configura a qué hora se envía cada tipo de recordatorio en tu zona horaria.</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={saveSchedConfig}
                                    disabled={isSavingSchedConfig}
                                    className="bg-[#0F172A] hover:bg-[#1E293B] text-white gap-2 text-sm rounded-xl shrink-0"
                                >
                                    <Save size={14} />
                                    {isSavingSchedConfig ? 'Guardando...' : schedConfigSaved ? '✓ Guardado' : 'Guardar'}
                                </Button>
                            </div>
                            <div className="p-5 space-y-5">
                                {/* Timezone */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                        <Globe size={12} /> Zona horaria
                                    </label>
                                    <Select value={schedConfig.timezone} onValueChange={v => setSchedConfig(p => ({ ...p, timezone: v }))}>
                                        <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm h-10 rounded-lg">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COMMON_TIMEZONES.map(tz => (
                                                <SelectItem key={tz.value} value={tz.value} className="text-sm">{tz.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Hours grid */}
                                <div className="grid grid-cols-3 gap-4">
                                    {([
                                        { key: 'reminder_hour', label: 'Recordatorio', desc: '1er aviso', color: 'text-blue-600 bg-blue-50' },
                                        { key: 'followup_hour', label: 'Remarketing', desc: '6PM por defecto', color: 'text-amber-600 bg-amber-50' },
                                        { key: 'urgency_hour', label: 'Último aviso', desc: '2do día', color: 'text-red-600 bg-red-50' },
                                    ] as const).map(({ key, label, desc, color }) => (
                                        <div key={key} className="bg-[#F7F8FA] rounded-xl p-4 border border-black/[0.06]">
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold mb-3 ${color}`}>
                                                <Clock size={11} /> {label}
                                            </div>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={23}
                                                value={schedConfig[key]}
                                                onChange={e => setSchedConfig(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                                                className="bg-white border-black/[0.08] text-[#0F172A] text-center text-lg font-bold h-10 rounded-lg"
                                            />
                                            <p className="text-[11px] text-slate-400 mt-2 text-center">{desc}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    Las horas se expresan en formato 24h según tu zona horaria. El cron se ejecuta diariamente y solo envía a usuarios cuya hora local coincide.
                                </p>
                            </div>
                        </div>

                        {/* Template config per service */}
                        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
                            <div className="p-5 flex items-center justify-between border-b border-black/[0.06]">
                                <div>
                                    <h3 className="font-semibold text-[#0F172A]">Plantilla por servicio</h3>
                                    <p className="text-sm text-slate-500">Elige qué plantilla enviar a cada servicio en cada fase del recordatorio.</p>
                                </div>
                                <Button
                                    onClick={saveTemplateConfig}
                                    disabled={isSavingConfig}
                                    className="bg-[#0F172A] hover:bg-[#1E293B] text-white gap-2 text-sm rounded-xl"
                                >
                                    <Save size={14} />
                                    {isSavingConfig ? 'Guardando...' : configSaved ? '✓ Guardado' : 'Guardar'}
                                </Button>
                            </div>

                            <div className="p-5">
                                {/* Column headers */}
                                <div className="grid grid-cols-4 gap-3 mb-3">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Servicio</div>
                                    {[
                                        { label: 'Recordatorio', desc: '~7 días antes del vencimiento' },
                                        { label: 'Remarketing',  desc: '~2 días antes, si no renovó' },
                                        { label: 'Último aviso', desc: 'Día del vencimiento' },
                                    ].map(col => (
                                        <div key={col.label} className="group relative">
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-help">{col.label}</p>
                                            <p className="text-[10px] text-slate-300">{col.desc}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-3">
                                    {DEFAULT_SERVICES.map(service => (
                                        <div key={service} className="grid grid-cols-4 gap-3 items-center p-3 rounded-xl bg-[#F7F8FA] border border-black/[0.04]">
                                            <div>
                                                <span className="text-xs font-bold text-[#0F172A] bg-white border border-black/[0.08] px-2.5 py-1 rounded-lg">{service}</span>
                                            </div>
                                            {(['reminder', 'followup', 'urgency'] as const).map(phase => (
                                                <Select
                                                    key={phase}
                                                    value={templateConfig[service]?.[phase] || '_none'}
                                                    onValueChange={v => setServiceTemplate(service, phase, v === '_none' ? '' : v)}
                                                >
                                                    <SelectTrigger className="bg-white border-black/[0.08] text-[#0F172A] text-xs h-9 rounded-lg">
                                                        <SelectValue placeholder="Sin plantilla" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="_none" className="text-slate-400 text-xs">— Sin plantilla —</SelectItem>
                                                        {metaTemplates
                                                            .filter(t => t.status === 'APPROVED')
                                                            .map(t => (
                                                                <SelectItem key={t.id} value={t.name} className="text-xs">
                                                                    {t.name}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            ))}
                                        </div>
                                    ))}
                                </div>

                                <p className="text-[11px] text-slate-400 mt-4">
                                    Solo aparecen plantillas con estado <strong>Aprobada</strong>. Si no seleccionas ninguna, el sistema usará el mensaje de texto predeterminado.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
