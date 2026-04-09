'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Plus, Search, Trash2, GitBranch, Power, PowerOff, ArrowRight,
    ChevronDown, ChevronUp, HelpCircle, Zap, MessageSquare, ShoppingCart,
    Clock, Globe, Bell, BellOff, CheckCircle2, Pencil, X, Save
} from 'lucide-react'
import { getFlows, deleteFlow, updateFlow, type ConversationFlow } from './actions'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import FlowTemplates from './FlowTemplates'
import { createClient } from '@/utils/supabase/client'
import { COMMON_TIMEZONES } from '@/lib/timezone-utils'
import { toast } from 'sonner'

type PageTab = 'flows' | 'automations'

type TargetType = 'subscriptions_expiring' | 'all_contacts' | 'tagged_contacts'

type AutomationJob = {
    id: string
    name: string
    template_name: string
    template_params: any[]
    hour: number
    timezone: string
    trigger_days_before: number
    target_type: TargetType
    target_config: Record<string, any>
    is_active: boolean
    last_run_at: string | null
    created_at: string
}

type MetaTemplate = {
    id: string
    name: string
    status: string
    components: Array<{ type: string; text?: string; format?: string }>
}

const TARGET_TYPE_OPTIONS: { value: TargetType; label: string; desc: string }[] = [
    { value: 'all_contacts', label: 'Todos los contactos', desc: 'Enviar a todos los chats registrados' },
    { value: 'subscriptions_expiring', label: 'Suscripciones por vencer', desc: 'Solo clientes cuya suscripción vence en X días' },
    { value: 'tagged_contacts', label: 'Contactos con etiqueta', desc: 'Solo contactos que tengan etiquetas específicas' },
]

const EMPTY_JOB = {
    name: '',
    template_name: '',
    template_params: [] as { label: string; value: string }[],
    hour: 9,
    timezone: 'America/La_Paz',
    trigger_days_before: 1,
    target_type: 'all_contacts' as TargetType,
    target_config: {} as Record<string, any>,
    is_active: true,
}

// ── Automation Form Modal ──────────────────────────────────────────────────────

