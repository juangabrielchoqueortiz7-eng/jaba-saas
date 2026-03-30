'use client'

import { useState, useEffect, Suspense } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { ConversationList } from './ConversationList'
import { ChatWindow } from './ChatWindow'
import { createClient } from '@/utils/supabase/client'
import { useChat } from '@/context/ChatContext'

export function ChatPanel() {
    const { isChatOpen, closeChat, activeChatId } = useChat()

    const [selectedChatId, setSelectedChatId] = useState<string | null>(activeChatId)

    useEffect(() => {
        setSelectedChatId(activeChatId)
    }, [activeChatId])

    const [totalUnread, setTotalUnread] = useState(0)
    const [supabase] = useState(() => createClient())

    useEffect(() => {
        const fetchUnread = async () => {
            const { data } = await supabase.from('chats').select('unread_count')
            if (data) {
                const total = data.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0)
                setTotalUnread(total)
            }
        }
        fetchUnread()

        // Solo Realtime — sin polling
        const channel = supabase
            .channel('chat-panel-unread')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, fetchUnread)
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [supabase])

    const handleSelectChat = (chatId: string) => setSelectedChatId(chatId)
    const handleBackToList = () => setSelectedChatId(null)

    return (
        <>
            {/* Backdrop */}
            {isChatOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                    onClick={closeChat}
                />
            )}

            {/* Panel Drawer */}
            <div
                className={`
                    fixed top-0 right-0 bottom-0 z-[70]
                    w-full sm:w-[480px] md:w-[560px] lg:w-[640px]
                    bg-black border-l border-white/[0.06]
                    shadow-2xl shadow-black/60
                    transform transition-transform duration-300 ease-in-out
                    ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
                    flex flex-col
                `}
            >
                {/* Panel Header */}
                <div className="h-14 flex items-center justify-between px-4 bg-[#111111] border-b border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-3">
                        {selectedChatId ? (
                            <button
                                onClick={handleBackToList}
                                className="flex items-center gap-2 text-[#25D366] hover:text-[#1fad52] transition-colors text-sm font-medium"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Conversaciones
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                                    <MessageSquare size={16} className="text-black" />
                                </div>
                                <h2 className="text-white font-semibold text-base">Chat Interno</h2>
                                {totalUnread > 0 && (
                                    <span className="min-w-5 h-5 px-1.5 bg-[#25D366] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {totalUnread > 99 ? '99+' : totalUnread}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={closeChat}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Panel Content */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <Suspense fallback={
                        <div className="flex-1 flex items-center justify-center text-white/55">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Cargando...</span>
                            </div>
                        </div>
                    }>
                        {selectedChatId ? (
                            <div className="flex-1 flex flex-col min-h-0">
                                <ChatWindow chatId={selectedChatId} />
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto">
                                <ConversationList
                                    onSelectChat={handleSelectChat}
                                    selectedChatId={selectedChatId}
                                />
                            </div>
                        )}
                    </Suspense>
                </div>
            </div>
        </>
    )
}
