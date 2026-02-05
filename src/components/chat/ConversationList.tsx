
'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Chat {
    id: string
    contact_name: string
    last_message: string
    last_message_time: string
    unread_count: number
    phone_number: string
}

export function ConversationList() {
    const [chats, setChats] = useState<Chat[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeChatId = searchParams.get('chatId')

    useEffect(() => {
        const fetchChats = async () => {
            const { data, error } = await supabase
                .from('chats')
                .select('*')
                .order('last_message_time', { ascending: false })

            if (data) setChats(data)
            setLoading(false)
        }

        fetchChats()

        // Realtime subscription
        const channel = supabase
            .channel('chats_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
                fetchChats() // Refresh on change (simple approach)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    const handleSelectChat = (chatId: string) => {
        router.push(`/dashboard/chats?chatId=${chatId}`)
    }

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
                {loading && <p className="text-center text-slate-500 mt-4">Cargando...</p>}

                {!loading && chats.length === 0 && (
                    <p className="text-center text-slate-500 mt-4 px-4 text-sm">
                        No hay chats aún. Envía un mensaje a tu número de WhatsApp para empezar.
                    </p>
                )}

                {chats.map((chat) => (
                    <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat.id)}
                        className={cn(
                            "p-4 cursor-pointer border-b border-slate-900/50 transition-colors",
                            activeChatId === chat.id ? "bg-slate-800 border-l-4 border-l-indigo-500" : "hover:bg-slate-800/50"
                        )}
                    >
                        <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                                {chat.contact_name ? chat.contact_name.charAt(0).toUpperCase() : '#'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-slate-200 truncate">{chat.contact_name || chat.phone_number}</h3>
                                    <span className="text-xs text-slate-500">
                                        {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 truncate">{chat.last_message}</p>
                            </div>
                            {chat.unread_count > 0 && (
                                <div className="flex flex-col justify-center">
                                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                        {chat.unread_count}
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
