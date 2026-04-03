'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { X, ArrowLeft, ArrowRight, Send, Loader2, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Variable mapping system ─────────────────────────────────────────────────

interface VariableMapping {
    position: number
    label: string
    icon: string
    example: string
}

const VARIABLE_MAPPINGS: Record<string, VariableMapping[]> = {
    renovacion: [
        { position: 1, label: 'Nombre del cliente', icon: '👤', example: 'Juan' },
        { position: 2, label: 'Servicio', icon: '📦', example: 'Netflix Premium' },
        { position: 3, label: 'Días restantes', icon: '📅', example: '7' },
    ],
    bienvenida: [
        { position: 1, label: 'Nombre del cliente', icon: '👤', example: 'Juan' },
        { position: 2, label: 'Servicio', icon: '📦', example: 'Netflix Premium' },
        { position: 3, label: 'Correo/Usuario', icon: '📧', example: 'usuario@email.com' },
        { position: 4, label: 'Contraseña', icon: '🔑', example: 'Pass2024!' },
    ],
    seguimiento: [
        { position: 1, label: 'Nombre del cliente', icon: '👤', example: 'Juan' },
        { position: 2, label: 'Servicio', icon: '📦', example: 'Netflix Premium' },
    ],
    personalizada: [
        { position: 1, label: 'Nombre del cliente', icon: '👤', example: 'Juan' },
    ],
}

// ─── Template purposes ───────────────────────────────────────────────────────

const PURPOSES = [
    {
        id: 'renovacion',
        label: 'Renovación',
        emoji: '🔄',
        desc: 'Avisa a clientes que su suscripción está por vencer.',
        category: 'UTILITY' as const,
        categoryDesc: 'Meta aprueba estas plantillas más rápido porque son informativas.',
        body: `Hola {{1}} 👋\n\nTu suscripción a *{{2}}* vence en *{{3}} días*.\n\nPara renovar y seguir disfrutando del servicio, responde este mensaje. ¡No pierdas tu acceso! 🔑`,
    },
    {
        id: 'bienvenida',
        label: 'Bienvenida',
        emoji: '🎉',
        desc: 'Da la bienvenida y comparte datos de acceso.',
        category: 'UTILITY' as const,
        categoryDesc: 'Meta aprueba estas plantillas más rápido porque son informativas.',
        body: `¡Hola {{1}}! 🎉\n\nTe damos la bienvenida a *{{2}}*. Tu acceso ya está activo.\n\n📧 Usuario: {{3}}\n🔑 Contraseña: {{4}}\n\nSi tienes alguna duda, estamos aquí para ayudarte. 💪`,
    },
    {
        id: 'seguimiento',
        label: 'Seguimiento',
        emoji: '📬',
        desc: 'Verifica si el cliente está usando bien el servicio.',
        category: 'MARKETING' as const,
        categoryDesc: 'Meta puede tardar más en aprobar estas plantillas.',
        body: `Hola {{1}} 👋\n\n¿Cómo vas con *{{2}}*? ¿Has podido ingresar sin problemas?\n\nSi necesitas ayuda, responde este mensaje y te atendemos de inmediato. 😊`,
    },
    {
        id: 'personalizada',
        label: 'Personalizada',
        emoji: '✏️',
        desc: 'Escribe tu propio mensaje desde cero.',
        category: 'MARKETING' as const,
        categoryDesc: 'Puedes cambiar la categoría en el modo avanzado si lo necesitas.',
        body: `Hola {{1}} 👋\n\n`,
    },
] as const

type Purpose = typeof PURPOSES[number]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractVariables(body: string): string[] {
    const matches = body.match(/{{(\d+)}}/g) || []
    const unique = [...new Set(matches)]
    return unique.sort((a, b) => {
        const na = parseInt(a.replace(/[{}]/g, ''))
        const nb = parseInt(b.replace(/[{}]/g, ''))
        return na - nb
    })
}

function buildBodyExamples(body: string): string[][] {
    const vars = extractVariables(body)
    if (vars.length === 0) return []
    const samples = ['Juan', 'Netflix Premium', '7', 'usuario@email.com', 'Pass2024!']
    return [vars.map((_, i) => samples[i] ?? `valor${i + 1}`)]
}

