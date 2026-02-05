'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Paperclip, Smile, MoreVertical, Phone, Video } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'

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

        // Realtime
        const channel = supabase
            .channel(`chat:${activeChatId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${activeChatId}`
            }, (payload) => {
                setMessages((prev) => [...prev, payload.new as Message])
                scrollToBottom()
            })
            .subscribe()

        return () => {
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

            // Insert into DB
            await supabase.from('messages').insert({
                chat_id: activeChatId,
                content: tempMsg.content,
                is_from_me: true,
                status: 'sent'
            })

            // Update chat last message
            await supabase.from('chats').update({
                last_message: tempMsg.content,
                last_message_time: tempMsg.created_at
            }).eq('id', activeChatId)

        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    if (!activeChatId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
                <p>Selecciona una conversación para empezar</p>
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

                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        content={msg.content}
                        isMine={msg.is_from_me}
                        timestamp={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        status={msg.status}
                    />
                ))}
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
