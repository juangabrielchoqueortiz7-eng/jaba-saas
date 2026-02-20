'use client'

import { useState, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, User, Bot, Sparkles, Save, Check, Loader2 } from 'lucide-react'
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

export default function TrainingPage() {
    const params = useParams()
    const assistantId = params.assistantId as string
    const [prompt, setPrompt] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [savedPrompt, setSavedPrompt] = useState('')

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
            <div className="flex h-[calc(100vh-65px)] items-center justify-center bg-slate-950">
                <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="animate-spin" size={24} />
                    <span>Cargando entrenamiento...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-slate-950">
            {/* Left Column: Training Editor */}
            <div className="flex-1 flex flex-col p-6 min-w-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Entrenamiento</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Describe tu negocio, productos y reglas. La IA responderá según este prompt.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
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
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
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

                <div className="flex-1 bg-slate-900 rounded-xl shadow-sm border border-slate-800 flex flex-col overflow-hidden relative">
                    <textarea
                        className="flex-1 w-full p-6 text-slate-300 font-mono text-sm leading-relaxed resize-none bg-transparent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/20"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={PLACEHOLDER_PROMPT}
                        spellCheck={false}
                    />

                    {/* Character Counter */}
                    <div className="absolute bottom-4 right-4 text-xs font-mono text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                        {prompt.length}/40000
                    </div>
                </div>
            </div>

            {/* Right Column: Chat Simulator */}
            <div className="w-[400px] border-l border-slate-800 bg-slate-900 flex flex-col shadow-xl z-10">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
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
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
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
                                : 'bg-slate-800 text-slate-300 border border-slate-700 rounded-tl-sm'
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
                            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3">
                    <div className="relative">
                        <div className="absolute left-3 top-3 w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <User size={16} className="text-blue-400" />
                        </div>
                        <textarea
                            placeholder="Escribe un mensaje de prueba..."
                            className="w-full pl-14 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-20 resize-none"
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