/** Replace {{n}} with example values for the preview */
function previewBody(body: string, mappings: VariableMapping[]): string {
    let result = body
    for (const m of mappings) {
        result = result.replace(new RegExp(`\\{\\{${m.position}\\}\\}`, 'g'), m.example)
    }
    return result
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
    onSuccess: () => void
    onCancel: () => void
    onAdvancedMode: () => void
    initialBody?: string
}

export default function SimpleTemplateWizard({ onSuccess, onCancel, onAdvancedMode, initialBody }: Props) {
    const [step, setStep] = useState<1 | 2 | 3>(initialBody ? 2 : 1)
    const [purpose, setPurpose] = useState<Purpose | null>(initialBody ? PURPOSES[3] : null) // personalizada if duplicating
    const [body, setBody] = useState(initialBody || '')
    const [name, setName] = useState(initialBody ? `copia_${Date.now().toString().slice(-6)}` : '')
    const [submitting, setSubmitting] = useState(false)
    const [showRealPreview, setShowRealPreview] = useState(true)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const currentMappings = purpose ? (VARIABLE_MAPPINGS[purpose.id] || VARIABLE_MAPPINGS.personalizada) : []
    const detectedVars = extractVariables(body)

    // Build dynamic mappings for any variables beyond the purpose defaults
    const allMappings: VariableMapping[] = detectedVars.map(v => {
        const pos = parseInt(v.replace(/[{}]/g, ''))
        const existing = currentMappings.find(m => m.position === pos)
        if (existing) return existing
        return { position: pos, label: `Variable ${pos}`, icon: '📝', example: `valor${pos}` }
    })

    const selectPurpose = (p: Purpose) => {
        setPurpose(p)
        setBody(p.body)
        setName(`${p.id}_${Date.now().toString().slice(-6)}`)
        setStep(2)
    }

    const insertVariable = (position: number) => {
        const textarea = textareaRef.current
        if (!textarea) return
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const varText = `{{${position}}}`
        const newBody = body.substring(0, start) + varText + body.substring(end)
        setBody(newBody)
        // Restore cursor position after React re-render
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + varText.length, start + varText.length)
        }, 0)
    }

    const addCustomVariable = () => {
        const nextPos = detectedVars.length > 0
            ? Math.max(...detectedVars.map(v => parseInt(v.replace(/[{}]/g, '')))) + 1
            : 1
        insertVariable(nextPos)
    }

    const handleSubmit = async () => {
        if (!purpose || !name.trim() || !body.trim()) return

        const normalizedName = name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')

        const examples = buildBodyExamples(body)
        const bodyComponent: any = { type: 'BODY', text: body }
        if (examples.length > 0) bodyComponent.example = { body_text: examples }

        setSubmitting(true)
        try {
            const res = await fetch('/api/meta-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: normalizedName,
                    category: purpose.category,
                    language: 'es_LA',
                    components: [bodyComponent],
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            toast.success('¡Plantilla enviada a Meta! Aparecerá en estado "Pendiente".')
            onSuccess()
        } catch (err: any) {
            toast.error(err.message || 'Error al crear la plantilla')
        } finally {
            setSubmitting(false)
        }
    }

    const STEP_LABELS = ['Elige el propósito', 'Edita el mensaje', 'Confirma y envía']

    return (
        <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden mb-8 shadow-sm">

            {/* ── Title bar ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] bg-[#F7F8FA]">
                <div className="flex items-center gap-3">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F172A] hover:bg-slate-200 transition-colors"
                            title="Volver"
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-lg font-semibold text-[#0F172A]">Nueva Plantilla Meta</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Paso {step} de 3 — <span className="text-indigo-500">{STEP_LABELS[step - 1]}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onAdvancedMode}
                        className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="Acceder al editor completo"
                    >
                        <Settings2 size={12} />
                        Modo avanzado
                    </button>
                    <button
                        onClick={onCancel}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F172A] hover:bg-[#F0F0F0] transition-colors"
                        title="Cancelar"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* ── Progress bar ── */}
            <div className="h-1 bg-slate-100">
                <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${(step / 3) * 100}%` }}
                />
            </div>

            <div className="p-6">

                {/* ════ STEP 1 — Purpose selector ════ */}
                {step === 1 && (
                    <div>
                        <p className="text-sm text-slate-500 mb-5">
                            ¿Para qué vas a usar esta plantilla? Elige una opción para comenzar con un mensaje pre-armado.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {PURPOSES.map(p => {
                                const vars = VARIABLE_MAPPINGS[p.id] || []
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => selectPurpose(p)}
                                        className="text-left p-5 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all group"
                                    >
                                        <div className="text-2xl mb-2">{p.emoji}</div>
                                        <div className="font-semibold text-[#0F172A] text-sm mb-1 group-hover:text-indigo-600 transition-colors">
                                            {p.label}
                                        </div>
                                        <div className="text-xs text-slate-500 leading-relaxed mb-2">{p.desc}</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                                p.category === 'UTILITY'
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                                            }`}>
                                                {p.category === 'UTILITY' ? 'Utilidad' : 'Marketing'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {vars.length} variable{vars.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ════ STEP 2 — Edit body + variable picker + live preview ════ */}
                {step === 2 && purpose && (
                    <div className="space-y-5">
                        {/* Category badge */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                            purpose.category === 'UTILITY'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-amber-50 border border-amber-200 text-amber-700'
                        }`}>
                            <span className="font-semibold">Categoría: {purpose.category === 'UTILITY' ? 'Utilidad' : 'Marketing'}</span>
                            <span className="text-slate-500">— {purpose.categoryDesc}</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Left: Editor + Variable picker */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                        Mensaje
                                    </label>
                                    <Textarea
                                        ref={textareaRef}
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        rows={10}
                                        className="bg-[#F7F8FA] border-slate-200 text-[#0F172A] font-mono text-sm resize-none"
                                        placeholder="Escribe tu mensaje aquí…"
                                    />
                                </div>

                                {/* Variable picker */}
                                <div className="rounded-xl border border-slate-200 bg-[#F7F8FA] p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Variables disponibles</span>
                                        <button
                                            onClick={addCustomVariable}
                                            className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold"
                                        >
                                            + Agregar variable
                                        </button>
                                    </div>

                                    {/* Variable buttons */}
                                    <div className="flex flex-wrap gap-2">
                                        {allMappings.map(m => (
                                            <button
                                                key={m.position}
                                                onClick={() => insertVariable(m.position)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-xs transition-colors group"
                                                title={`Inserta {{${m.position}}} — ${m.label}`}
                                            >
                                                <span>{m.icon}</span>
                                                <span className="text-slate-700 group-hover:text-indigo-600">{m.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Variable mapping table */}
                                    {detectedVars.length > 0 && (
                                        <div className="border-t border-slate-200 pt-3 space-y-1.5">
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Significado de cada variable</span>
                                            {allMappings.map(m => (
                                                <div key={m.position} className="flex items-center gap-2 text-xs">
                                                    <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-semibold text-[11px]">
                                                        {`{{${m.position}}}`}
                                                    </code>
                                                    <span className="text-slate-400">=</span>
                                                    <span className="text-slate-600">{m.icon} {m.label}</span>
                                                    <span className="text-slate-400 ml-auto italic">ej: "{m.example}"</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: WhatsApp preview */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Vista previa WhatsApp
                                    </label>
                                    <button
                                        onClick={() => setShowRealPreview(!showRealPreview)}
                                        className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold"
                                    >
                                        {showRealPreview ? 'Ver variables' : 'Ver datos reales'}
                                    </button>
                                </div>
                                <div
                                    className="rounded-xl overflow-hidden"
                                    style={{ background: '#ECE5DD' }}
                                >
                                    {/* Phone header */}
                                    <div className="bg-[#075E54] px-4 py-2.5 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                                            J
                                        </div>
                                        <div>
                                            <div className="text-white text-sm font-medium">Tu Negocio</div>
                                            <div className="text-white/60 text-[10px]">en línea</div>
                                        </div>
                                    </div>

                                    {/* Chat area */}
                                    <div className="p-4 min-h-[240px]">
                                        <div
                                            className="bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm text-sm leading-relaxed max-w-[95%]"
                                            style={{ color: '#303030' }}
                                        >
                                            <div style={{ whiteSpace: 'pre-wrap' }}>
                                                {showRealPreview
                                                    ? previewBody(body || 'Tu mensaje aparecerá aquí…', allMappings)
                                                    : <HighlightedBody text={body || 'Tu mensaje aparecerá aquí…'} />
                                                }
                                            </div>
                                            <div className="flex justify-end mt-1">
                                                <span className="text-[10px]" style={{ color: '#667781' }}>12:00 ✓✓</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Input bar mock */}
                                    <div className="bg-[#F0F0F0] px-3 py-2 flex items-center gap-2">
                                        <div className="flex-1 bg-white rounded-full px-4 py-1.5 text-xs text-slate-400">
                                            Escribe un mensaje
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center">
                                            <Send size={14} className="text-white" />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2">
                                    {showRealPreview
                                        ? 'Se muestran datos de ejemplo. Los valores reales se insertan al enviar.'
                                        : <>Los textos en <span className="bg-[#dcf8c6] text-[#128C7E] text-[10px] font-semibold rounded px-1">verde</span> son variables que se reemplazan al enviar.</>
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={() => setStep(3)}
                                disabled={!body.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                            >
                                Continuar <ArrowRight size={16} />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ════ STEP 3 — Confirm & submit ════ */}
                {step === 3 && purpose && (
                    <div className="space-y-5">
                        {/* Info banner */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
                            <strong>Meta revisa las plantillas</strong> — después de enviar, la plantilla aparecerá
                            como <em>"Pendiente"</em> hasta ser aprobada (generalmente en minutos a pocas horas).
                            Solo las plantillas <strong>APROBADAS</strong> pueden usarse en envíos masivos.
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Name input */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Nombre de la plantilla
                                </label>
                                <Input
                                    value={name}
                                    onChange={e =>
                                        setName(
                                            e.target.value
                                                .toLowerCase()
                                                .replace(/\s+/g, '_')
                                                .replace(/[^a-z0-9_]/g, '')
                                        )
                                    }
                                    className="bg-[#F7F8FA] border-slate-200 text-[#0F172A] font-mono"
                                    placeholder="ej: renovacion_mensual"
                                />
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    Solo letras minúsculas, números y guiones bajos.
                                    Este nombre es único e inmutable una vez aprobado.
                                </p>

                                {/* Variable mapping summary */}
                                {allMappings.length > 0 && (
                                    <div className="mt-4 rounded-xl border border-slate-200 bg-[#F7F8FA] p-3 space-y-1.5">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Variables en el mensaje</span>
                                        {allMappings.map(m => (
                                            <div key={m.position} className="flex items-center gap-2 text-xs">
                                                <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-semibold text-[11px]">
                                                    {`{{${m.position}}}`}
                                                </code>
                                                <span className="text-slate-500">{m.icon} {m.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Resumen
                                </label>
                                <div className="space-y-0 divide-y divide-slate-100 text-sm">
                                    {[
                                        { label: 'Propósito', value: `${purpose.emoji} ${purpose.label}` },
                                        { label: 'Categoría', value: purpose.category === 'UTILITY' ? 'Utilidad' : 'Marketing' },
                                        { label: 'Idioma', value: 'es_LA (Español)' },
                                        { label: 'Variables', value: `${detectedVars.length} detectadas` },
                                    ].map(row => (
                                        <div key={row.label} className="flex justify-between py-2.5">
                                            <span className="text-slate-500">{row.label}</span>
                                            <span className="font-medium text-[#0F172A]">{row.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Compact preview */}
                                <div className="mt-4 bg-[#F7F8FA] border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-mono leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                                    {body}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <button
                                onClick={onAdvancedMode}
                                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
                            >
                                <Settings2 size={12} />
                                Necesito más opciones (imagen, botones, etc.)
                            </button>
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting || !name.trim() || !body.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                            >
                                {submitting
                                    ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                                    : <><Send size={16} /> Enviar a Meta</>
                                }
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HighlightedBody({ text }: { text: string }) {
    const parts = text.split(/({{[^}]+}})/)
    return (
        <>
            {parts.map((part, i) =>
                /^{{[^}]+}}$/.test(part)
                    ? <span key={i} className="bg-[#dcf8c6] text-[#128C7E] font-semibold rounded px-0.5">{part}</span>
                    : <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
            )}
        </>
    )
}
