
'use client'

import { Search } from 'lucide-react'

// Datos falsos para probar el diseño
const EXT_CHATS = [
    { id: 1, name: 'Juan Pérez', lastMessage: 'Hola, me interesa el servicio', time: '10:30 AM', unread: 2, avatar: 'J' },
    { id: 2, name: 'María García', lastMessage: '¿Cuál es el precio?', time: 'Yesterday', unread: 0, avatar: 'M' },
    { id: 3, name: 'Tech Solutions', lastMessage: 'Gracias por la información', time: 'Mon', unread: 0, avatar: 'T' },
]

export function ConversationList() {
    return (
        <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col h-full">
            <div className="p-4 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white mb-4">Chats</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Buscar conversación..."
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {EXT_CHATS.map((chat) => (
                    <div key={chat.id} className="p-4 hover:bg-slate-800/50 cursor-pointer border-b border-slate-900/50 transition-colors">
                        <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                                {chat.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-slate-200 truncate">{chat.name}</h3>
                                    <span className="text-xs text-slate-500">{chat.time}</span>
                                </div>
                                <p className="text-sm text-slate-400 truncate">{chat.lastMessage}</p>
                            </div>
                            {chat.unread > 0 && (
                                <div className="flex flex-col justify-center">
                                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                        {chat.unread}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
