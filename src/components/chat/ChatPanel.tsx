'use client'

import { useState, useEffect, Suspense } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { ConversationList } from './ConversationList'
import { ChatWindow } from './ChatWindow'
import { createClient } from '@/utils/supabase/client'
import { useChat } from '@/context/ChatContext'

export function ChatPanel() {
    const { isChatOpen, closeChat, activeChatId } = useChat()
    
    // We maintain a local selectedChatId for navigation within the panel, 
    // initialized by the context's activeChatId. When context activeChatId changes, we update local state.
    const [selectedChatId, setSelectedChatId] = useState<string | null>(activeChatId)

    useEffect(() => {
        setSelectedChatId(activeChatId)
    }, [activeChatId])

    const [totalUnread, setTotalUnread] = useState(0)
    const [supabase] = useState(() => createClient())

    // Fetch total unread count for the badge
    useEffect(() => {
        const fetchUnread = async () => {
            const { data } = await supabase
                .from('chats')
                .select('unread_count')
            if (data) {
                const total = data.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0)
                setTotalUnread(total)
            }
        }
        fetchUnread()
        const interval = setInterval(fetchUnread, 5000)

        const channel = supabase
            .channel('chat-panel-unread')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, fetchUnread)
            .subscribe()

        return () => {
            clearInterval(interval)
            supabase.removeChannel(channel)
        }
    }, [supabase])

    const handleSelectChat = (chatId: string) => {
        setSelectedChatId(chatId)
    }

    const handleBackToList = () => {
        setSelectedChatId(null)
    }

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
                    bg-[#111b21] border-l border-[#2a3942]
                    shadow-2xl shadow-black/40
                    transform transition-transform duration-300 ease-in-out
                    ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
                    flex flex-col
                `}
            >
                {/* Panel Header */}
                <div className="h-14 flex items-center justify-between px-4 bg-[#202c33] border-b border-[#2a3942] shrink-0">
                    <div className="flex items-center gap-3">
                        {selectedChatId ? (
                            <button
                                onClick={handleBackToList}
                                className="flex items-center gap-2 text-[#00a884] hover:text-[#06cf9c] transition-colors text-sm font-medium"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Conversaciones
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00a884] to-[#008069] flex items-center justify-center">
                                    <MessageSquare size={16} className="text-white" />
                                </div>
                                <h2 className="text-[#e9edef] font-semibold text-base">Chat Interno</h2>
                                {totalUnread > 0 && (
                                    <span className="min-w-5 h-5 px-1.5 bg-[#00a884] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {totalUnread > 99 ? '99+' : totalUnread}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={closeChat}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#aebac1] hover:text-white hover:bg-[#2a3942] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Panel Content */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <Suspense fallback={
                        <div className="flex-1 flex items-center justify-center text-[#8696a0]">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Cargando...</span>
                            </div>
                        </div>
                    }>
                        {selectedChatId ? (
                            /* Chat Window View */
                            <div className="flex-1 flex flex-col min-h-0">
                                <ChatWindow chatId={selectedChatId} />
                            </div>
                        ) : (
                            /* Conversation List View */
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
