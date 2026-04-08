'use client'

import { useState, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, User, Bot, Sparkles, Save, Check, Loader2, Wand2, ChevronDown, ChevronUp, Code } from 'lucide-react'
import { useParams } from 'next/navigation'

import { simulateChatAction } from '../../actions'
import { getTrainingPrompt, saveTrainingPrompt } from './actions'

const PLACEHOLDER_PROMPT = `Eres [Nombre del Asistente], asistente virtual de [Nombre de tu Negocio] por WhatsApp.

Tu objetivo es atender a los clientes de manera amable, rápida y profesional.

INFORMACIÓN DEL NEGOCIO:
- Nombre: [Tu Negocio]
- Rubro: [Spa / Clínica / Tienda / etc.]
- Horario: Lunes a Viernes de 9:00 a 18:00
- Ubicación: [Tu dirección]

SERVICIOS/PRODUCTOS:
- [Producto 1] — Bs [Precio]
- [Producto 2] — Bs [Precio]

REGLAS:
- Siempre sé amable y profesional
- Si el cliente pregunta algo que no sabes, dile que un agente humano le contactará pronto
- Responde de forma concisa y clara`

// ── Structured Form Helper ─────────────────────────────────────────────────

interface FormFields {
  assistantName: string
  businessName: string
  businessType: string
  schedule: string
  location: string
  products: string
  tone: string
  rules: string
}

const EMPTY_FORM: FormFields = {
  assistantName: '', businessName: '', businessType: '',
  schedule: '', location: '', products: '', tone: 'amable', rules: '',
}

function generatePromptFromForm(f: FormFields): string {
  const lines: string[] = []
  lines.push(`Eres ${f.assistantName || '[Nombre del Asistente]'}, asistente virtual de ${f.businessName || '[Tu Negocio]'} por WhatsApp.`)
  lines.push('')
  lines.push('Tu objetivo es atender a los clientes de manera amable, rápida y profesional.')
  lines.push('')
  lines.push('INFORMACIÓN DEL NEGOCIO:')
  lines.push(`- Nombre: ${f.businessName || '[Tu Negocio]'}`)
  if (f.businessType) lines.push(`- Rubro: ${f.businessType}`)
  if (f.schedule) lines.push(`- Horario: ${f.schedule}`)
  if (f.location) lines.push(`- Ubicación: ${f.location}`)
  if (f.products) {
    lines.push('')
    lines.push('SERVICIOS/PRODUCTOS:')
    f.products.split('\n').filter(Boolean).forEach(p => lines.push(`- ${p.replace(/^-\s*/, '')}`))
  }
  lines.push('')
  lines.push('REGLAS:')
  lines.push(`- Responde siempre de forma ${f.tone || 'amable'} y profesional`)
  lines.push('- Si el cliente pregunta algo que no sabes, dile que un agente humano le contactará pronto')
  lines.push('- Responde de forma concisa y clara')
  if (f.rules) {
    f.rules.split('\n').filter(Boolean).forEach(r => lines.push(`- ${r.replace(/^-\s*/, '')}`))
  }
  return lines.join('\n')
}

