'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Paperclip, Smile, MoreVertical, Mic, MicOff, X, Bell, Image as ImageIcon, Tag } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { createClient } from '@/utils/supabase/client'
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'
import { useSearchParams } from 'next/navigation'
import { formatMessageTime, formatDateSeparator, isDifferentDay } from '@/lib/formatTime'
import { CRM_TAGS } from './ConversationList'
import { cn } from '@/lib/utils'

interface Message {
    id: string
    content: string
    is_from_me: boolean
    created_at: string
    status: 'sent' | 'delivered' | 'read'
    media_url?: string | null
    media_type?: string | null
    _deleted?: boolean
}

interface ChatDetails {
    contact_name: string
    phone_number: string
    tags?: string[]
}

export function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([])
    const [chatDetails, setChatDetails] = useState<ChatDetails | null>(null)
    const [newMessage, setNewMessage] = useState('')
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
    const [isSendingReminder, setIsSendingReminder] = useState(false)
    const [reminderResult, setReminderResult] = useState<string | null>(null)
    const [isResendingPlans, setIsResendingPlans] = useState(false)
    const [resendPlansResult, setResendPlansResult] = useState<string | null>(null)
    const [showTagMenu, setShowTagMenu] = useState(false)

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false)
    const [recordingSeconds, setRecordingSeconds] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [supabase] = useState(() => createClient())
    const searchParams = useSearchParams()
    const activeChatId = searchParams.get('chatId')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!activeChatId) return

        const fetchMessages = async () => {
            setLoading(true)
            const { data: chat } = await supabase
                .from('chats')
                .select('contact_name, phone_number, tags')
                .eq('id', activeChatId)
                .single()

            if (chat) setChatDetails(chat as any)

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
        supabase.from('chats').update({ unread_count: 0 }).eq('id', activeChatId)

        // Polling every 3 seconds
        const pollInterval = setInterval(async () => {
            const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', activeChatId)
                .order('created_at', { ascending: true })

            if (msgs) {
                setMessages(prev => {
                    if (msgs.length !== prev.length ||
                        (msgs.length > 0 && prev.length > 0 && msgs[msgs.length - 1].id !== prev[prev.length - 1].id)) {
                        scrollToBottom()
                        return msgs
                    }
                    return prev
                })
            }
        }, 3000)

        // Realtime
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

        const tempMsg: Message = {
            id: Date.now().toString(),
            content: newMessage,
            is_from_me: true,
            created_at: new Date().toISOString(),
            status: 'sent'
        }
        setMessages(prev => [...prev, tempMsg])
        setNewMessage('')
        scrollToBottom()

        try {
            await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: activeChatId, content: tempMsg.content })
            })
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    // ===== DRAG & DROP (Bug 4) =====
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file && activeChatId) {
            await uploadFile(file)
        }
    }, [activeChatId])

    const uploadFile = async (file: File) => {
        if (!activeChatId) return
        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('chatId', activeChatId)
            formData.append('file', file)

            // Optimistic preview for images
            if (file.type.startsWith('image/')) {
                const objectUrl = URL.createObjectURL(file)
                const tempMsg: Message = {
                    id: Date.now().toString(),
                    content: '',
                    is_from_me: true,
                    created_at: new Date().toISOString(),
                    status: 'sent',
                    media_url: objectUrl,
                    media_type: 'image'
                }
                setMessages(prev => [...prev, tempMsg])
                scrollToBottom()
            }

            const response = await fetch('/api/chat/send-media', { method: 'POST', body: formData })
            const result = await response.json()
            if (!response.ok) {
                console.error('Error en upload:', result.error)
                alert('Error al enviar archivo: ' + result.error)
            }
        } catch (error) {
            console.error('Error uploading file:', error)
            alert('Error subiendo archivo')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) await uploadFile(file)
    }

    // ===== AUDIO RECORDING (Bug 4) =====
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
            const mediaRecorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop())
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
                if (audioBlob.size > 0 && activeChatId) {
                    const audioFile = new File([audioBlob], `audio_${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'ogg'}`, { type: mimeType })
                    await uploadFile(audioFile)
                }
            }

            mediaRecorder.start(200)
            setIsRecording(true)
            setRecordingSeconds(0)

            recordingTimerRef.current = setInterval(() => {
                setRecordingSeconds(s => s + 1)
            }, 1000)
        } catch (err) {
            console.error('Error accediendo al micrófono:', err)
            alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current)
        }
        setIsRecording(false)
        setRecordingSeconds(0)
    }

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.ondataavailable = null
            mediaRecorderRef.current.onstop = null
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current)
        }
        audioChunksRef.current = []
        setIsRecording(false)
        setRecordingSeconds(0)
    }

    const formatRecordingTime = (s: number) => {
        const mm = Math.floor(s / 60).toString().padStart(2, '0')
        const ss = (s % 60).toString().padStart(2, '0')
        return `${mm}:${ss}`
    }

    // ===== EMOJI =====
    const onEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(prev => prev + emojiData.emoji)
    }

    // ===== DELETE MESSAGE (visual only, Bug 4) =====
    const handleDeleteMessage = (msgId: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, _deleted: true } : m))
    }

    // ===== RESEND PLANS (Plan list interactiva) =====
    const handleResendPlans = async () => {
        if (!activeChatId || isResendingPlans) return
        setIsResendingPlans(true)
        setResendPlansResult(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch('/api/chat/resend-plans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ chatId: activeChatId })
            })
            const result = await response.json()
            if (response.ok) {
                setResendPlansResult('✅ Lista de planes enviada')
            } else {
                setResendPlansResult(`⚠️ ${result.error || 'Error al enviar'}`)
            }
        } catch {
            setResendPlansResult('❌ Error de red')
        } finally {
            setIsResendingPlans(false)
            setTimeout(() => setResendPlansResult(null), 5000)
        }
    }

    const handleSendReminder = async () => {
        if (!chatDetails?.phone_number || isSendingReminder) return
        setIsSendingReminder(true)
        setReminderResult(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch('/api/subscription-reminders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ phoneNumber: chatDetails.phone_number })
            })
            const result = await response.json()
            if (response.ok && result.sent > 0) {
                setReminderResult('✅ Recordatorio enviado')
            } else {
                setReminderResult(`⚠️ ${result.error || result.hint || 'No se pudo enviar'}`)
            }
        } catch (err) {
            setReminderResult('❌ Error de red')
        } finally {
            setIsSendingReminder(false)
            setTimeout(() => setReminderResult(null), 5000)
        }
    }

    if (!activeChatId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a] text-[#8696a0] relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-[80%] h-[80%] text-white" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4ZM12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8Z" />
                    </svg>
                </div>
                <div className="z-10 text-center">
                    <div className="bg-[#202c33] p-6 rounded-full inline-flex mb-6 text-[#8696a0]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-16 h-16">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-[#e9edef]">No se ha seleccionado ninguna conversación</h3>
                    <p className="mt-2 text-[#8696a0] max-w-sm mx-auto">Selecciona un chat de la lista para ver el historial y responder.</p>
                </div>
            </div>
        )
    }

    return (
        <div
            className="flex-1 flex flex-col h-full bg-[#0b141a] relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* LIGHTBOX (Bug 4) */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Imagen ampliada"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* DRAG & DROP OVERLAY (Bug 4) */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-[#00a884]/20 border-2 border-dashed border-[#00a884] rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="text-center text-[#00a884]">
                        <ImageIcon size={48} className="mx-auto mb-2" />
                        <p className="text-lg font-semibold">Suelta para enviar la imagen</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="h-16 border-b border-[#2a3942] flex items-center justify-between px-4 bg-[#202c33] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00a884] to-[#008069] flex items-center justify-center text-white font-bold text-sm">
                        {chatDetails?.contact_name?.charAt(0)?.toUpperCase() || '#'}
                    </div>
                    <div>
                        <h3 className="font-semibold text-[#e9edef] text-sm">{chatDetails?.contact_name || 'Desconocido'}</h3>
                        <span className="text-xs text-[#8696a0]">{chatDetails?.phone_number}</span>
                    </div>
                </div>

                {/* CRM Tags */}
                <div className="relative">
                    <button
                        onClick={() => setShowTagMenu(!showTagMenu)}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[#2a3942] hover:bg-[#3b4a54] text-[#aebac1] transition-colors"
                    >
                        <Tag size={12} />
                        {(chatDetails?.tags?.length || 0) > 0 && (
                            <span className="text-[10px] bg-[#00a884] text-white px-1 rounded-full">{chatDetails?.tags?.length}</span>
                        )}
                    </button>

                    {showTagMenu && (
                        <div className="absolute left-0 top-full mt-2 w-48 bg-[#233138] border border-[#2a3942] rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2">
                            <p className="px-3 py-1.5 text-[10px] text-[#8696a0] uppercase tracking-wider font-medium">Etiquetas CRM</p>
                            {Object.entries(CRM_TAGS).map(([key, tag]) => {
                                const isActive = chatDetails?.tags?.includes(key)
                                return (
                                    <button
                                        key={key}
                                        onClick={async () => {
                                            if (!activeChatId) return
                                            const action = isActive ? 'remove' : 'add'
                                            const { data: { session } } = await supabase.auth.getSession()
                                            await fetch('/api/chat-tags', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                                                body: JSON.stringify({ chat_id: activeChatId, action, tag: key })
                                            })
                                            // Update local state
                                            setChatDetails(prev => {
                                                if (!prev) return prev
                                                const newTags = isActive
                                                    ? (prev.tags || []).filter(t => t !== key)
                                                    : [...(prev.tags || []), key]
                                                return { ...prev, tags: newTags }
                                            })
                                        }}
                                        className={cn(
                                            "w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-[#2a3942] transition-colors",
                                            isActive ? tag.color + ' font-medium' : 'text-[#e9edef]'
                                        )}
                                    >
                                        <span>{tag.icon}</span>
                                        <span className="flex-1">{tag.label}</span>
                                        {isActive && <span className="text-[10px]">✓</span>}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Current tags display */}
                {chatDetails?.tags && chatDetails.tags.length > 0 && (
                    <div className="flex gap-1">
                        {chatDetails.tags.slice(0, 2).map(t => {
                            const tc = CRM_TAGS[t]
                            if (!tc) return null
                            return <span key={t} className={cn("text-[10px] px-1.5 py-0.5 rounded-full", tc.bg, tc.color)}>{tc.icon} {tc.label}</span>
                        })}
                    </div>
                )}
                <div className="flex items-center gap-2 text-[#aebac1]">
                    {/* Botón reenviar lista de planes */}
                    <div className="relative">
                        <button
                            onClick={handleResendPlans}
                            disabled={isResendingPlans}
                            title="Reenviar lista de planes al cliente (si no eligió ninguno)"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isResendingPlans
                                ? 'bg-emerald-600/40 text-emerald-300 cursor-wait'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                                }`}
                        >
                            <span className="text-sm">{isResendingPlans ? '⏳' : '📋'}</span>
                            <span className="hidden sm:inline">{isResendingPlans ? 'Enviando...' : 'Planes'}</span>
                        </button>
                        {resendPlansResult && (
                            <div className="absolute top-10 right-0 bg-[#1f2c34] text-xs text-[#e9edef] px-3 py-1.5 rounded-lg shadow-lg border border-[#2a3942] whitespace-nowrap z-10">
                                {resendPlansResult}
                            </div>
                        )}
                    </div>
                    {/* Bug 3: Botón reenviar recordatorio */}
                    <div className="relative">
                        <button
                            onClick={handleSendReminder}
                            disabled={isSendingReminder}
                            title="Reenviar recordatorio de renovación (funciona aunque hayan pasado 24h)"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSendingReminder
                                ? 'bg-amber-600/40 text-amber-300 cursor-wait'
                                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                                }`}
                        >
                            <Bell size={14} className={isSendingReminder ? 'animate-bounce' : ''} />
                            <span className="hidden sm:inline">{isSendingReminder ? 'Enviando...' : 'Recordatorio'}</span>
                        </button>
                        {reminderResult && (
                            <div className="absolute top-10 right-0 bg-[#1f2c34] text-xs text-[#e9edef] px-3 py-1.5 rounded-lg shadow-lg border border-[#2a3942] whitespace-nowrap z-10">
                                {reminderResult}
                            </div>
                        )}
                    </div>
                    <button className="hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 bg-[#0b141a]"
                style={{ backgroundImage: 'url(/chat-bg-dark.png)', backgroundSize: 'contain' }}
            >
                {loading && <p className="text-center text-xs text-[#8696a0]">Cargando mensajes...</p>}

                {messages.filter(m => !m._deleted).map((msg, index) => {
                    const visibleMessages = messages.filter(m => !m._deleted)
                    const prevMsg = index > 0 ? visibleMessages[index - 1] : null
                    const showDateSeparator = !prevMsg || isDifferentDay(prevMsg.created_at, msg.created_at)
                    return (
                        <div key={msg.id}>
                            {showDateSeparator && (
                                <div className="flex items-center justify-center my-4">
                                    <div className="bg-[#182229] text-[#8696a0] text-[11px] px-3 py-1 rounded-lg shadow-sm">
                                        {formatDateSeparator(msg.created_at)}
                                    </div>
                                </div>
                            )}
                            <MessageBubble
                                content={msg.content}
                                isMine={msg.is_from_me}
                                timestamp={formatMessageTime(msg.created_at)}
                                status={msg.is_from_me ? (msg.status || 'sent') : undefined}
                                mediaUrl={msg.media_url}
                                mediaType={msg.media_type}
                                onImageClick={(url) => setLightboxUrl(url)}
                                onDelete={msg.is_from_me ? () => handleDeleteMessage(msg.id) : undefined}
                            />
                        </div>
                    )
                })}
            </div>

            {/* Input Area */}
            <div className="px-3 py-2 bg-[#202c33] shrink-0 relative">
                {showEmojiPicker && (
                    <div className="absolute bottom-[70px] left-3 z-50">
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                        <div className="relative z-50 shadow-xl rounded-lg">
                            <EmojiPicker onEmojiClick={onEmojiClick} theme={'dark' as any} lazyLoadEmojis={true} />
                        </div>
                    </div>
                )}

                {/* Recording Bar */}
                {isRecording ? (
                    <div className="flex items-center gap-3 bg-[#1f2c34] rounded-xl px-4 py-2.5 border border-red-500/30">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <span className="text-red-400 font-mono text-sm font-medium">{formatRecordingTime(recordingSeconds)}</span>
                        <div className="flex-1 flex items-center gap-1">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="bg-red-400/60 rounded-full w-1"
                                    style={{ height: `${8 + Math.sin((Date.now() / 200 + i) * 1.5) * 6}px` }}
                                />
                            ))}
                        </div>
                        <button
                            onClick={cancelRecording}
                            className="text-[#8696a0] hover:text-red-400 transition-colors p-1"
                            title="Cancelar grabación"
                        >
                            <X size={20} />
                        </button>
                        <button
                            onClick={stopRecording}
                            className="bg-[#00a884] hover:bg-[#06cf9c] text-white p-2 rounded-full transition-colors shrink-0"
                            title="Enviar audio"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button
                            className="text-[#8696a0] hover:text-[#e9edef] transition-colors p-1.5"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <Smile size={22} className={showEmojiPicker ? 'text-[#00a884]' : ''} />
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                        />
                        <button
                            className={`transition-colors p-1.5 ${isUploading ? 'text-[#00a884] animate-pulse' : 'text-[#8696a0] hover:text-[#e9edef]'}`}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            title="Adjuntar archivo"
                        >
                            <Paperclip size={22} />
                        </button>

                        <input
                            className="flex-1 bg-[#2a3942] rounded-xl px-4 py-2.5 text-[#e9edef] text-sm focus:outline-none placeholder:text-[#8696a0] min-w-0"
                            placeholder="Escribe un mensaje..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        />

                        {newMessage.trim() ? (
                            <button
                                onClick={handleSendMessage}
                                className="bg-[#00a884] hover:bg-[#06cf9c] text-white p-2.5 rounded-full transition-colors shrink-0"
                            >
                                <Send size={20} />
                            </button>
                        ) : (
                            // Bug 4: Botón de micrófono
                            <button
                                onMouseDown={startRecording}
                                onTouchStart={startRecording}
                                className="bg-[#00a884] hover:bg-[#06cf9c] text-white p-2.5 rounded-full transition-colors shrink-0"
                                title="Mantén presionado para grabar audio"
                            >
                                <Mic size={20} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
