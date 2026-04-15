'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import NextImage from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    X, Plus, Loader2, ImagePlus, FileVideo, FileText as FileDoc,
    MapPin, Bold, Italic, Hash, Phone, Link2, MessageSquare,
    CheckCircle2, AlertCircle, Upload, Trash2
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION'
export type UrlType = 'STATIC' | 'DYNAMIC'

export type QuickReplyBtn  = { id: string; kind: 'QUICK_REPLY'; text: string }
export type PhoneBtn       = { id: string; kind: 'PHONE_NUMBER'; text: string; phone: string }
export type UrlBtn         = { id: string; kind: 'URL'; text: string; url: string; urlType: UrlType }
export type TemplateBtn    = QuickReplyBtn | PhoneBtn | UrlBtn

export interface TemplateFormState {
    name: string
    category: TemplateCategory
    language: string
    // Header
    headerFormat: HeaderFormat
    headerText: string
    headerTextExample: string   // sample for {{1}} in header text
    headerFile: File | null
    headerHandle: string        // h_xxx returned by Meta upload
    headerPreview: string
    // Body
    body: string
    bodyExamples: string[]      // one per {{n}} variable
    // Footer
    footer: string
    // Buttons
    buttons: TemplateBtn[]
}

type CustomFieldDefinition = { field_name: string; description: string | null }
type ApiResponse = { error?: string }
type UploadImageResponse = ApiResponse & { handle?: string }
type MetaTemplateResponse = ApiResponse
type MediaHeaderFormat = Extract<HeaderFormat, 'IMAGE' | 'VIDEO' | 'DOCUMENT'>
type TextHeaderComponent = { type: 'HEADER'; format: 'TEXT'; text: string; example?: { header_text: string[] } }
type MediaHeaderComponent = { type: 'HEADER'; format: MediaHeaderFormat; example: { header_handle: string[] } }
type LocationHeaderComponent = { type: 'HEADER'; format: 'LOCATION' }
type BodyComponent = { type: 'BODY'; text: string; example?: { body_text: string[][] } }
type FooterComponent = { type: 'FOOTER'; text: string }
type QuickReplyButtonComponent = { type: 'QUICK_REPLY'; text: string }
type PhoneButtonComponent = { type: 'PHONE_NUMBER'; text: string; phone_number: string }
type UrlButtonComponent = { type: 'URL'; text: string; url: string; example?: string[] }
type ButtonComponent = QuickReplyButtonComponent | PhoneButtonComponent | UrlButtonComponent
type ButtonsComponent = { type: 'BUTTONS'; buttons: ButtonComponent[] }
type TemplateComponent =
    | TextHeaderComponent
    | MediaHeaderComponent
    | LocationHeaderComponent
    | BodyComponent
    | FooterComponent
    | ButtonsComponent
type ButtonPatch = Partial<QuickReplyBtn> | Partial<PhoneBtn> | Partial<UrlBtn>

const EMPTY: TemplateFormState = {
    name: '', category: 'MARKETING', language: 'es_LA',
    headerFormat: 'NONE', headerText: '', headerTextExample: '',
    headerFile: null, headerHandle: '', headerPreview: '',
    body: '', bodyExamples: [],
    footer: '',
    buttons: [],
}

const LANGUAGES = [
    { value: 'es_LA', label: 'Español (Latinoamérica)' },
    { value: 'es_ES', label: 'Español (España)' },
    { value: 'es',    label: 'Español (genérico)' },
    { value: 'en_US', label: 'Inglés (EE. UU.)' },
    { value: 'en',    label: 'Inglés (genérico)' },
    { value: 'pt_BR', label: 'Portugués (Brasil)' },
]

const HEADER_OPTIONS: { value: HeaderFormat; label: string; icon: React.ReactNode }[] = [
    { value: 'NONE',     label: 'Ninguno',    icon: <X size={14}/> },
    { value: 'TEXT',     label: 'Texto',       icon: <span className="text-xs font-bold">T</span> },
    { value: 'IMAGE',    label: 'Imagen',      icon: <ImagePlus size={14}/> },
    { value: 'VIDEO',    label: 'Video',       icon: <FileVideo size={14}/> },
    { value: 'DOCUMENT', label: 'Documento',   icon: <FileDoc size={14}/> },
    { value: 'LOCATION', label: 'Ubicación',   icon: <MapPin size={14}/> },
]

