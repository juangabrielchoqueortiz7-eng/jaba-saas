
'use client'

import { useEffect, useState } from 'react'
import { Search, Check, CheckCheck, Filter } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatChatListTime } from '@/lib/formatTime'

interface Chat {
    id: string
    contact_name: string
    last_message: string
    last_message_time: string
    unread_count: number
    phone_number: string
    last_message_status?: string
}

export function ConversationList() {
    const [chats, setChats] = useState<Chat[]>([])
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [supabase] = useState(() => createClient())
    const [searchTerm, setSearchTerm] = useState('')
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

        const pollInterval = setInterval(fetchChats, 3000)

        const channel = supabase
            .channel('chats_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
                fetchChats()
            })
            .subscribe()

        return () => {
            clearInterval(pollInterval)
            supabase.removeChannel(channel)
        }
    }, [supabase])

    const handleSelectChat = (chatId: string) => {
        router.push(`/dashboard/chats?chatId=${chatId}`)
    }

    const filteredChats = chats.filter(chat =>
        (chat.contact_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (chat.phone_number || '').includes(searchTerm)
    )

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'read':
                return <CheckCheck size={16} className="text-blue-400 flex-shrink-0" />
            case 'delivered':
                return <CheckCheck size={16} className="text-slate-400 flex-shrink-0" />
            default:
                return <Check size={16} className="text-slate-400 flex-shrink-0" />
        }
    }

    return (
        <div className="w-80 border-r border-[#2a3942] bg-[#111b21] flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-[#2a3942] bg-[#202c33]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#e9edef]">Chats</h2>
                    <button className="bg-[#00a884] hover:bg-[#06cf9c] text-white p-2 rounded-lg transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#2a3942] border-none rounded-lg py-2 pl-10 pr-4 text-sm text-[#e9edef] focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all placeholder:text-[#8696a0]"
                            placeholder="Buscar chats..."
                        />
                    </div>
                    <button className="bg-[#2a3942] hover:bg-[#3b4a54] text-[#aebac1] p-2 rounded-lg transition-colors">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {errorMsg && (
                    <div className="p-4 bg-red-900/50 text-red-200 text-xs m-2 rounded border border-red-800">
                        <p><strong>Error:</strong> {errorMsg}</p>
                    </div>
                )}
                {loading && <p className="text-center text-[#8696a0] mt-4">Cargando...</p>}

                {!loading && chats.length === 0 && (
                    <p className="text-center text-[#8696a0] mt-4 px-4 text-sm">
                        No hay chats aún. Envía un mensaje a tu número de WhatsApp para empezar.
                    </p>
                )}

                {filteredChats.map((chat) => (
                    <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat.id)}
                        className={cn(
                            "px-3 py-3 cursor-pointer border-b border-[#222d34] transition-colors hover:bg-[#2a3942]",
                            activeChatId === chat.id && "bg-[#2a3942]"
                        )}
                    >
                        <div className="flex gap-3">
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full bg-[#6b7b8d] flex items-center justify-center text-white font-bold shrink-0 text-lg">
                                {chat.contact_name ? chat.contact_name.charAt(0).toUpperCase() : '#'}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h3 className="font-medium text-[#e9edef] truncate text-[15px]">
                                        {chat.contact_name || chat.phone_number}
                                    </h3>
                                    <span className={cn(
                                        "text-xs whitespace-nowrap ml-2",
                                        chat.unread_count > 0 ? "text-[#00a884]" : "text-[#8696a0]"
                                    )}>
                                        {formatChatListTime(chat.last_message_time)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* Delivery status checkmarks */}
                                    {getStatusIcon(chat.last_message_status)}
                                    <p className="text-sm text-[#8696a0] truncate">{chat.last_message}</p>
                                </div>
                            </div>

                            {/* Unread badge */}
                            {chat.unread_count > 0 && (
                                <div className="flex flex-col justify-center">
                                    <div className="w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center text-xs font-bold text-white">
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
