'use client'

import { useState, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, User, Bot, Sparkles } from 'lucide-react'

import { simulateChatAction } from '../../actions'

// ... existing imports

export default function TrainingPage() {
    const [prompt, setPrompt] = useState(`Eres Dirley. Tu objetivo es vender un PACK PREMIUM DE EMPRENDIMIENTO CON COLGANTES DE SAN BENITO 2025.

Debes responder de manera rápida, clara y amable, siempre adaptando la conversación a las necesidades específicas del cliente. Maneja cualquier objeción de forma natural, brindando seguridad y confianza, pero sin presionar.

Estilo de comunicación: Lenguaje amigable y empático, evita términos técnicos y utiliza un lenguaje cercano.

Longitud de la conversación: moderada.

Flexibilidad: Permite improvisar según la respuesta del cliente y trata de seguir el flujo de la conversación.

No omitas preguntas del cliente.

IMPORTANT: No hacer dos preguntas al tiempo, permite que el cliente responda una pregunta antes de hacer otra.

//

Al inicio de la conversación se saluda al cliente y se le da la siguiente información:

*DESCUBRE EL NEGOCIO DE LOS COLGANTES DE SAN BENITO 2025* 💰`)

    // Simulator State
    const [simulatedMessages, setSimulatedMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: '¿Qué hace especial a este pack?' }
    ])
    const [simulatorInput, setSimulatorInput] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    // Effect to scroll on new messages can be added, or just call it after updates
    useEffect(() => {
        scrollToBottom()
    }, [simulatedMessages, isGenerating])


    const handleAddUserMessage = () => {
        if (!simulatorInput.trim()) return
        const userMsg = simulatorInput.trim()
        setSimulatedMessages(prev => [...prev, { role: 'user', content: userMsg } as const])
        setSimulatorInput('')
    }

    const handleGenerate = async () => {
        setIsGenerating(true)
        try {
            // We pass independent history + prompt to server
            const response = await simulateChatAction(simulatedMessages, prompt)
            if (response) {
                setSimulatedMessages(prev => [...prev, { role: 'assistant', content: response }])
            }
        } catch (error) {
            console.error("Simulation error", error)
            setSimulatedMessages(prev => [...prev, { role: 'assistant', content: "Error al generar respuesta." }])
        } finally {
            setIsGenerating(false)
        }
    }

    // Unified Send Handler (optional if we want Enter to Trigger Generation directly)
    // For now, let's keep the split behavior as UI has two buttons, but Enter usually sends.
    // Let's make Enter add message AND trigger generation if user wants real feel?
    // User requested: "responderme segun el entrenamiento".
    // Best flow: 
    // 1. User types -> Enter/Click Add -> Adds to chat.
    // 2. Click Generate -> Bot responds.
    // OR
    // User types -> Enter -> Adds to chat AND Bot responds (Standard).
    // Let's implement Standard Chat Flow for Enter key for better UX.

    const handleSendAndGenerate = async () => {
        if (!simulatorInput.trim() && !isGenerating) return

        const userMsg = simulatorInput.trim()

        // Optimistic UI update
        const newHistory = [...simulatedMessages, { role: 'user', content: userMsg } as const]
        setSimulatedMessages(newHistory)
        setSimulatorInput('')
        setIsGenerating(true)

        try {
            const response = await simulateChatAction(newHistory, prompt)
            if (response) {
                setSimulatedMessages(prev => [...prev, { role: 'assistant', content: response }])
            }
        } catch (error) {
            setSimulatedMessages(prev => [...prev, { role: 'assistant', content: "Error de conexión con IA." }])
        } finally {
            setIsGenerating(false)
        }
    }


    return (
        <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-slate-50">
            {/* Left Column: Training Editor */}
            <div className="flex-1 flex flex-col p-6 min-w-0">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Entrenamiento</h1>
                    <button className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold px-6 py-2 rounded-md transition-colors shadow-sm">
                        Guardar
                    </button>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                    {/* Textarea taking full remaining space */}
                    <textarea
                        className="flex-1 w-full p-6 text-slate-700 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/20"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        spellCheck={false}
                    />

                    {/* Character Counter */}
                    <div className="absolute bottom-4 right-4 text-xs font-mono text-slate-400 bg-white/80 px-2 py-1 rounded border border-slate-100">
                        {prompt.length}/40000
                    </div>
                </div>
            </div>

            {/* Right Column: Chat Simulator */}
            <div className="w-[400px] border-l border-slate-200 bg-white flex flex-col shadow-xl z-10">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-500" />
                        Simulador de chat
                    </h2>
                    <button
                        onClick={() => setSimulatedMessages([])}
                        className="text-xs text-slate-400 hover:text-red-500"
                    >
                        Limpiar
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                    {simulatedMessages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                    <Bot size={16} className="text-indigo-600" />
                                </div>
                            )}

                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-sm'
                                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'
                                }`}>
                                {msg.content}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                    <User size={16} className="text-blue-600" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loading Bubble */}
                    {isGenerating && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <Bot size={16} className="text-indigo-600" />
                            </div>
                            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-100 bg-white space-y-3">
                    <div className="relative">
                        <div className="absolute left-3 top-3 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User size={16} className="text-blue-600" />
                        </div>
                        <textarea
                            placeholder="Escribe mensaje aquí"
                            className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-24 resize-none"
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

                    <button
                        onClick={handleAddUserMessage}
                        className="w-full py-2 text-blue-500 font-medium text-sm hover:bg-blue-50 rounded transition-colors border border-dashed border-blue-200"
                    >
                        Agregar mensaje
                    </button>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-md font-bold text-sm shadow-sm flex items-center gap-2 transition-all active:scale-95 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Sparkles size={16} />
                            {isGenerating ? 'Generando...' : 'Generar'}
                        </button>
                    </div>

                    <div className="text-right text-[10px] text-slate-300 font-mono">
                        {prompt.length}/40000
                    </div>
                </div>
            </div>
        </div>
    )
}