const ACCEPT: Record<string, string> = {
    IMAGE:    'image/jpeg,image/png,image/webp',
    VIDEO:    'video/mp4,video/3gpp',
    DOCUMENT: 'application/pdf',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectVars(text: string): number[] {
    const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)]
    const nums = [...new Set(matches.map(m => parseInt(m[1])))].sort((a, b) => a - b)
    return nums
}

function isMediaHeaderFormat(format: HeaderFormat): format is MediaHeaderFormat {
    return format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT'
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

function insertAtCursor(
    ref: React.RefObject<HTMLTextAreaElement | null>,
    before: string,
    after = '',
    setter: (v: string) => void
) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = el.value.slice(start, end)
    const newVal = el.value.slice(0, start) + before + selected + after + el.value.slice(end)
    setter(newVal)
    requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</span>
            <div className="flex-1 h-px bg-[#F7F8FA]" />
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
    onSuccess: () => void
    onCancel: () => void
}

export default function MetaTemplateBuilder({ onSuccess, onCancel }: Props) {
    const [form, setForm] = useState<TemplateFormState>({ ...EMPTY })
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([])
    const fileRef = useRef<HTMLInputElement>(null)
    const bodyRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        fetch('/api/custom-fields').then(r => r.json()).then(d => setCustomFieldDefs(d.fields || [])).catch(() => {})
    }, [])

    // Keep bodyExamples array in sync with detected variables
    useEffect(() => {
        const vars = detectVars(form.body)
        setForm(prev => {
            const examples = vars.map((_, i) => prev.bodyExamples[i] ?? '')
            return { ...prev, bodyExamples: examples }
        })
    }, [form.body])

    const set = useCallback(<K extends keyof TemplateFormState>(key: K, val: TemplateFormState[K]) =>
        setForm(prev => ({ ...prev, [key]: val })), [])

    // ── File upload ──────────────────────────────────────────────────────────

    const uploadFile = async (file: File) => {
        setUploading(true)
        set('headerPreview', URL.createObjectURL(file))
        set('headerHandle', '')
        set('headerFile', file)
        try {
            const fd = new FormData()
            fd.append('image', file)
            const res = await fetch('/api/meta-templates/upload-image', { method: 'POST', body: fd })
            const data = await res.json() as UploadImageResponse
            if (!res.ok) throw new Error(data.error || 'Error subiendo archivo')
            if (!data.handle) throw new Error('Meta no devolvió el identificador del archivo')
            set('headerHandle', data.handle)
            toast.success('Archivo listo ✓')
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error subiendo archivo'))
            set('headerPreview', '')
            set('headerFile', null)
        } finally {
            setUploading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (f) uploadFile(f)
        e.target.value = ''
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) uploadFile(f)
    }

    const clearMedia = () => {
        set('headerFile', null)
        set('headerHandle', '')
        set('headerPreview', '')
    }

    // ── Body toolbar ─────────────────────────────────────────────────────────

    const insertBold   = () => insertAtCursor(bodyRef, '*', '*', v => set('body', v))
    const insertItalic = () => insertAtCursor(bodyRef, '_', '_', v => set('body', v))
    const insertVar    = () => {
        const vars = detectVars(form.body)
        const next = (vars.length > 0 ? Math.max(...vars) : 0) + 1
        insertAtCursor(bodyRef, `{{${next}}}`, '', v => set('body', v))
    }

    // ── Buttons ──────────────────────────────────────────────────────────────

    const addButton = (kind: TemplateBtn['kind']) => {
        if (form.buttons.length >= 10) return
        const id = crypto.randomUUID()
        const base = { id, kind, text: '' }
        const btn: TemplateBtn =
            kind === 'QUICK_REPLY'   ? { ...base, kind: 'QUICK_REPLY' } :
            kind === 'PHONE_NUMBER'  ? { ...base, kind: 'PHONE_NUMBER', phone: '' } :
                                       { ...base, kind: 'URL', url: '', urlType: 'STATIC' }
        setForm(prev => ({ ...prev, buttons: [...prev.buttons, btn] }))
    }

    const updateBtn = (id: string, patch: ButtonPatch) =>
        setForm(prev => ({ ...prev, buttons: prev.buttons.map(b => b.id === id ? { ...b, ...patch } as TemplateBtn : b) }))

    const removeBtn = (id: string) =>
        setForm(prev => ({ ...prev, buttons: prev.buttons.filter(b => b.id !== id) }))

    const qrCount  = form.buttons.filter(b => b.kind === 'QUICK_REPLY').length
    const ctaCount = form.buttons.filter(b => b.kind !== 'QUICK_REPLY').length

    // ── Validation ───────────────────────────────────────────────────────────

    const validate = (): string | null => {
        const name = form.name.trim().toLowerCase().replace(/\s+/g, '_')
        if (!name) return 'El nombre es obligatorio'
        if (!/^[a-z0-9_]+$/.test(name)) return 'Nombre: solo minúsculas, números y guiones bajos'
        if (!form.body.trim()) return 'El cuerpo del mensaje es obligatorio'

        const vars = detectVars(form.body)
        for (let i = 0; i < vars.length; i++) {
            if (!form.bodyExamples[i]?.trim()) return `Escribe un ejemplo para la variable {{${vars[i]}}}`
        }

        if (form.headerFormat === 'TEXT') {
            if (!form.headerText.trim()) return 'Escribe el texto del encabezado'
            const hv = detectVars(form.headerText)
            if (hv.length > 1) return 'El encabezado de texto solo admite 1 variable {{1}}'
            if (hv.length === 1 && !form.headerTextExample.trim()) return 'Escribe un ejemplo para {{1}} en el encabezado'
        }

        if (isMediaHeaderFormat(form.headerFormat) && !form.headerHandle) {
            return 'Sube el archivo multimedia antes de continuar'
        }

        for (const btn of form.buttons) {
            if (!btn.text.trim()) return 'Todos los botones necesitan un texto'
            if (btn.kind === 'PHONE_NUMBER' && !(btn as PhoneBtn).phone.trim()) return 'El botón de teléfono necesita un número'
            if (btn.kind === 'URL' && !(btn as UrlBtn).url.trim()) return 'El botón de URL necesita una dirección'
        }

        return null
    }

    // ── Build payload ─────────────────────────────────────────────────────────

    const buildComponents = (): TemplateComponent[] => {
        const components: TemplateComponent[] = []

        // HEADER
        if (form.headerFormat === 'TEXT' && form.headerText.trim()) {
            const hv = detectVars(form.headerText)
            const comp: TextHeaderComponent = { type: 'HEADER', format: 'TEXT', text: form.headerText.trim() }
            if (hv.length > 0) comp.example = { header_text: [form.headerTextExample.trim()] }
            components.push(comp)
        } else if (isMediaHeaderFormat(form.headerFormat) && form.headerHandle) {
            components.push({ type: 'HEADER', format: form.headerFormat, example: { header_handle: [form.headerHandle] } })
        } else if (form.headerFormat === 'LOCATION') {
            components.push({ type: 'HEADER', format: 'LOCATION' })
        }

        // BODY
        const vars = detectVars(form.body)
        const bodyComp: BodyComponent = { type: 'BODY', text: form.body.trim() }
        if (vars.length > 0) {
            bodyComp.example = { body_text: [vars.map((_, i) => form.bodyExamples[i]?.trim() || `ejemplo${i + 1}`)] }
        }
        components.push(bodyComp)

        // FOOTER
        if (form.footer.trim()) components.push({ type: 'FOOTER', text: form.footer.trim() })

        // BUTTONS
        if (form.buttons.length > 0) {
            const buttons: ButtonComponent[] = form.buttons.map(b => {
                if (b.kind === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text }
                if (b.kind === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: (b as PhoneBtn).phone }
                const ub = b as UrlBtn
                const btn: UrlButtonComponent = { type: 'URL', text: ub.text, url: ub.url }
                if (ub.urlType === 'DYNAMIC') btn.example = [ub.url.replace(/\/$/, '') + '/ejemplo']
                return btn
            })
            components.push({ type: 'BUTTONS', buttons })
        }

        return components
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        const err = validate()
        if (err) { toast.error(err); return }

        const normalizedName = form.name.trim().toLowerCase().replace(/\s+/g, '_')
        setSubmitting(true)
        try {
            const res = await fetch('/api/meta-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: normalizedName,
                    category: form.category,
                    language: form.language,
                    components: buildComponents()
                })
            })
            const data = await res.json() as MetaTemplateResponse
            if (!res.ok) throw new Error(data.error || 'Error al crear la plantilla en Meta')
            toast.success('¡Plantilla enviada a Meta! Aparecerá en estado "Pendiente".')
            onSuccess()
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al crear la plantilla en Meta'))
        } finally {
            setSubmitting(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden mb-8">

            {/* ── Title bar ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] bg-[#F7F8FA]">
                <div>
                    <h2 className="text-lg font-semibold text-[#0F172A]">Nueva Plantilla de Meta</h2>
                    <p className="text-xs text-slate-500 mt-0.5">La plantilla se enviará a Meta y aparecerá abajo en estado &quot;Pendiente&quot;.</p>
                </div>
                <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F172A] hover:bg-[#F0F0F0] transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="p-6 space-y-8">

                {/* ══ 1. BASIC CONFIG ══════════════════════════════════════════ */}
                <div>
                    <SectionLabel>1 · Configuración básica</SectionLabel>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label className="text-[#0F172A] text-sm">Nombre <span className="text-red-400">*</span></Label>
                            <Input
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                placeholder="ej: recordatorio_pago"
                                className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] font-mono placeholder-[#0F172A]/35"
                            />
                            <p className="text-[11px] text-slate-500">Minúsculas, números y guiones bajos</p>
                        </div>
                        {/* Category */}
                        <div className="space-y-1.5">
                            <Label className="text-[#0F172A] text-sm">Categoría <span className="text-red-400">*</span></Label>
                            <Select value={form.category} onValueChange={v => set('category', v as TemplateCategory)}>
                                <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-black/[0.08]">
                                    <SelectItem value="MARKETING"      className="text-[#0F172A]">📣 Marketing</SelectItem>
                                    <SelectItem value="UTILITY"        className="text-[#0F172A]">🔧 Utilidad</SelectItem>
                                    <SelectItem value="AUTHENTICATION" className="text-[#0F172A]">🔐 Autenticación</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Language */}
                        <div className="space-y-1.5">
                            <Label className="text-[#0F172A] text-sm">Idioma <span className="text-red-400">*</span></Label>
                            <Select value={form.language} onValueChange={v => set('language', v)}>
                                <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-black/[0.08]">
                                    {LANGUAGES.map(l => (
                                        <SelectItem key={l.value} value={l.value} className="text-[#0F172A]">{l.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* ══ 2. HEADER ════════════════════════════════════════════════ */}
                <div>
                    <SectionLabel>2 · Encabezado</SectionLabel>

                    {/* Format selector */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {HEADER_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { set('headerFormat', opt.value); clearMedia() }}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    form.headerFormat === opt.value
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-[#F7F8FA] border-black/[0.08] text-slate-400 hover:text-[#0F172A] hover:border-black/[0.08]'
                                }`}
                            >
                                {opt.icon} {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* TEXT header */}
                    {form.headerFormat === 'TEXT' && (
                        <div className="space-y-3">
                            <Input
                                value={form.headerText}
                                onChange={e => set('headerText', e.target.value)}
                                placeholder="Texto del encabezado — puedes usar {{1}}"
                                maxLength={60}
                                className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                            />
                            <p className="text-[11px] text-slate-500">{form.headerText.length}/60 caracteres · máx. 1 variable {'{{1}}'}</p>
                            {detectVars(form.headerText).length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 shrink-0">{'Ejemplo para {{1}}:'}</span>
                                    <Input
                                        value={form.headerTextExample}
                                        onChange={e => set('headerTextExample', e.target.value)}
                                        placeholder="ej: Juan Pérez"
                                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-8 text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* MULTIMEDIA header (IMAGE / VIDEO / DOCUMENT) */}
                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) && (
                        <div>
                            <input
                                ref={fileRef}
                                type="file"
                                accept={ACCEPT[form.headerFormat] || '*'}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            {form.headerPreview ? (
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F7F8FA] border border-black/[0.08]">
                                    {form.headerFormat === 'IMAGE' ? (
                                        <NextImage src={form.headerPreview} alt="Vista previa del archivo" width={80} height={80} unoptimized className="w-20 h-20 object-cover rounded-lg border border-black/[0.08]" />
                                    ) : (
                                        <div className="w-20 h-20 rounded-lg border border-black/[0.08] bg-[#F7F8FA] flex items-center justify-center text-[#0F172A]">
                                            {form.headerFormat === 'VIDEO' ? <FileVideo size={32} /> : <FileDoc size={32} />}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[#0F172A] truncate">{form.headerFile?.name}</p>
                                        {uploading ? (
                                            <div className="flex items-center gap-2 text-amber-400 text-xs mt-1">
                                                <Loader2 size={12} className="animate-spin" /> Subiendo a Meta…
                                            </div>
                                        ) : form.headerHandle ? (
                                            <div className="flex items-center gap-2 text-emerald-400 text-xs mt-1">
                                                <CheckCircle2 size={12} /> Listo · handle: <span className="font-mono text-slate-400">{form.headerHandle.slice(0, 24)}…</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-red-400 text-xs mt-1">
                                                <AlertCircle size={12} /> Error al subir
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={clearMedia} className="text-slate-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-black/[0.08] hover:border-black/[0.15]'}`}
                                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <Upload size={28} className="text-slate-500" />
                                    <p className="text-sm text-slate-400">Arrastra el archivo o <span className="text-indigo-400 underline">haz clic para seleccionar</span></p>
                                    <p className="text-xs text-slate-600">
                                        {form.headerFormat === 'IMAGE'    ? 'JPG, PNG, WEBP' :
                                         form.headerFormat === 'VIDEO'    ? 'MP4, 3GPP' :
                                         'PDF'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* LOCATION header */}
                    {form.headerFormat === 'LOCATION' && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#F7F8FA] border border-black/[0.08] text-slate-400 text-sm">
                            <MapPin size={18} className="text-indigo-400 shrink-0" />
                            Meta enviará un marcador de ubicación. Las coordenadas se pasan al enviar el mensaje, no aquí.
                        </div>
                    )}
                </div>

                {/* ══ 3. BODY ══════════════════════════════════════════════════ */}
                <div>
                    <SectionLabel>3 · Cuerpo del mensaje <span className="text-red-400 ml-1">*</span></SectionLabel>

                    {/* Toolbar */}
                    <div className="flex items-center gap-1 mb-2">
                        <button type="button" onClick={insertBold}
                            className="p-1.5 rounded text-slate-400 hover:bg-[#F7F8FA] hover:text-[#0F172A] transition-colors" title="Negrita (*texto*)">
                            <Bold size={14} />
                        </button>
                        <button type="button" onClick={insertItalic}
                            className="p-1.5 rounded text-slate-400 hover:bg-[#F7F8FA] hover:text-[#0F172A] transition-colors" title="Cursiva (_texto_)">
                            <Italic size={14} />
                        </button>
                        <div className="w-px h-4 bg-slate-700 mx-1" />
                        <button type="button" onClick={insertVar}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-indigo-400 hover:bg-[#F7F8FA] hover:text-indigo-300 transition-colors font-mono" title="Insertar variable">
                            <Hash size={12} /> Insertar variable
                        </button>
                    </div>

                    <Textarea
                        ref={bodyRef}
                        value={form.body}
                        onChange={e => set('body', e.target.value)}
                        placeholder="Hola {{1}}, tu suscripción de *{{2}}* vence el _{{3}}_."
                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-32 font-mono text-sm resize-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">{form.body.length} caracteres · Usa *negrita*, _cursiva_, {'{{n}}'} variables</p>

                    {/* Dynamic variable examples */}
                    {detectVars(form.body).length > 0 && (
                        <div className="mt-3 p-4 rounded-xl bg-[#F7F8FA] border border-black/[0.08] space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ejemplos de variables (requerido por Meta)</p>
                            {detectVars(form.body).map((varNum, idx) => (
                                <div key={varNum} className="flex items-center gap-3">
                                    <span className="font-mono text-xs text-indigo-400 w-10 shrink-0">{`{{${varNum}}}`}</span>
                                    <Input
                                        value={form.bodyExamples[idx] ?? ''}
                                        onChange={e => {
                                            const arr = [...form.bodyExamples]
                                            arr[idx] = e.target.value
                                            set('bodyExamples', arr)
                                        }}
                                        placeholder={`Ej: ${varNum === 1 ? 'Juan' : varNum === 2 ? 'ChatGPT Plus' : '01/08/2025'}`}
                                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-8 text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Custom fields guide */}
                    {customFieldDefs.length > 0 && (
                        <div className="mt-3 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Variables de tu negocio</p>
                            <p className="text-[10px] text-emerald-500">
                                Al configurar automatizaciones, podr&aacute;s asignar estos campos a cada variable de la plantilla.
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {customFieldDefs.map(f => (
                                    <span
                                        key={f.field_name}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] text-emerald-700 font-medium"
                                    >
                                        <code className="font-mono text-[10px]">{`{{custom.${f.field_name}}}`}</code>
                                        <span className="text-emerald-300">—</span>
                                        {f.description || f.field_name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ══ 4. FOOTER ════════════════════════════════════════════════ */}
                <div>
                    <SectionLabel>4 · Pie de página <span className="text-slate-500 text-xs font-normal normal-case ml-1">(opcional)</span></SectionLabel>
                    <Input
                        value={form.footer}
                        onChange={e => set('footer', e.target.value)}
                        placeholder="Ej: Para cancelar responde STOP"
                        maxLength={60}
                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">{form.footer.length}/60 · Sin variables</p>
                </div>

                {/* ══ 5. BUTTONS ═══════════════════════════════════════════════ */}
                <div>
                    <SectionLabel>5 · Botones interactivos <span className="text-slate-500 text-xs font-normal normal-case ml-1">(opcional, máx. 10)</span></SectionLabel>

                    {/* Add buttons row */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <button type="button" onClick={() => addButton('QUICK_REPLY')}
                            disabled={form.buttons.length >= 10 || ctaCount > 0 && qrCount === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-800/50 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            <MessageSquare size={13} /> <Plus size={10} /> Respuesta Rápida
                        </button>
                        <button type="button" onClick={() => addButton('PHONE_NUMBER')}
                            disabled={form.buttons.length >= 10 || form.buttons.filter(b => b.kind === 'PHONE_NUMBER').length >= 1}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-800/50 bg-blue-900/20 text-blue-400 hover:bg-blue-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            <Phone size={13} /> <Plus size={10} /> Llamar
                        </button>
                        <button type="button" onClick={() => addButton('URL')}
                            disabled={form.buttons.length >= 10 || form.buttons.filter(b => b.kind === 'URL').length >= 2}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-800/50 bg-violet-900/20 text-violet-400 hover:bg-violet-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            <Link2 size={13} /> <Plus size={10} /> URL
                        </button>
                    </div>

                    {form.buttons.length === 0 && (
                        <p className="text-xs text-slate-600 italic">Sin botones. Puedes agregar hasta 3 Respuestas Rápidas, 1 botón de Llamada y 2 de URL.</p>
                    )}

                    <div className="space-y-3">
                        {form.buttons.map(btn => (
                            <div key={btn.id} className="p-4 rounded-xl bg-[#F7F8FA] border border-black/[0.08] space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                        btn.kind === 'QUICK_REPLY'  ? 'text-emerald-400 border-emerald-800/50 bg-emerald-900/20' :
                                        btn.kind === 'PHONE_NUMBER' ? 'text-blue-400 border-blue-800/50 bg-blue-900/20' :
                                                                      'text-violet-400 border-violet-800/50 bg-violet-900/20'
                                    }`}>
                                        {btn.kind === 'QUICK_REPLY'  ? <><MessageSquare size={11}/> Respuesta Rápida</> :
                                         btn.kind === 'PHONE_NUMBER' ? <><Phone size={11}/> Llamar</> :
                                                                       <><Link2 size={11}/> URL</>}
                                    </span>
                                    <button onClick={() => removeBtn(btn.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={15} />
                                    </button>
                                </div>

                                {/* Quick Reply */}
                                {btn.kind === 'QUICK_REPLY' && (
                                    <Input
                                        value={btn.text}
                                        onChange={e => updateBtn(btn.id, { text: e.target.value })}
                                        placeholder="Texto del botón (máx. 25 caracteres)"
                                        maxLength={25}
                                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                                    />
                                )}

                                {/* Phone */}
                                {btn.kind === 'PHONE_NUMBER' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            value={btn.text}
                                            onChange={e => updateBtn(btn.id, { text: e.target.value })}
                                            placeholder="Texto del botón"
                                            maxLength={25}
                                            className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                                        />
                                        <Input
                                            value={(btn as PhoneBtn).phone}
                                            onChange={e => updateBtn(btn.id, { phone: e.target.value })}
                                            placeholder="+591 70000000"
                                            className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] font-mono"
                                        />
                                    </div>
                                )}

                                {/* URL */}
                                {btn.kind === 'URL' && (() => {
                                    const ub = btn as UrlBtn
                                    return (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                    value={ub.text}
                                                    onChange={e => updateBtn(btn.id, { text: e.target.value })}
                                                    placeholder="Texto del botón"
                                                    maxLength={25}
                                                    className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                                                />
                                                <Select value={ub.urlType} onValueChange={v => updateBtn(btn.id, { urlType: v as UrlType })}>
                                                    <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white border-black/[0.08]">
                                                        <SelectItem value="STATIC"  className="text-[#0F172A]">URL Estática</SelectItem>
                                                        <SelectItem value="DYNAMIC" className="text-[#0F172A]">{'URL Dinámica ({{1}})'}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Input
                                                value={ub.url}
                                                onChange={e => updateBtn(btn.id, { url: e.target.value })}
                                                placeholder={ub.urlType === 'DYNAMIC' ? 'https://jabachat.com/perfil/' : 'https://jabachat.com'}
                                                className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] font-mono text-sm"
                                            />
                                            {ub.urlType === 'DYNAMIC' && (
                                                <p className="text-[11px] text-indigo-400">Meta añadirá el valor dinámico al final de la URL al enviar el mensaje.</p>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ══ PREVIEW STRIP ════════════════════════════════════════════ */}
                {(form.body || form.buttons.length > 0) && (
                    <div>
                        <SectionLabel>Vista previa aproximada</SectionLabel>
                        <div className="max-w-sm bg-[#075e54] rounded-2xl p-1 shadow-xl">
                            <div className="bg-[#dcf8c6] rounded-xl p-3 space-y-1 text-sm text-slate-800">
                                {form.headerFormat === 'TEXT' && form.headerText && (
                                    <p className="font-bold text-slate-900">{form.headerText}</p>
                                )}
                                {form.headerFormat === 'IMAGE' && form.headerPreview && (
                                    <NextImage src={form.headerPreview} alt="" width={320} height={128} unoptimized className="rounded-lg w-full object-cover max-h-32" />
                                )}
                                {form.headerFormat === 'LOCATION' && (
                                    <div className="flex items-center gap-1 text-slate-600 text-xs"><MapPin size={12}/> Ubicación adjunta</div>
                                )}
                                {form.body && <p className="whitespace-pre-wrap text-xs">{form.body}</p>}
                                {form.footer && <p className="text-[10px] text-slate-500 italic">{form.footer}</p>}
                                {form.buttons.length > 0 && (
                                    <div className="border-t border-slate-300 pt-2 mt-1 space-y-1">
                                        {form.buttons.map(b => (
                                            <div key={b.id} className="text-center text-xs font-medium text-[#128c7e] py-1 border border-[#128c7e]/30 rounded-lg bg-white/60">
                                                {b.kind === 'PHONE_NUMBER' ? `📞 ${b.text}` : b.kind === 'URL' ? `🔗 ${b.text}` : `↩ ${b.text}`}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Actions ── */}
                <div className="flex justify-end gap-3 pt-4 border-t border-black/[0.08]">
                    <Button type="button" onClick={onCancel} className="bg-transparent hover:bg-[#F7F8FA] text-slate-400 hover:text-[#0F172A]">
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || uploading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-[180px]"
                    >
                        {submitting
                            ? <><Loader2 size={15} className="animate-spin" /> Enviando a Meta…</>
                            : 'Crear Plantilla en Meta'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
