'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Send, Users, Loader2, CheckCircle2, XCircle, Eye, AlertTriangle } from 'lucide-react'

interface MetaTemplate {
    id: string
    name: string
    status: string
    language: string
    components: Array<{ type: string; text?: string; format?: string }>
}

interface BroadcastModalProps {
    metaTemplates: MetaTemplate[]
    onClose: () => void
    inline?: boolean
}

type AudienceType = 'service' | 'tag' | 'all'

function detectVars(components: MetaTemplate['components']): number {
    const body = components.find(c => c.type === 'BODY')
    if (!body?.text) return 0
    const m = body.text.match(/\{\{(\d+)\}\}/g)
    return m ? new Set(m).size : 0
}

function getBodyText(components: MetaTemplate['components']): string {
    return components.find(c => c.type === 'BODY')?.text || ''
}

type SendResult = { sent: number; failed: number; total: number; errors: string[] }

export default function BroadcastModal({ metaTemplates, onClose, inline = false }: BroadcastModalProps) {
    const approved = metaTemplates.filter(t => t.status === 'APPROVED')

    const [templateName, setTemplateName] = useState('')
    const [variables, setVariables] = useState<string[]>([])
    const [audienceType, setAudienceType] = useState<AudienceType>('service')
    const [audienceValue, setAudienceValue] = useState('CANVA')

    const [previewCount, setPreviewCount] = useState<number | null>(null)
    const [previewContacts, setPreviewContacts] = useState<any[]>([])
    const [loadingPreview, setLoadingPreview] = useState(false)

    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<SendResult | null>(null)
    const [step, setStep] = useState<'config' | 'preview' | 'result'>('config')

    const selectedTemplate = approved.find(t => t.name === templateName)
    const varCount = selectedTemplate ? detectVars(selectedTemplate.components) : 0
    const bodyText = selectedTemplate ? getBodyText(selectedTemplate.components) : ''

    // Sync variables array length
    useEffect(() => {
        setVariables(Array(varCount).fill(''))
    }, [templateName, varCount])

    const handlePreview = async () => {
        if (!templateName) return
        setLoadingPreview(true)
        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName,
                    language: selectedTemplate?.language || 'es',
                    variables,
                    audience: { type: audienceType, value: audienceValue },
                    preview: true,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setPreviewCount(data.total)
            setPreviewContacts(data.contacts || [])
            setStep('preview')
        } catch (err: any) {
            alert(err.message || 'Error al obtener vista previa')
        } finally {
            setLoadingPreview(false)
        }
    }

    const handleSend = async () => {
        if (!templateName) return
        setSending(true)
        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName,
                    language: selectedTemplate?.language || 'es',
                    variables,
                    audience: { type: audienceType, value: audienceValue },
                    preview: false,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setResult(data)
            setStep('result')
        } catch (err: any) {
            alert(err.message || 'Error al enviar')
        } finally {
            setSending(false)
        }
    }

    const content = (
        <>
                {/* Header */}
                <div className={`flex items-center justify-between p-5 border-b border-slate-200 ${inline ? 'bg-white rounded-t-2xl' : 'bg-white/80'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                            <Send size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#0F172A]">Envío Masivo</h2>
                            <p className="text-xs text-slate-500">Envía una plantilla Meta a múltiples contactos a la vez</p>
                        </div>
                    </div>
                    {!inline && (
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* ── STEP: CONFIG ── */}
                {step === 'config' && (
                    <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

                        {/* Plantilla */}
                        <div className="space-y-2">
                            <Label className="text-[#0F172A] font-semibold">1. Plantilla Meta</Label>
                            {approved.length === 0 ? (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    No tienes plantillas aprobadas en Meta. Crea una y espera su aprobación.
                                </div>
                            ) : (
                                <Select value={templateName} onValueChange={setTemplateName}>
                                    <SelectTrigger className="bg-[#F7F8FA] border-slate-200 text-[#0F172A]">
                                        <SelectValue placeholder="Selecciona una plantilla aprobada..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {approved.map(t => (
                                            <SelectItem key={t.id} value={t.name}>
                                                <span className="font-mono text-sm">{t.name}</span>
                                                <span className="text-slate-500 text-xs ml-2">{t.language}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {bodyText && (
                                <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-500 font-mono whitespace-pre-wrap leading-relaxed">
                                    {bodyText}
                                </div>
                            )}
                        </div>

                        {/* Variables */}
                        {varCount > 0 && (
                            <div className="space-y-2">
                                <Label className="text-[#0F172A] font-semibold">2. Variables</Label>
                                <p className="text-[11px] text-slate-500">
                                    Usa: <code className="bg-slate-100 px-1 rounded">{'{nombre}'}</code>{' '}
                                    <code className="bg-slate-100 px-1 rounded">{'{vencimiento}'}</code>{' '}
                                    <code className="bg-slate-100 px-1 rounded">{'{correo}'}</code>{' '}
                                    <code className="bg-slate-100 px-1 rounded">{'{servicio}'}</code>{' '}
                                    <code className="bg-slate-100 px-1 rounded">{'{numero}'}</code>
                                </p>
                                {Array.from({ length: varCount }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-indigo-400 font-mono w-10 shrink-0">{`{{${i + 1}}}`}</span>
                                        <Input
                                            className="h-8 text-xs bg-[#F7F8FA] border-slate-200"
                                            placeholder={`ej: {nombre}`}
                                            value={variables[i] || ''}
                                            onChange={e => {
                                                const next = [...variables]
                                                next[i] = e.target.value
                                                setVariables(next)
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Audiencia */}
                        <div className="space-y-3">
                            <Label className="text-[#0F172A] font-semibold">{varCount > 0 ? '3.' : '2.'} Audiencia</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { val: 'service', label: '🎯 Por Servicio', desc: 'Canva, ChatGPT o Gemini' },
                                    { val: 'tag', label: '🏷️ Por Etiqueta', desc: 'Chats con una etiqueta' },
                                    { val: 'all', label: '👥 Todos', desc: 'Todas las suscripciones activas' },
                                ] as const).map(opt => (
                                    <button
                                        key={opt.val}
                                        onClick={() => {
                                            setAudienceType(opt.val)
                                            setAudienceValue(opt.val === 'service' ? 'CANVA' : '')
                                        }}
                                        className={`p-3 rounded-xl border text-left transition-all ${audienceType === opt.val
                                            ? 'border-indigo-500 bg-indigo-50 text-[#0F172A]'
                                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-400'
                                        }`}
                                    >
                                        <div className="text-sm font-semibold">{opt.label}</div>
                                        <div className="text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>

                            {audienceType === 'service' && (
                                <Select value={audienceValue} onValueChange={setAudienceValue}>
                                    <SelectTrigger className="bg-[#F7F8FA] border-slate-200 text-[#0F172A]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CANVA">Canva</SelectItem>
                                        <SelectItem value="CHATGPT">ChatGPT</SelectItem>
                                        <SelectItem value="GEMINI">Gemini</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}

                            {audienceType === 'tag' && (
                                <Input
                                    className="bg-[#F7F8FA] border-slate-200 text-[#0F172A]"
                                    placeholder="Nombre de la etiqueta, ej: VIP"
                                    value={audienceValue}
                                    onChange={e => setAudienceValue(e.target.value)}
                                />
                            )}
                        </div>

                        {/* Advertencia */}
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                            <span>Este envío usa las plantillas aprobadas de Meta y funciona aunque el cliente no haya escrito en las últimas 24h. No se puede deshacer una vez iniciado.</span>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            {!inline && (
                                <Button onClick={onClose} className="bg-transparent hover:bg-slate-100 text-slate-500">
                                    Cancelar
                                </Button>
                            )}
                            <Button
                                onClick={handlePreview}
                                disabled={!templateName || loadingPreview || (audienceType === 'tag' && !audienceValue)}
                                className="bg-slate-200 hover:bg-slate-300 text-[#0F172A] gap-2"
                            >
                                {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                                Vista previa
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP: PREVIEW ── */}
                {step === 'preview' && (
                    <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                        <div className="text-center py-4">
                            <div className="text-5xl font-black text-[#0F172A] mb-2">{previewCount}</div>
                            <p className="text-slate-500 text-sm">
                                contactos recibirán la plantilla <span className="font-mono text-indigo-400">"{templateName}"</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Audiencia: {audienceType === 'all' ? 'Todas las suscripciones activas' : audienceType === 'service' ? `Servicio ${audienceValue}` : `Etiqueta "${audienceValue}"`}
                            </p>
                        </div>

                        {previewContacts.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Muestra de contactos</p>
                                {previewContacts.map((c, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-100 text-xs">
                                        <span className="font-mono text-slate-400">{c.phone}</span>
                                        {c.correo && <span className="text-slate-500">{c.correo}</span>}
                                        {c.servicio && <span className="text-indigo-400 font-semibold">{c.servicio}</span>}
                                    </div>
                                ))}
                                {(previewCount ?? 0) > previewContacts.length && (
                                    <p className="text-xs text-slate-600 text-center">y {(previewCount ?? 0) - previewContacts.length} más...</p>
                                )}
                            </div>
                        )}

                        {previewCount === 0 && (
                            <div className="text-center py-6 text-slate-500 text-sm">
                                No se encontraron contactos con esa audiencia.
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <Button onClick={() => setStep('config')} className="bg-transparent hover:bg-slate-100 text-slate-500">
                                ← Editar
                            </Button>
                            <Button
                                onClick={handleSend}
                                disabled={!previewCount || sending}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-[160px]"
                            >
                                {sending ? (
                                    <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                                ) : (
                                    <><Send size={14} /> Enviar a {previewCount} contactos</>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP: RESULT ── */}
                {step === 'result' && result && (
                    <div className="p-6 space-y-5">
                        <div className="text-center py-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result.failed === 0 ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                                {result.failed === 0
                                    ? <CheckCircle2 size={32} className="text-emerald-400" />
                                    : <AlertTriangle size={32} className="text-amber-400" />
                                }
                            </div>
                            <h3 className="text-xl font-bold text-[#0F172A] mb-1">
                                {result.failed === 0 ? '¡Envío completado!' : 'Envío con errores'}
                            </h3>
                            <p className="text-slate-500 text-sm">
                                {result.failed === 0
                                    ? `Se enviaron ${result.sent} mensajes correctamente.`
                                    : `${result.sent} enviados, ${result.failed} fallaron.`}
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Total', val: result.total, color: '#25D366' },
                                { label: 'Enviados', val: result.sent, color: '#10b981' },
                                { label: 'Fallidos', val: result.failed, color: result.failed > 0 ? '#f87171' : '#475569' },
                            ].map((s, i) => (
                                <div key={i} className="text-center p-4 rounded-xl bg-slate-100 border border-slate-200">
                                    <div className="text-2xl font-black" style={{ color: s.color }}>{s.val}</div>
                                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {result.errors.length > 0 && (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                <p className="text-xs text-slate-500 font-semibold">Errores:</p>
                                {result.errors.slice(0, 5).map((e, i) => (
                                    <div key={i} className="text-xs text-red-400 bg-red-900/10 px-2 py-1 rounded font-mono">{e}</div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <Button onClick={() => { setStep('config'); setResult(null); setTemplateName(''); }} className="bg-transparent hover:bg-slate-100 text-slate-500">
                                Nuevo envío
                            </Button>
                            {!inline && (
                                <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                    Cerrar
                                </Button>
                            )}
                        </div>
                    </div>
                )}
        </>
    )

    if (inline) {
        return (
            <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {content}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                {content}
            </div>
        </div>
    )
}