export default function TrainingPage() {
    const params = useParams()
    const assistantId = params.assistantId as string
    const [prompt, setPrompt] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [savedPrompt, setSavedPrompt] = useState('')
    const [mode, setMode] = useState<'form' | 'code'>('form')
    const [form, setForm] = useState<FormFields>(EMPTY_FORM)

    // Simulator State
    const [simulatedMessages, setSimulatedMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
    const [simulatorInput, setSimulatorInput] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [simulatedMessages, isGenerating])

    // Cargar prompt desde la DB
    useEffect(() => {
        async function loadPrompt() {
            setIsLoading(true)
            try {
                const data = await getTrainingPrompt(assistantId)
                if (data?.training_prompt) {
                    setPrompt(data.training_prompt)
                    setSavedPrompt(data.training_prompt)
                } else {
                    setPrompt('')
                    setSavedPrompt('')
                }
            } catch (error) {
                console.error('Error loading prompt:', error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPrompt()
    }, [assistantId])

    // Detectar cambios
    useEffect(() => {
        setHasChanges(prompt !== savedPrompt)
    }, [prompt, savedPrompt])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await saveTrainingPrompt(assistantId, prompt)
            setSavedPrompt(prompt)
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 2000)
        } catch (error) {
            console.error('Error saving:', error)
            alert('Error al guardar el entrenamiento')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSendAndGenerate = async () => {
        if (!simulatorInput.trim() && !isGenerating) return

        const userMsg = simulatorInput.trim()
        const newHistory = [...simulatedMessages, { role: 'user', content: userMsg } as const]
        setSimulatedMessages(newHistory)
        setSimulatorInput('')
        setIsGenerating(true)

        try {
            const response = await simulateChatAction(newHistory, prompt || PLACEHOLDER_PROMPT)
            if (response) {
                setSimulatedMessages(prev => [...prev, { role: 'assistant', content: response }])
            }
        } catch (error) {
            setSimulatedMessages(prev => [...prev, { role: 'assistant', content: "Error de conexión con IA." }])
        } finally {
            setIsGenerating(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-65px)] items-center justify-center bg-[#F7F8FA]">
                <div className="flex items-center gap-3 text-slate-500">
                    <Loader2 className="animate-spin" size={24} />
                    <span>Cargando entrenamiento...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-[#F7F8FA]">
            {/* Left Column: Training Editor */}
            <div className="flex-1 flex flex-col p-6 min-w-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#0F172A]">Entrenamiento</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Configura cómo responde tu asistente de IA a tus clientes.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Mode toggle */}
                        <div className="flex items-center bg-[#F7F8FA] rounded-lg p-0.5 border border-black/[0.06]">
                            <button
                                onClick={() => setMode('form')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    mode === 'form' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <Wand2 size={12} /> Formulario
                            </button>
                            <button
                                onClick={() => setMode('code')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    mode === 'code' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <Code size={12} /> Avanzado
                            </button>
                        </div>
                        {hasChanges && (
                            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                                Sin guardar
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !hasChanges}
                            className={`flex items-center gap-2 px-6 py-2 rounded-md font-bold transition-all text-sm ${saveSuccess
                                    ? 'bg-green-500 text-white'
                                    : hasChanges
                                        ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            {isSaving ? (
                                <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                            ) : saveSuccess ? (
                                <><Check size={16} /> ¡Guardado!</>
                            ) : (
                                <><Save size={16} /> Guardar</>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── FORM MODE ── */}
                {mode === 'form' && (
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-black/[0.08] flex flex-col overflow-y-auto">
                        <div className="p-6 space-y-5">
                            <div className="p-3 bg-indigo-50 border border-indigo-200/60 rounded-lg text-xs text-indigo-600">
                                Completa los campos y el prompt se generará automáticamente. Puedes cambiar al modo "Avanzado" para editarlo manualmente.
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">Nombre del asistente</Label>
                                    <Input
                                        placeholder="Ej: Sofi, Asistente JABA"
                                        className="bg-[#F7F8FA] border-black/[0.08]"
                                        value={form.assistantName}
                                        onChange={e => {
                                            const next = { ...form, assistantName: e.target.value }
                                            setForm(next)
                                            setPrompt(generatePromptFromForm(next))
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">Nombre de tu negocio</Label>
                                    <Input
                                        placeholder="Ej: Spa Bella, TechStore"
                                        className="bg-[#F7F8FA] border-black/[0.08]"
                                        value={form.businessName}
                                        onChange={e => {
                                            const next = { ...form, businessName: e.target.value }
                                            setForm(next)
                                            setPrompt(generatePromptFromForm(next))
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">Tipo de negocio</Label>
                                    <Input
                                        placeholder="Ej: Spa, Restaurante, Tienda de ropa"
                                        className="bg-[#F7F8FA] border-black/[0.08]"
                                        value={form.businessType}
                                        onChange={e => {
                                            const next = { ...form, businessType: e.target.value }
                                            setForm(next)
                                            setPrompt(generatePromptFromForm(next))
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">Horario de atención</Label>
                                    <Input
                                        placeholder="Ej: Lunes a Viernes 9:00-18:00"
                                        className="bg-[#F7F8FA] border-black/[0.08]"
                                        value={form.schedule}
                                        onChange={e => {
                                            const next = { ...form, schedule: e.target.value }
                                            setForm(next)
                                            setPrompt(generatePromptFromForm(next))
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-semibold">Ubicación (opcional)</Label>
                                <Input
                                    placeholder="Ej: Av. Arce #123, La Paz, Bolivia"
                                    className="bg-[#F7F8FA] border-black/[0.08]"
                                    value={form.location}
                                    onChange={e => {
                                        const next = { ...form, location: e.target.value }
                                        setForm(next)
                                        setPrompt(generatePromptFromForm(next))
                                    }}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-semibold">Productos o servicios (uno por línea)</Label>
                                <textarea
                                    className="w-full p-3 text-sm bg-[#F7F8FA] border border-black/[0.08] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px]"
                                    placeholder={"Corte de cabello — 50 Bs\nMasaje relajante — 120 Bs\nManicure — 30 Bs"}
                                    value={form.products}
                                    onChange={e => {
                                        const next = { ...form, products: e.target.value }
                                        setForm(next)
                                        setPrompt(generatePromptFromForm(next))
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">Tono de respuesta</Label>
                                    <select
                                        className="w-full h-10 px-3 text-sm bg-[#F7F8FA] border border-black/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={form.tone}
                                        onChange={e => {
                                            const next = { ...form, tone: e.target.value }
                                            setForm(next)
                                            setPrompt(generatePromptFromForm(next))
                                        }}
                                    >
                                        <option value="amable">Amable y profesional</option>
                                        <option value="formal">Formal y serio</option>
                                        <option value="casual">Casual y cercano</option>
                                        <option value="divertido">Divertido y relajado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-semibold">Reglas adicionales (opcional, una por línea)</Label>
                                <textarea
                                    className="w-full p-3 text-sm bg-[#F7F8FA] border border-black/[0.08] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[80px]"
                                    placeholder={"No dar descuentos sin autorización\nSiempre preguntar el nombre del cliente\nOfrecer WhatsApp Business para consultas"}
                                    value={form.rules}
                                    onChange={e => {
                                        const next = { ...form, rules: e.target.value }
                                        setForm(next)
                                        setPrompt(generatePromptFromForm(next))
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CODE MODE (Advanced) ── */}
                {mode === 'code' && (
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-black/[0.08] flex flex-col overflow-hidden relative">
                        <textarea
                            className="flex-1 w-full p-6 text-slate-700 font-mono text-sm leading-relaxed resize-none bg-transparent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/20"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={PLACEHOLDER_PROMPT}
                            spellCheck={false}
                        />
                        <div className="absolute bottom-4 right-4 text-xs font-mono text-slate-500 bg-white/80 px-2 py-1 rounded border border-black/[0.08]">
                            {prompt.length}/40000
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Chat Simulator */}
            <div className="w-[400px] border-l border-black/[0.08] bg-[#F7F8FA] flex flex-col shadow-xl z-10">
                <div className="p-4 border-b border-black/[0.08] flex items-center justify-between bg-white/50">
                    <h2 className="font-semibold text-slate-300 flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-400" />
                        Simulador de chat
                    </h2>
                    <button
                        onClick={() => setSimulatedMessages([])}
                        className="text-xs text-slate-500 hover:text-red-400"
                    >
                        Limpiar
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F8FA]">
                    {simulatedMessages.length === 0 && (
                        <div className="text-center py-12 text-slate-600">
                            <Bot size={32} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Escribe un mensaje para probar cómo responde tu IA</p>
                        </div>
                    )}
                    {simulatedMessages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <Bot size={16} className="text-indigo-400" />
                                </div>
                            )}

                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-sm'
                                : 'bg-[#F7F8FA] text-[#0F172A] border border-black/[0.08] rounded-tl-sm'
                                }`}>
                                {msg.content}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <User size={16} className="text-blue-400" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loading Bubble */}
                    {isGenerating && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                <Bot size={16} className="text-indigo-400" />
                            </div>
                            <div className="bg-[#F7F8FA] border border-black/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-black/[0.08] bg-white space-y-3">
                    <div className="relative">
                        <div className="absolute left-3 top-3 w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <User size={16} className="text-blue-400" />
                        </div>
                        <textarea
                            placeholder="Escribe un mensaje de prueba..."
                            className="w-full pl-14 pr-4 py-4 bg-[#F7F8FA] border border-black/[0.08] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-20 resize-none"
                            value={simulatorInput}
                            onChange={(e) => setSimulatorInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendAndGenerate();
                                }
                            }}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSendAndGenerate}
                            disabled={isGenerating || !simulatorInput.trim()}
                            className={`bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-bold text-sm shadow-sm flex items-center gap-2 transition-all active:scale-95 ${isGenerating || !simulatorInput.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Send size={16} />
                            {isGenerating ? 'Generando...' : 'Enviar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
