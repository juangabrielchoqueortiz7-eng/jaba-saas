
'use client'

import { useEffect, useState } from 'react'
import { Search, Check, CheckCheck, Filter, X, Tag, Archive, ArchiveRestore } from 'lucide-react'
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
    archived?: boolean
}

interface ConversationListProps {
    onSelectChat?: (chatId: string) => void
    selectedChatId?: string | null
}

export function ConversationList({ onSelectChat, selectedChatId: externalChatId }: ConversationListProps = {}) {
    const [chats, setChats] = useState<Chat[]>([])
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [supabase] = useState(() => createClient())
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
    const [showFilterMenu, setShowFilterMenu] = useState(false)
    const [showArchived, setShowArchived] = useState(false)
    const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number; archived: boolean } | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeChatId = externalChatId !== undefined ? externalChatId : searchParams.get('chatId')

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

        // Solo Realtime — sin polling de 3s
        const channel = supabase
            .channel('chats_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setChats(prev => [payload.new as Chat, ...prev])
                } else if (payload.eventType === 'UPDATE') {
                    setChats(prev =>
                        prev
                            .map(c => c.id === (payload.new as Chat).id ? { ...c, ...payload.new } : c)
                            .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime())
                    )
                } else if (payload.eventType === 'DELETE') {
                    setChats(prev => prev.filter(c => c.id !== (payload.old as any).id))
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [supabase])

    const handleSelectChat = (chatId: string) => {
        if (onSelectChat) {
            onSelectChat(chatId)
        } else {
            router.push(`/dashboard/chats?chatId=${chatId}`)
        }
    }

    const handleArchive = async (chatId: string, archive: boolean) => {
        await supabase.from('chats').update({ archived: archive }).eq('id', chatId)
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, archived: archive } : c))
        setContextMenu(null)
    }

    const filteredChats = chats.filter(chat => {
        const matchesSearch =
            (chat.contact_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (chat.phone_number || '').includes(searchTerm)
        const matchesTag = !activeTagFilter || (chat.tags && chat.tags.includes(activeTagFilter))
        const matchesArchive = showArchived ? chat.archived === true : !chat.archived
        return matchesSearch && matchesTag && matchesArchive
    })

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'read': return <CheckCheck size={16} className="text-[#25D366] flex-shrink-0" />
            case 'delivered': return <CheckCheck size={16} className="text-white/30 flex-shrink-0" />
            default: return <Check size={16} className="text-white/30 flex-shrink-0" />
        }
    }

    const tagCounts = Object.keys(CRM_TAGS).reduce((acc, tag) => {
        acc[tag] = chats.filter(c => c.tags?.includes(tag)).length
        return acc
    }, {} as Record<string, number>)

    return (
        <div className="w-full border-r border-white/[0.06] bg-black flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06] bg-[#111111]">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-white">Chats</h2>
                    <button className="bg-[#25D366] hover:bg-[#1fad52] text-black p-2 rounded-full transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>

                {/* Tabs: Chats / Archivados */}
                <div className="flex gap-1 mb-3 bg-white/[0.04] rounded-xl p-1">
                    <button
                        onClick={() => setShowArchived(false)}
                        className={cn(
                            "flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors",
                            !showArchived ? "bg-[#25D366] text-black" : "text-white/55 hover:text-white"
                        )}
                    >
                        Chats
                    </button>
                    <button
                        onClick={() => setShowArchived(true)}
                        className={cn(
                            "flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center justify-center gap-1",
                            showArchived ? "bg-[#25D366] text-black" : "text-white/55 hover:text-white"
                        )}
                    >
                        <Archive size={12} /> Archivados
                    </button>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={15} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/[0.06] border border-white/[0.06] rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#25D366] transition-all placeholder:text-white/30"
                            placeholder="Buscar chats..."
                        />
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={cn(
                                "p-2 rounded-xl transition-colors border",
                                activeTagFilter
                                    ? "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20"
                                    : "bg-white/[0.06] hover:bg-white/[0.10] text-white/55 border-white/[0.06]"
                            )}
                        >
                            <Filter size={16} />
                        </button>

                        {showFilterMenu && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-[#141414] border border-white/[0.06] rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2">
                                <button
                                    onClick={() => { setActiveTagFilter(null); setShowFilterMenu(false) }}
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/[0.06] transition-colors",
                                        !activeTagFilter ? "text-[#25D366] font-medium" : "text-white"
                                    )}
                                >
                                    <Tag size={14} />
                                    Todos ({chats.length})
                                </button>
                                <div className="border-t border-white/[0.06] my-1" />
                                {Object.entries(CRM_TAGS).map(([key, tag]) => (
                                    <button
                                        key={key}
                                        onClick={() => { setActiveTagFilter(key); setShowFilterMenu(false) }}
                                        className={cn(
                                            "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-white/[0.06] transition-colors",
                                            activeTagFilter === key ? `${tag.color} font-medium` : "text-white"
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

                {activeTagFilter && CRM_TAGS[activeTagFilter] && (
                    <div className="mt-2 flex items-center gap-2">
                        <span className={cn("text-xs px-2 py-1 rounded-full flex items-center gap-1", CRM_TAGS[activeTagFilter].bg, CRM_TAGS[activeTagFilter].color)}>
                            {CRM_TAGS[activeTagFilter].icon} {CRM_TAGS[activeTagFilter].label}
                            <button onClick={() => setActiveTagFilter(null)} className="ml-1 hover:opacity-70">
                                <X size={12} />
                            </button>
                        </span>
                        <span className="text-xs text-white/30">{filteredChats.length} chats</span>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-50 bg-[#141414] border border-white/[0.06] rounded-xl shadow-xl py-1 w-44"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <button
                            onClick={() => handleArchive(contextMenu.chatId, !contextMenu.archived)}
                            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
                        >
                            {contextMenu.archived
                                ? <><ArchiveRestore size={14} className="text-[#25D366]" /> Desarchivar</>
                                : <><Archive size={14} className="text-white/55" /> Archivar</>
                            }
                        </button>
                    </div>
                </>
            )}

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {errorMsg && (
                    <div className="p-4 bg-red-900/20 text-red-300 text-xs m-2 rounded-xl border border-red-500/20">
                        <p><strong>Error:</strong> {errorMsg}</p>
                    </div>
                )}
                {loading && <p className="text-center text-white/30 mt-6 text-sm">Cargando...</p>}

                {!loading && chats.length === 0 && (
                    <p className="text-center text-white/30 mt-6 px-4 text-sm">
                        No hay chats aún. Envía un mensaje a tu número de WhatsApp para empezar.
                    </p>
                )}

                {filteredChats.map((chat) => (
                    <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat.id)}
                        onContextMenu={(e) => {
                            e.preventDefault()
                            setContextMenu({ chatId: chat.id, x: e.clientX, y: e.clientY, archived: !!chat.archived })
                        }}
                        className={cn(
                            "px-4 py-3 cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]",
                            activeChatId === chat.id && "bg-white/[0.06]"
                        )}
                    >
                        <div className="flex gap-3">
                            {/* Avatar */}
                            <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center text-black font-bold shrink-0 text-base">
                                {chat.contact_name ? chat.contact_name.charAt(0).toUpperCase() : '#'}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h3 className="font-semibold text-white truncate text-[14px]">
                                        {chat.contact_name || chat.phone_number}
                                    </h3>
                                    <span className={cn(
                                        "text-[11px] whitespace-nowrap ml-2",
                                        chat.unread_count > 0 ? "text-[#25D366]" : "text-white/30"
                                    )}>
                                        {formatChatListTime(chat.last_message_time)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {getStatusIcon(chat.last_message_status)}
                                    <p className="text-[13px] text-white/55 truncate">{chat.last_message}</p>
                                </div>

                                {/* CRM Tags */}
                                {chat.tags && chat.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
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
                                            <span className="text-[10px] text-white/30">+{chat.tags.length - 3}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Unread badge */}
                            {chat.unread_count > 0 && (
                                <div className="flex flex-col justify-center">
                                    <div className="min-w-5 h-5 px-1 bg-[#25D366] rounded-full flex items-center justify-center text-[11px] font-bold text-black">
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
