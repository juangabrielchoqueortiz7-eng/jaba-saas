
'use client'

import { Send, Paperclip, Smile, MoreVertical, Phone, Video } from 'lucide-react'
import { MessageBubble } from './MessageBubble'

export function ChatWindow() {
    return (
        <div className="flex-1 flex flex-col h-full bg-slate-950">
            {/* Header */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                        J
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Juan Pérez</h3>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-xs text-slate-400">En línea</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                    <button className="hover:text-white transition-colors"><Phone size={20} /></button>
                    <button className="hover:text-white transition-colors"><Video size={20} /></button>
                    <button className="hover:text-white transition-colors"><MoreVertical size={20} /></button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('/chat-bg-dark.png')] bg-contain">
                <div className="text-center text-xs text-slate-500 my-4">Hoy</div>

                <MessageBubble
                    content="Hola, estoy interesado en el plan Pro."
                    isMine={false}
                    timestamp="10:30 AM"
                />
                <MessageBubble
                    content="¡Hola Juan! Claro que sí, con gusto te ayudo."
                    isMine={true}
                    timestamp="10:31 AM"
                    status="read"
                />
                <MessageBubble
                    content="¿Qué incluye específicamente la automatización de WhatsApp?"
                    isMine={false}
                    timestamp="10:32 AM"
                />
                <MessageBubble
                    content="Incluye respuestas automáticas con IA, gestión de leads y reportes en tiempo real."
                    isMine={true}
                    timestamp="10:33 AM"
                    status="delivered"
                />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2">
                    <button className="text-slate-400 hover:text-white transition-colors">
                        <Smile size={20} />
                    </button>
                    <button className="text-slate-400 hover:text-white transition-colors">
                        <Paperclip size={20} />
                    </button>
                    <input
                        className="flex-1 bg-transparent px-2 py-2 text-slate-200 focus:outline-none placeholder:text-slate-600"
                        placeholder="Escribe un mensaje..."
                    />
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors">
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}
