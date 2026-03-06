
'use client'

import { useEffect, useState } from 'react'
import { Search, Check, CheckCheck, Filter, X, Tag } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatChatListTime } from '@/lib/formatTime'

// ============================================================
// CRM TAG SYSTEM — Colores y etiquetas predefinidas
// ============================================================
export const CRM_TAGS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    'nuevo': { label: 'Nuevo', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: '🆕' },
    'cliente_potencial': { label: 'Potencial', color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: '🎯' },
    'pago': { label: 'Pagó', color: 'text-green-400', bg: 'bg-green-500/20', icon: '✅' },
    'renovacion_pendiente': { label: 'Renovación', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: '⚠️' },
    'vencido': { label: 'Vencido', color: 'text-red-400', bg: 'bg-red-500/20', icon: '🔴' },
    'soporte': { label: 'Soporte', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: '🛟' },
    'no_interesado': { label: 'No Interesado', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: '❌' },
}

interface Chat {
    id: string
    contact_name: string
    last_message: string
    last_message_time: string
    unread_count: number
    phone_number: string
    last_message_status?: string
    tags?: string[]
}

export function ConversationList() {
    const [chats, setChats] = useState<Chat[]>([])
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [supabase] = useState(() => createClient())
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
    const [showFilterMenu, setShowFilterMenu] = useState(false)
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

    const filteredChats = chats.filter(chat => {
        const matchesSearch =
            (chat.contact_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (chat.phone_number || '').includes(searchTerm)

        const matchesTag = !activeTagFilter ||
            (chat.tags && chat.tags.includes(activeTagFilter))

        return matchesSearch && matchesTag
    })

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

    // Count chats per tag for filter menu
    const tagCounts = Object.keys(CRM_TAGS).reduce((acc, tag) => {
        acc[tag] = chats.filter(c => c.tags?.includes(tag)).length
        return acc
    }, {} as Record<string, number>)

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
                    <div className="relative">
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                activeTagFilter
                                    ? "bg-[#00a884] text-white"
                                    : "bg-[#2a3942] hover:bg-[#3b4a54] text-[#aebac1]"
                            )}
                        >
                            <Filter size={18} />
                        </button>

                        {/* Filter dropdown */}
                        {showFilterMenu && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-[#233138] border border-[#2a3942] rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2">
                                <button
                                    onClick={() => { setActiveTagFilter(null); setShowFilterMenu(false) }}
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[#2a3942] transition-colors",
                                        !activeTagFilter ? "text-[#00a884] font-medium" : "text-[#e9edef]"
                                    )}
                                >
                                    <Tag size={14} />
                                    Todos ({chats.length})
                                </button>
                                <div className="border-t border-[#2a3942] my-1" />
                                {Object.entries(CRM_TAGS).map(([key, tag]) => (
                                    <button
                                        key={key}
                                        onClick={() => { setActiveTagFilter(key); setShowFilterMenu(false) }}
                                        className={cn(
                                            "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#2a3942] transition-colors",
                                            activeTagFilter === key ? `${tag.color} font-medium` : "text-[#e9edef]"
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span>{tag.icon}</span>
                                            {tag.label}
                                        </span>
                                        {tagCounts[key] > 0 && (
                                            <span className={cn("text-xs px-1.5 py-0.5 rounded-full", tag.bg, tag.color)}>
                                                {tagCounts[key]}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Active filter indicator */}
                {activeTagFilter && CRM_TAGS[activeTagFilter] && (
                    <div className="mt-2 flex items-center gap-2">
                        <span className={cn("text-xs px-2 py-1 rounded-full flex items-center gap-1", CRM_TAGS[activeTagFilter].bg, CRM_TAGS[activeTagFilter].color)}>
                            {CRM_TAGS[activeTagFilter].icon} {CRM_TAGS[activeTagFilter].label}
                            <button onClick={() => setActiveTagFilter(null)} className="ml-1 hover:opacity-70">
                                <X size={12} />
                            </button>
                        </span>
                        <span className="text-xs text-[#8696a0]">{filteredChats.length} chats</span>
                    </div>
                )}
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

                                {/* CRM Tags */}
                                {chat.tags && chat.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {chat.tags.slice(0, 3).map(tag => {
                                            const tagConfig = CRM_TAGS[tag]
                                            if (!tagConfig) return null
                                            return (
                                                <span
                                                    key={tag}
                                                    className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                                        tagConfig.bg,
                                                        tagConfig.color
                                                    )}
                                                >
                                                    {tagConfig.icon} {tagConfig.label}
                                                </span>
                                            )
                                        })}
                                        {chat.tags.length > 3 && (
                                            <span className="text-[10px] text-[#8696a0]">+{chat.tags.length - 3}</span>
                                        )}
                                    </div>
                                )}
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
