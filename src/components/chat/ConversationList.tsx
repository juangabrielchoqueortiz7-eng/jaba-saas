
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
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [supabase] = useState(() => createClient())
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeChatId = searchParams.get('chatId')

    useEffect(() => {
        const fetchChats = async () => {
            const { data, error } = await supabase
                .from('chats')
                .select('*')
                .order('last_message_time', { ascending: false })

            if (error) {
                console.error('Error fetching chats:', error)
                setErrorMsg(error.message + ' (Hint: Check Console)')
            }
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
            <div className="p-4 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-800 p-2 rounded-lg">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                <circle cx="12" cy="11" r="1" fill="currentColor" />
                                <circle cx="9" cy="11" r="1" fill="currentColor" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-white">Chats</h2>
                    </div>
                    <button className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors shadow-lg shadow-green-500/20">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-green-500 transition-all placeholder:text-slate-600"
                            placeholder="Buscar..."
                        />
                    </div>
                    <button className="bg-slate-800 hover:bg-slate-700 text-slate-400 p-2 rounded-lg border border-slate-700 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {errorMsg && (
                    <div className="p-4 bg-red-900/50 text-red-200 text-xs m-2 rounded border border-red-800">
                        <p><strong>Error:</strong> {errorMsg}</p>
                        <p className="mt-2 text-slate-400">
                            Connecting to: {process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(8, 28)}...
                        </p>
                    </div>
                )}
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
