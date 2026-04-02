'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { X, ArrowLeft, ArrowRight, Send, Loader2, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Template purposes with pre-filled bodies ─────────────────────────────────

const PURPOSES = [
    {
        id: 'renovacion',
        label: 'Renovación',
        emoji: '🔄',
        desc: 'Avisa a clientes que su suscripción está por vencer.',
        category: 'UTILITY' as const,
        body: `Hola {{1}} 👋\n\nTu suscripción a *{{2}}* vence en *{{3}} días*.\n\nPara renovar y seguir disfrutando del servicio, responde este mensaje. ¡No pierdas tu acceso! 🔑`,
    },
    {
        id: 'bienvenida',
        label: 'Bienvenida',
        emoji: '🎉',
        desc: 'Da la bienvenida y comparte datos de acceso a nuevos clientes.',
        category: 'UTILITY' as const,
        body: `¡Hola {{1}}! 🎉\n\nTe damos la bienvenida a *{{2}}*. Tu acceso ya está activo.\n\n📧 Usuario: {{3}}\n🔑 Contraseña: {{4}}\n\nSi tienes alguna duda, estamos aquí para ayudarte. 💪`,
    },
    {
        id: 'seguimiento',
        label: 'Seguimiento',
        emoji: '📬',
        desc: 'Verifica si el cliente está usando bien el servicio.',
        category: 'MARKETING' as const,
        body: `Hola {{1}} 👋\n\n¿Cómo vas con *{{2}}*? ¿Has podido ingresar sin problemas?\n\nSi necesitas ayuda, responde este mensaje y te atendemos de inmediato. 😊`,
    },
    {
        id: 'personalizada',
        label: 'Personalizada',
        emoji: '✏️',
        desc: 'Escribe tu propio mensaje desde cero.',
        category: 'MARKETING' as const,
        body: `Hola {{1}} 👋\n\n`,
    },
] as const

type Purpose = typeof PURPOSES[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Highlights {{n}} variables in WhatsApp preview */
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

/** Extract unique positional variables like {{1}}, {{2}}, … from body */
function extractVariables(body: string): string[] {
    const matches = body.match(/{{(\d+)}}/g) || []
    const unique = [...new Set(matches)]
    return unique.sort((a, b) => {
        const na = parseInt(a.replace(/[{}]/g, ''))
        const nb = parseInt(b.replace(/[{}]/g, ''))
        return na - nb
    })
}

/** Build body_text examples array for Meta API */
function buildBodyExamples(body: string): string[][] {
    const vars = extractVariables(body)
    if (vars.length === 0) return []
    const samples = ['Juan', 'Netflix Premium', '7', 'usuario@email.com', 'Pass2024!']
    return [vars.map((_, i) => samples[i] ?? `valor${i + 1}`)]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    onSuccess: () => void
    onCancel: () => void
    onAdvancedMode: () => void
}

export default function SimpleTemplateWizard({ onSuccess, onCancel, onAdvancedMode }: Props) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [purpose, setPurpose] = useState<Purpose | null>(null)
    const [body, setBody] = useState('')
    const [name, setName] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const selectPurpose = (p: Purpose) => {
        setPurpose(p)
        setBody(p.body)
        setName(`${p.id}_${Date.now().toString().slice(-6)}`)
        setStep(2)
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
                            ¿Para qué vas a usar esta plantilla? Elige una opción para comenzar con un mensaje ya armado que puedes editar.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {PURPOSES.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => selectPurpose(p)}
                                    className="text-left p-5 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all group"
                                >
                                    <div className="text-2xl mb-2">{p.emoji}</div>
                                    <div className="font-semibold text-[#0F172A] text-sm mb-1.5 group-hover:text-indigo-600 transition-colors">
                                        {p.label}
                                    </div>
                                    <div className="text-xs text-slate-500 leading-relaxed">{p.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ════ STEP 2 — Edit body + live preview ════ */}
                {step === 2 && purpose && (
                    <div className="space-y-5">
                        <p className="text-sm text-slate-500">
                            Edita el mensaje libremente. Usa{' '}
                            <code className="bg-slate-100 text-indigo-600 px-1 rounded text-xs font-mono">{'{{1}}'}</code>{' '}
                            para el nombre del cliente,{' '}
                            <code className="bg-slate-100 text-indigo-600 px-1 rounded text-xs font-mono">{'{{2}}'}</code>{' '}
                            para el servicio, etc. — se reemplazan automáticamente al enviar.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Editor */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                    ✏️ Mensaje
                                </label>
                                <Textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    rows={11}
                                    className="bg-[#F7F8FA] border-slate-200 text-[#0F172A] font-mono text-sm resize-none"
                                    placeholder="Escribe tu mensaje aquí…"
                                />
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    Variables detectadas:{' '}
                                    <span className="text-indigo-500 font-mono">
                                        {extractVariables(body).join(', ') || 'ninguna'}
                                    </span>
                                </p>
                            </div>

                            {/* WhatsApp preview */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                    📱 Vista previa
                                </label>
                                <div
                                    className="rounded-xl p-4 min-h-[220px] flex flex-col"
                                    style={{ background: '#ECE5DD' }}
                                >
                                    <div
                                        className="bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm text-sm leading-relaxed max-w-[90%]"
                                        style={{ color: '#303030' }}
                                    >
                                        <HighlightedBody text={body || 'Tu mensaje aparecerá aquí…'} />
                                    </div>
                                    <div className="flex justify-end mt-1.5">
                                        <span className="text-[10px]" style={{ color: '#667781' }}>12:00 ✓✓</span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    Los textos en{' '}
                                    <span className="bg-[#dcf8c6] text-[#128C7E] text-[10px] font-semibold rounded px-1">{'{{verde}}'}</span>{' '}
                                    son variables que se reemplazan automáticamente.
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
                            <strong>⏳ Meta revisa las plantillas</strong> — después de enviar, la plantilla aparecerá
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

                                {/* Body preview (compact) */}
                                <div className="mt-4 bg-[#F7F8FA] border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-mono leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                                    {body}
                                </div>
                            </div>

                            {/* Summary */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Resumen
                                </label>
                                <div className="space-y-0 divide-y divide-slate-100 text-sm">
                                    {[
                                        { label: 'Propósito', value: `${purpose.emoji} ${purpose.label}` },
                                        { label: 'Categoría', value: purpose.category },
                                        { label: 'Idioma', value: 'es_LA (Español)' },
                                        { label: 'Variables', value: `${extractVariables(body).length} detectadas` },
                                    ].map(row => (
                                        <div key={row.label} className="flex justify-between py-2.5">
                                            <span className="text-slate-500">{row.label}</span>
                                            <span className="font-medium text-[#0F172A]">{row.value}</span>
                                        </div>
                                    ))}
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
