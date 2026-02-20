'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Paperclip, Smile, MoreVertical, Phone, Video } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import { formatMessageTime, formatDateSeparator, isDifferentDay } from '@/lib/formatTime'

interface Message {
    id: string
    content: string
    is_from_me: boolean
    created_at: string
    status: 'sent' | 'delivered' | 'read'
}

interface ChatDetails {
    contact_name: string
    phone_number: string
}

export function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([])
    const [chatDetails, setChatDetails] = useState<ChatDetails | null>(null)
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [supabase] = useState(() => createClient())
    const searchParams = useSearchParams()
    const activeChatId = searchParams.get('chatId')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!activeChatId) return

        const fetchMessages = async () => {
            setLoading(true)
            // 1. Get Chat Details
            const { data: chat } = await supabase
                .from('chats')
                .select('contact_name, phone_number')
                .eq('id', activeChatId)
                .single()

            if (chat) setChatDetails(chat)

            // 2. Get Messages
            const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', activeChatId)
                .order('created_at', { ascending: true })

            if (msgs) setMessages(msgs)
            setLoading(false)
            scrollToBottom()
        }

        fetchMessages()

        // Reset unread count when opening chat
        const resetUnread = async () => {
            await supabase.from('chats').update({ unread_count: 0 }).eq('id', activeChatId)
        }
        resetUnread()

        // Polling: refresh messages every 3 seconds for reliable updates
        const pollInterval = setInterval(async () => {
            const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', activeChatId)
                .order('created_at', { ascending: true })

            if (msgs) {
                setMessages(prev => {
                    // Only update if there are new messages (avoid unnecessary re-renders)
                    if (msgs.length !== prev.length ||
                        (msgs.length > 0 && prev.length > 0 && msgs[msgs.length - 1].id !== prev[prev.length - 1].id)) {
                        scrollToBottom()
                        return msgs
                    }
                    return prev
                })
            }
        }, 3000)

        // Realtime (instant updates when available)
        const channel = supabase
            .channel(`chat:${activeChatId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${activeChatId}`
            }, (payload) => {
                const newMsg = payload.new as Message
                setMessages((prev) => {
                    if (prev.some(m => m.id === newMsg.id)) return prev
                    const filtered = prev.filter(m => {
                        if (/^\d+$/.test(m.id) && m.is_from_me && newMsg.is_from_me && m.content === newMsg.content) {
                            return false
                        }
                        return true
                    })
                    return [...filtered, newMsg]
                })
                scrollToBottom()
            })
            .subscribe()

        return () => {
            clearInterval(pollInterval)
            supabase.removeChannel(channel)
        }
    }, [activeChatId, supabase])

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
        }, 100)
    }

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !activeChatId) return

        try {
            // Optimistic update
            const tempMsg = {
                id: Date.now().toString(),
                content: newMessage,
                is_from_me: true,
                created_at: new Date().toISOString(),
                status: 'sent' as const
            }
            setMessages(prev => [...prev, tempMsg])
            setNewMessage('')
            scrollToBottom()

            // Call API to Send & Save
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: activeChatId,
                    content: tempMsg.content
                })
            })

            const result = await response.json()

            if (!response.ok) {
                console.error('Error sending message:', result.error)
                // Optional: Show error toast or revert optimistic update
                // setMessages(prev => prev.filter(m => m.id !== tempMsg.id)) 
            }
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    if (!activeChatId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 relative overflow-hidden">
                {/* Background Pattern (Watermark) */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-[80%] h-[80%] text-white" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4ZM12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8Z" />
                    </svg>
                </div>

                <div className="z-10 text-center">
                    <div className="bg-slate-900 p-6 rounded-full inline-flex mb-6 text-slate-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-16 h-16">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-slate-300">No se ha seleccionado ninguna conversación</h3>
                    <p className="mt-2 text-slate-600 max-w-sm mx-auto">Selecciona un chat de la lista derecha para ver el historial y responder.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-950">
            {/* Header */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                        {chatDetails?.contact_name?.charAt(0) || '#'}
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{chatDetails?.contact_name || 'Desconocido'}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{chatDetails?.phone_number}</span>
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
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('/chat-bg-dark.png')] bg-contain"
            >
                {loading && <p className="text-center text-xs text-slate-500">Cargando mensajes...</p>}

                {messages.map((msg, index) => {
                    const showDateSeparator = index === 0 || isDifferentDay(messages[index - 1].created_at, msg.created_at)
                    return (
                        <div key={msg.id}>
                            {showDateSeparator && (
                                <div className="flex items-center justify-center my-4">
                                    <div className="bg-slate-800/80 text-slate-300 text-xs px-4 py-1.5 rounded-lg shadow-sm border border-slate-700/50">
                                        {formatDateSeparator(msg.created_at)}
                                    </div>
                                </div>
                            )}
                            <MessageBubble
                                content={msg.content}
                                isMine={msg.is_from_me}
                                timestamp={formatMessageTime(msg.created_at)}
                                status={msg.is_from_me ? (msg.status || 'sent') : undefined}
                            />
                        </div>
                    )
                })}
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
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button
                        onClick={handleSendMessage}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}