function AutomationModal({
    job,
    templates,
    onSave,
    onClose,
}: {
    job?: AutomationJob | null
    templates: MetaTemplate[]
    onSave: (data: typeof EMPTY_JOB) => Promise<void>
    onClose: () => void
}) {
    const [form, setForm] = useState(job ? {
        name: job.name,
        template_name: job.template_name,
        template_params: job.template_params || [],
        hour: job.hour,
        timezone: job.timezone,
        trigger_days_before: job.trigger_days_before,
        target_type: (job.target_type || 'all_contacts') as TargetType,
        target_config: job.target_config || {},
        is_active: job.is_active,
    } : { ...EMPTY_JOB })
    const [saving, setSaving] = useState(false)

    const selectedTpl = templates.find(t => t.name === form.template_name)
    // Extraer parámetros del body de la plantilla (variables {{1}}, {{2}}, etc.)
    const bodyText = selectedTpl?.components.find(c => c.type === 'BODY')?.text || ''
    const varMatches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)]
    const varCount = varMatches.length

    // Sincronizar template_params cuando cambia la plantilla
    const handleTemplateChange = (name: string) => {
        const tpl = templates.find(t => t.name === name)
        const body = tpl?.components.find(c => c.type === 'BODY')?.text || ''
        const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)]
        const params = matches.map((_, i) => ({
            label: `Variable ${i + 1}`,
            value: form.template_params[i]?.value || '',
        }))
        setForm(p => ({ ...p, template_name: name, template_params: params }))
    }

    const handleSubmit = async () => {
        if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
        if (!form.template_name) { toast.error('Selecciona una plantilla'); return }
        setSaving(true)
        try { await onSave(form) }
        finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08]">
                    <h2 className="font-bold text-[#0F172A] text-base">
                        {job ? 'Editar automatización' : 'Nueva automatización'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Nombre */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nombre</label>
                        <Input
                            placeholder="Ej: Recordatorio 7 días antes"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                        />
                    </div>

                    {/* Plantilla */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Plantilla Meta aprobada</label>
                        <Select value={form.template_name || '_none'} onValueChange={v => handleTemplateChange(v === '_none' ? '' : v)}>
                            <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-10 rounded-lg">
                                <SelectValue placeholder="Selecciona una plantilla" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none" className="text-slate-400">— Selecciona —</SelectItem>
                                {templates.map(t => (
                                    <SelectItem key={t.id} value={t.name}>
                                        <span className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                            {t.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedTpl && (
                            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{bodyText}</p>
                        )}
                    </div>

                    {/* Parámetros dinámicos */}
                    {varCount > 0 && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                                Variables de la plantilla
                            </label>
                            <div className="space-y-2">
                                {Array.from({ length: varCount }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 w-20 shrink-0">{`{{${i + 1}}}`}</span>
                                        <Input
                                            placeholder={`Valor o variable — ej: {{contact.name}}`}
                                            value={form.template_params[i]?.value || ''}
                                            onChange={e => {
                                                const updated = [...form.template_params]
                                                updated[i] = { label: `Variable ${i + 1}`, value: e.target.value }
                                                setForm(p => ({ ...p, template_params: updated }))
                                            }}
                                            className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm h-8"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                                Puedes usar: <code className="bg-slate-100 px-1 rounded">{'{{contact.name}}'}</code>{' '}
                                <code className="bg-slate-100 px-1 rounded">{'{{subscription.expires_at}}'}</code>{' '}
                                <code className="bg-slate-100 px-1 rounded">{'{{subscription.service}}'}</code>
                            </p>
                        </div>
                    )}

                    {/* Audiencia */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">A quién enviar</label>
                        <div className="space-y-2">
                            {TARGET_TYPE_OPTIONS.map(opt => (
                                <label key={opt.value}
                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                        form.target_type === opt.value
                                            ? 'border-[#25D366] bg-emerald-50/50'
                                            : 'border-black/[0.08] bg-[#F7F8FA] hover:border-black/[0.15]'
                                    }`}>
                                    <input type="radio" name="target_type" value={opt.value}
                                        checked={form.target_type === opt.value}
                                        onChange={() => setForm(p => ({ ...p, target_type: opt.value }))}
                                        className="mt-0.5 accent-[#25D366]" />
                                    <div>
                                        <p className="text-sm font-semibold text-[#0F172A]">{opt.label}</p>
                                        <p className="text-[11px] text-slate-400">{opt.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Tags (solo si target_type es tagged_contacts) */}
                    {form.target_type === 'tagged_contacts' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Etiquetas (separadas por coma)</label>
                            <Input
                                placeholder="vip, lead-nuevo, interesado"
                                value={(form.target_config.tags || []).join(', ')}
                                onChange={e => setForm(p => ({
                                    ...p,
                                    target_config: { ...p.target_config, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }
                                }))}
                                className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Se envía a contactos que tengan al menos una de estas etiquetas</p>
                        </div>
                    )}

                    {/* Días antes del vencimiento (solo para suscripciones) */}
                    {form.target_type === 'subscriptions_expiring' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Días antes del vencimiento</label>
                            <Input
                                type="number"
                                min={-30}
                                max={30}
                                value={form.trigger_days_before}
                                onChange={e => setForm(p => ({ ...p, trigger_days_before: parseInt(e.target.value) || 0 }))}
                                className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-center font-bold"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                                {form.trigger_days_before > 0
                                    ? `${form.trigger_days_before} día(s) antes`
                                    : form.trigger_days_before === 0
                                        ? 'El mismo día del vencimiento'
                                        : `${Math.abs(form.trigger_days_before)} día(s) después`}
                            </p>
                        </div>
                    )}

                    {/* Cuándo enviar */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                                <Clock size={11} /> Hora de envío
                            </label>
                            <Input
                                type="number"
                                min={0}
                                max={23}
                                value={form.hour}
                                onChange={e => setForm(p => ({ ...p, hour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) }))}
                                className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-center font-bold"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">{String(form.hour).padStart(2, '0')}:00 hrs</p>
                        </div>
                    </div>

                    {/* Zona horaria */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <Globe size={11} /> Zona horaria
                        </label>
                        <Select value={form.timezone} onValueChange={v => setForm(p => ({ ...p, timezone: v }))}>
                            <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-10 rounded-lg text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COMMON_TIMEZONES.map(tz => (
                                    <SelectItem key={tz.value} value={tz.value} className="text-sm">{tz.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Activo */}
                    <div className="flex items-center justify-between p-4 bg-[#F7F8FA] rounded-xl border border-black/[0.06]">
                        <div>
                            <p className="text-sm font-semibold text-[#0F172A]">Activar automatización</p>
                            <p className="text-xs text-slate-400">Cuando está activa se ejecuta automáticamente</p>
                        </div>
                        <label className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={form.is_active}
                                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                                <div className={`w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3 justify-end">
                    <Button onClick={onClose} className="bg-transparent text-slate-500 hover:bg-slate-100 border border-black/[0.08]">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}
                        className="bg-[#0F172A] hover:bg-[#1E293B] text-white gap-2 rounded-xl">
                        <Save size={14} />
                        {saving ? 'Guardando...' : job ? 'Guardar cambios' : 'Crear automatización'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FlowsPage() {
    const params = useParams()
    const router = useRouter()
    const assistantId = params.assistantId as string

    // Flows tab
    const [flows, setFlows] = useState<ConversationFlow[]>([])
    const [search, setSearch] = useState('')
    const [isPending, startTransition] = useTransition()
    const [showHelp, setShowHelp] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)

    // Automations tab
    const [pageTab, setPageTab] = useState<PageTab>('flows')
    const [automations, setAutomations] = useState<AutomationJob[]>([])
    const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
    const [loadingAuto, setLoadingAuto] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingJob, setEditingJob] = useState<AutomationJob | null>(null)

    useEffect(() => { loadFlows() }, [])
    useEffect(() => {
        if (pageTab === 'automations') {
            loadAutomations()
            loadMetaTemplates()
        }
    }, [pageTab])

    const loadFlows = async () => {
        const data = await getFlows()
        setFlows(data)
    }

    const loadAutomations = async () => {
        setLoadingAuto(true)
        try {
            const supabase = createClient()
            const { data } = await supabase
                .from('automation_jobs')
                .select('*')
                .order('created_at', { ascending: false })
            setAutomations(data || [])
        } catch { toast.error('Error al cargar automatizaciones') }
        finally { setLoadingAuto(false) }
    }

    const loadMetaTemplates = async () => {
        try {
            const res = await fetch('/api/meta-templates')
            const data = await res.json()
            setMetaTemplates((data.templates || []).filter((t: MetaTemplate) => t.status === 'APPROVED'))
        } catch { }
    }

    const handleSaveAutomation = async (form: typeof EMPTY_JOB) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error('No autenticado'); return }

        if (editingJob) {
            const { error } = await supabase
                .from('automation_jobs')
                .update({ ...form, updated_at: new Date().toISOString() })
                .eq('id', editingJob.id)
            if (error) { toast.error('Error al guardar'); return }
            toast.success('Automatización actualizada')
        } else {
            const { error } = await supabase
                .from('automation_jobs')
                .insert({ ...form, user_id: user.id })
            if (error) { toast.error('Error al crear'); return }
            toast.success('Automatización creada')
        }

        setModalOpen(false)
        setEditingJob(null)
        await loadAutomations()
    }

    const handleDeleteAuto = async (id: string) => {
        if (!confirm('¿Eliminar esta automatización?')) return
        const supabase = createClient()
        await supabase.from('automation_jobs').delete().eq('id', id)
        toast.success('Eliminada')
        await loadAutomations()
    }

    const handleToggleAuto = async (job: AutomationJob) => {
        const supabase = createClient()
        await supabase.from('automation_jobs').update({ is_active: !job.is_active }).eq('id', job.id)
        await loadAutomations()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar este flujo? Se borrarán todos los nodos y conexiones.')) return
        startTransition(async () => {
            await deleteFlow(id)
            loadFlows()
        })
    }

    const handleToggleActive = async (flow: ConversationFlow) => {
        startTransition(async () => {
            await updateFlow(flow.id, { is_active: !flow.is_active })
            loadFlows()
        })
    }

    const filtered = flows.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.description?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-8 max-w-7xl mx-auto text-[#0F172A] space-y-6">

            {/* Modal */}
            {modalOpen && (
                <AutomationModal
                    job={editingJob}
                    templates={metaTemplates}
                    onSave={handleSaveAutomation}
                    onClose={() => { setModalOpen(false); setEditingJob(null) }}
                />
            )}

            {/* Templates Modal */}
            {showTemplates && (
                <FlowTemplates
                    assistantId={assistantId}
                    onStartBlank={() => {
                        setShowTemplates(false)
                        router.push(`/dashboard/assistants/${assistantId}/flows/new`)
                    }}
                    onClose={() => setShowTemplates(false)}
                />
            )}

            {/* ── Page Tabs ── */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-white rounded-xl border border-black/[0.08] p-1 shadow-sm">
                    {([
                        { id: 'flows' as PageTab, label: 'Conversaciones', icon: <GitBranch size={15} /> },
                        { id: 'automations' as PageTab, label: 'Automatizaciones', icon: <Zap size={15} /> },
                    ]).map(t => (
                        <button
                            key={t.id}
                            onClick={() => setPageTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                pageTab === t.id
                                    ? 'bg-[#0F172A] text-white shadow-sm'
                                    : 'text-slate-500 hover:text-[#0F172A] hover:bg-slate-50'
                            }`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {pageTab === 'flows' && (
                    <Button onClick={() => setShowTemplates(true)}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 rounded-xl px-5 py-2.5 font-semibold">
                        <Plus size={18} /> Nuevo Flujo
                    </Button>
                )}
                {pageTab === 'automations' && (
                    <Button onClick={() => { setEditingJob(null); setModalOpen(true) }}
                        className="bg-[#25D366] hover:bg-[#20B858] text-white gap-2 rounded-xl px-5 py-2.5 font-semibold">
                        <Plus size={18} /> Nueva Automatización
                    </Button>
                )}
            </div>

            {/* ══════════════════════════════════════════ */}
            {/* TAB: CONVERSACIONES                        */}
            {/* ══════════════════════════════════════════ */}
            {pageTab === 'flows' && (
                <>
                    {/* Info Card */}
                    <div className="rounded-[14px] border border-cyan-500/25 bg-cyan-500/[0.04] overflow-hidden">
                        <button onClick={() => setShowHelp(v => !v)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 bg-transparent border-none cursor-pointer text-left">
                            <HelpCircle size={16} className="text-cyan-600 shrink-0" />
                            <span className="flex-1 font-semibold text-sm text-[#0F172A]">¿Qué son las Conversaciones Guiadas?</span>
                            {showHelp ? <ChevronUp size={16} className="text-cyan-600" /> : <ChevronDown size={16} className="text-cyan-600" />}
                        </button>
                        {showHelp && (
                            <div className="px-5 pb-5 space-y-4">
                                <p className="text-sm text-[#0F172A]/65 leading-relaxed">
                                    Un flujo es una <strong>conversación diseñada por ti, paso a paso</strong>, que tu bot sigue automáticamente.
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { icon: <ShoppingCart size={18} />, title: 'Flujo de Ventas', desc: 'Guía al cliente desde el interés hasta la compra.' },
                                        { icon: <MessageSquare size={18} />, title: 'Flujo de Soporte', desc: 'Responde preguntas frecuentes automáticamente.' },
                                        { icon: <Zap size={18} />, title: 'Flujo Automatizado', desc: 'Envía plantillas y mensajes programados.' },
                                    ].map((item, i) => (
                                        <div key={i} className="bg-white border border-black/[0.07] rounded-xl p-3">
                                            <div className="text-cyan-600 mb-2">{item.icon}</div>
                                            <p className="font-bold text-xs text-[#0F172A] mb-1">{item.title}</p>
                                            <p className="text-[11px] text-[#0F172A]/50 leading-relaxed">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input placeholder="Buscar flujos..." value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-10 bg-white border-black/[0.08] rounded-xl text-[#0F172A]" />
                    </div>

                    {/* Flows List */}
                    {filtered.length === 0 ? (
                        <div className="bg-[#F7F8FA] border border-black/[0.08] rounded-2xl text-center py-12 px-6">
                            <GitBranch size={48} className="text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg">No hay conversaciones guiadas</p>
                            <p className="text-slate-400 text-sm mt-1 mb-5">Crea tu primer flujo para guiar a tus clientes automáticamente</p>
                            <Button onClick={() => setShowTemplates(true)}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 rounded-xl px-6 py-2.5 font-semibold mx-auto">
                                <Plus size={18} /> Crear mi primer flujo
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filtered.map(flow => (
                                <Card key={flow.id} className={`bg-white rounded-2xl transition-all ${flow.is_active ? 'border-green-400/40' : 'border-black/[0.08]'}`}>
                                    <CardContent className="p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                                                flow.is_active ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-100 border-black/[0.08]'
                                            }`}>
                                                <GitBranch size={22} className={flow.is_active ? 'text-green-500' : 'text-slate-400'} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-[#0F172A] text-base">{flow.name}</h3>
                                                {flow.description && <p className="text-slate-400 text-sm mt-0.5">{flow.description}</p>}
                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border mt-1.5 inline-block ${
                                                    flow.is_active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-400 border-black/[0.06]'
                                                }`}>
                                                    {flow.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <Button onClick={() => handleToggleActive(flow)}
                                                className={`h-9 w-9 p-0 bg-transparent ${flow.is_active ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                                                {flow.is_active ? <Power size={18} /> : <PowerOff size={18} />}
                                            </Button>
                                            <Link href={`/dashboard/assistants/${assistantId}/flows/${flow.id}`}>
                                                <Button className="bg-transparent text-cyan-600 hover:bg-cyan-50 gap-1.5 text-sm rounded-xl px-3">
                                                    Editar <ArrowRight size={14} />
                                                </Button>
                                            </Link>
                                            <Button onClick={() => handleDelete(flow.id)}
                                                className="h-9 w-9 p-0 bg-transparent text-red-400 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 size={18} />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ══════════════════════════════════════════ */}
            {/* TAB: AUTOMATIZACIONES                      */}
            {/* ══════════════════════════════════════════ */}
            {pageTab === 'automations' && (
                <div className="space-y-4">
                    {/* Info banner */}
                    <div className="rounded-[14px] border border-[#25D366]/20 bg-[#25D366]/[0.04] px-5 py-4 flex items-start gap-3">
                        <Zap size={18} className="text-[#25D366] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-[#0F172A]">Automatizaciones de plantillas</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                Envía cualquier plantilla Meta aprobada automáticamente según el número de días antes o después del vencimiento de una suscripción.
                                Cada automatización corre de forma independiente — puedes crear tantas como necesites.
                            </p>
                        </div>
                    </div>

                    {/* Lista */}
                    {loadingAuto ? (
                        <div className="text-center py-12 text-slate-400 text-sm">Cargando automatizaciones...</div>
                    ) : automations.length === 0 ? (
                        <div className="bg-[#F7F8FA] border border-black/[0.08] rounded-2xl text-center py-14 px-6">
                            <Zap size={48} className="text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg font-semibold">Sin automatizaciones</p>
                            <p className="text-slate-400 text-sm mt-1 mb-6">Crea tu primera automatización para enviar plantillas Meta automáticamente</p>
                            <Button onClick={() => { setEditingJob(null); setModalOpen(true) }}
                                className="bg-[#25D366] hover:bg-[#20B858] text-white gap-2 rounded-xl px-6 font-semibold mx-auto">
                                <Plus size={18} /> Nueva automatización
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {automations.map(job => (
                                <div key={job.id} className={`bg-white rounded-2xl border p-5 flex items-center gap-4 transition-all ${
                                    job.is_active ? 'border-[#25D366]/30' : 'border-black/[0.08]'
                                }`}>
                                    {/* Status dot */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                                        job.is_active ? 'bg-[#25D366]/10 border-[#25D366]/30' : 'bg-slate-100 border-black/[0.08]'
                                    }`}>
                                        {job.is_active ? <Bell size={18} className="text-[#25D366]" /> : <BellOff size={18} className="text-slate-400" />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-[#0F172A] text-sm">{job.name}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                job.is_active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-400 border-black/[0.06]'
                                            }`}>
                                                {job.is_active ? 'Activa' : 'Pausada'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <CheckCircle2 size={11} className="text-emerald-500" />
                                                {job.template_name}
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Clock size={11} />
                                                {String(job.hour).padStart(2, '0')}:00 hs
                                            </span>
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                                                {TARGET_TYPE_OPTIONS.find(t => t.value === (job.target_type || 'all_contacts'))?.label || job.target_type}
                                            </span>
                                            {job.target_type === 'subscriptions_expiring' && (
                                                <span className="text-xs text-slate-400">
                                                    {job.trigger_days_before > 0
                                                        ? `${job.trigger_days_before}d antes del vencimiento`
                                                        : job.trigger_days_before === 0
                                                            ? 'El día del vencimiento'
                                                            : `${Math.abs(job.trigger_days_before)}d después del vencimiento`}
                                                </span>
                                            )}
                                            {job.last_run_at && (
                                                <span className="text-[11px] text-slate-400">
                                                    Último envío: {new Date(job.last_run_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1.5 items-center shrink-0">
                                        <button
                                            onClick={() => handleToggleAuto(job)}
                                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                                                job.is_active ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'
                                            }`}
                                            title={job.is_active ? 'Pausar' : 'Activar'}
                                        >
                                            {job.is_active ? <Power size={15} /> : <PowerOff size={15} />}
                                        </button>
                                        <button
                                            onClick={() => { setEditingJob(job); setModalOpen(true) }}
                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-cyan-500 hover:bg-cyan-50 transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAuto(job.id)}
                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
