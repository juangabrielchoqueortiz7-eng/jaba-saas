'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Paperclip, Smile, MoreVertical, Mic, X, Bell, Image as ImageIcon, Tag, Zap, Search, Info } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { ContactInfoSidebar } from './ContactInfoSidebar'
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

interface ChatWindowProps {
    chatId?: string | null
}

export function ChatWindow({ chatId: externalChatId }: ChatWindowProps = {}) {
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
    const [showContactInfo, setShowContactInfo] = useState(false)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [messageSearch, setMessageSearch] = useState('')

    // Quick replies
    const QR_KEY = 'jaba_quick_replies'
    type QuickReply = { id: string; shortcut: string; content: string }
    const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
    const [showQRPopup, setShowQRPopup] = useState(false)
    const [qrFilter, setQrFilter] = useState('')
    const [selectedQRIndex, setSelectedQRIndex] = useState(0)
    const [showQRModal, setShowQRModal] = useState(false)
    const [newQRShortcut, setNewQRShortcut] = useState('')
    const [newQRContent, setNewQRContent] = useState('')

    useEffect(() => {
        try {
            const stored = localStorage.getItem(QR_KEY)
            if (stored) setQuickReplies(JSON.parse(stored))
        } catch {}
    }, [])

    const saveQuickReplies = (replies: QuickReply[]) => {
        setQuickReplies(replies)
        localStorage.setItem(QR_KEY, JSON.stringify(replies))
    }

    const filteredQR = quickReplies.filter(qr =>
        qrFilter === '' ||
        qr.shortcut.toLowerCase().includes(qrFilter.toLowerCase()) ||
        qr.content.toLowerCase().includes(qrFilter.toLowerCase())
    )

    const applyQR = (qr: QuickReply) => {
        setNewMessage(qr.content)
        setShowQRPopup(false)
        setQrFilter('')
    }

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false)
    const [recordingSeconds, setRecordingSeconds] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [supabase] = useState(() => createClient())
    const searchParams = useSearchParams()
    const activeChatId = externalChatId !== undefined ? externalChatId : searchParams.get('chatId')
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

        // Solo Realtime — sin polling de 3s
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
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${activeChatId}`
            }, (payload) => {
                setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
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
            <div className="flex-1 flex flex-col items-center justify-center bg-black text-white/30 relative overflow-hidden">
                <div className="z-10 text-center">
                    <div className="bg-[#111111] border border-white/[0.06] p-6 rounded-full inline-flex mb-6 text-white/20">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-16 h-16">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Selecciona una conversación</h3>
                    <p className="mt-2 text-white/30 max-w-sm mx-auto text-sm">Elige un chat de la lista para ver el historial y responder.</p>
                </div>
            </div>
        )
    }

    const displayMessages = messageSearch
        ? messages.filter(m => m.content?.toLowerCase().includes(messageSearch.toLowerCase()))
        : messages

    return (
        <div className="flex-1 flex h-full min-h-0">
        <div
            className="flex-1 flex flex-col h-full bg-black relative min-w-0"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* LIGHTBOX */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2 hover:bg-white/20 transition-colors"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Imagen ampliada"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* DRAG & DROP OVERLAY */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-[#25D366]/10 border-2 border-dashed border-[#25D366] rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="text-center text-[#25D366]">
                        <ImageIcon size={48} className="mx-auto mb-2" />
                        <p className="text-lg font-semibold">Suelta para enviar la imagen</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="border-b border-white/[0.06] bg-[#111111] shrink-0">
                <div className="h-14 flex items-center justify-between px-4 gap-2">
                    {/* Avatar + info — clickeable para abrir sidebar */}
                    <button
                        onClick={() => setShowContactInfo(v => !v)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                    >
                        <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-black font-bold text-sm shrink-0">
                            {chatDetails?.contact_name?.charAt(0)?.toUpperCase() || '#'}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-white text-sm truncate">{chatDetails?.contact_name || 'Desconocido'}</h3>
                            <span className="text-xs text-white/30">{chatDetails?.phone_number}</span>
                        </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                        {/* Tags CRM */}
                        <div className="relative">
                            <button
                                onClick={() => setShowTagMenu(!showTagMenu)}
                                className="flex items-center gap-1 p-2 rounded-xl text-xs bg-white/[0.06] hover:bg-white/[0.10] text-white/55 transition-colors"
                            >
                                <Tag size={14} />
                                {(chatDetails?.tags?.length || 0) > 0 && (
                                    <span className="text-[10px] bg-[#25D366] text-black px-1 rounded-full font-bold">{chatDetails?.tags?.length}</span>
                                )}
                            </button>
                            {showTagMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-[#141414] border border-white/[0.06] rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2">
                                    <p className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wider font-medium">Etiquetas CRM</p>
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
                                                    setChatDetails(prev => {
                                                        if (!prev) return prev
                                                        const newTags = isActive
                                                            ? (prev.tags || []).filter(t => t !== key)
                                                            : [...(prev.tags || []), key]
                                                        return { ...prev, tags: newTags }
                                                    })
                                                }}
                                                className={cn(
                                                    "w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-white/[0.06] transition-colors",
                                                    isActive ? tag.color + ' font-medium' : 'text-white'
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

                        {/* Planes */}
                        <div className="relative">
                            <button
                                onClick={handleResendPlans}
                                disabled={isResendingPlans}
                                title="Reenviar lista de planes"
                                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition-all ${isResendingPlans
                                    ? 'bg-emerald-600/20 text-emerald-300 cursor-wait'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                                    }`}
                            >
                                <span>{isResendingPlans ? '⏳' : '📋'}</span>
                                <span className="hidden lg:inline text-[11px]">{isResendingPlans ? 'Enviando...' : 'Planes'}</span>
                            </button>
                            {resendPlansResult && (
                                <div className="absolute top-10 right-0 bg-[#0a0a0a] text-xs text-white px-3 py-1.5 rounded-xl shadow-lg border border-white/[0.06] whitespace-nowrap z-10">
                                    {resendPlansResult}
                                </div>
                            )}
                        </div>

                        {/* Recordatorio */}
                        <div className="relative">
                            <button
                                onClick={handleSendReminder}
                                disabled={isSendingReminder}
                                title="Reenviar recordatorio de renovación"
                                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition-all ${isSendingReminder
                                    ? 'bg-amber-600/20 text-amber-300 cursor-wait'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
                                    }`}
                            >
                                <Bell size={13} className={isSendingReminder ? 'animate-bounce' : ''} />
                                <span className="hidden lg:inline text-[11px]">{isSendingReminder ? 'Enviando...' : 'Recordatorio'}</span>
                            </button>
                            {reminderResult && (
                                <div className="absolute top-10 right-0 bg-[#0a0a0a] text-xs text-white px-3 py-1.5 rounded-xl shadow-lg border border-white/[0.06] whitespace-nowrap z-10">
                                    {reminderResult}
                                </div>
                            )}
                        </div>

                        {/* Buscar */}
                        <button
                            onClick={() => { setIsSearchOpen(v => !v); setMessageSearch('') }}
                            className={cn("p-2 rounded-xl transition-colors", isSearchOpen ? "bg-[#25D366]/10 text-[#25D366]" : "text-white/55 hover:text-white hover:bg-white/[0.06]")}
                            title="Buscar en mensajes"
                        >
                            <Search size={16} />
                        </button>

                        {/* Info contacto */}
                        <button
                            onClick={() => setShowContactInfo(v => !v)}
                            className={cn("p-2 rounded-xl transition-colors", showContactInfo ? "bg-[#25D366]/10 text-[#25D366]" : "text-white/55 hover:text-white hover:bg-white/[0.06]")}
                            title="Info del contacto"
                        >
                            <Info size={16} />
                        </button>
                    </div>
                </div>

                {/* Search bar */}
                {isSearchOpen && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                            <input
                                autoFocus
                                type="text"
                                value={messageSearch}
                                onChange={e => setMessageSearch(e.target.value)}
                                placeholder="Buscar en mensajes..."
                                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#25D366] placeholder:text-white/30"
                            />
                        </div>
                        {messageSearch && (
                            <span className="text-xs text-white/30 shrink-0">
                                {displayMessages.filter(m => !m._deleted).length} resultado{displayMessages.filter(m => !m._deleted).length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 bg-black"
            >
                {loading && <p className="text-center text-xs text-white/30">Cargando mensajes...</p>}

                {displayMessages.filter(m => !m._deleted).map((msg, index) => {
                    const visibleMessages = displayMessages.filter(m => !m._deleted)
                    const prevMsg = index > 0 ? visibleMessages[index - 1] : null
                    const showDateSeparator = !prevMsg || isDifferentDay(prevMsg.created_at, msg.created_at)
                    return (
                        <div key={msg.id}>
                            {showDateSeparator && (
                                <div className="flex items-center justify-center my-4">
                                    <div className="bg-[#0a0a0a] border border-white/[0.06] text-white/30 text-[11px] px-3 py-1 rounded-full shadow-sm">
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
                                searchHighlight={messageSearch || undefined}
                            />
                        </div>
                    )
                })}
            </div>

            {/* Quick Replies Modal */}
            {showQRModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
                    <div className="bg-[#111111] border border-white/[0.06] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2"><Zap size={16} className="text-[#25D366]" /> Respuestas Rápidas</h3>
                            <button onClick={() => setShowQRModal(false)} className="text-white/30 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-4 border-b border-white/[0.06] space-y-2">
                            <p className="text-xs text-white/30">Escribe <span className="text-[#25D366] font-mono">/atajo</span> en el chat para insertar rápido.</p>
                            <input
                                placeholder="Atajo (ej: hola, pago, gracias)"
                                value={newQRShortcut}
                                onChange={e => setNewQRShortcut(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#25D366] placeholder:text-white/30"
                            />
                            <textarea
                                placeholder="Mensaje completo..."
                                value={newQRContent}
                                onChange={e => setNewQRContent(e.target.value)}
                                rows={3}
                                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#25D366] placeholder:text-white/30 resize-none"
                            />
                            <button
                                onClick={() => {
                                    if (!newQRShortcut.trim() || !newQRContent.trim()) return
                                    saveQuickReplies([...quickReplies, { id: Date.now().toString(), shortcut: newQRShortcut.trim(), content: newQRContent.trim() }])
                                    setNewQRShortcut(''); setNewQRContent('')
                                }}
                                className="w-full bg-[#25D366] hover:bg-[#1fad52] text-black rounded-xl py-2 text-sm font-semibold transition-colors"
                            >
                                Agregar Respuesta
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {quickReplies.length === 0 && <p className="text-white/30 text-sm text-center py-4">No hay respuestas rápidas aún.</p>}
                            {quickReplies.map(qr => (
                                <div key={qr.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex gap-3">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[#25D366] font-mono text-xs">/{qr.shortcut}</span>
                                        <p className="text-white text-sm mt-1 line-clamp-2">{qr.content}</p>
                                    </div>
                                    <button onClick={() => saveQuickReplies(quickReplies.filter(r => r.id !== qr.id))} className="text-white/30 hover:text-red-400 transition-colors shrink-0 mt-1">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="px-3 py-2.5 bg-[#111111] border-t border-white/[0.06] shrink-0 relative">
                {/* Quick Replies Popup */}
                {showQRPopup && (
                    <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#141414] border border-white/[0.06] rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                        <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.06]">
                            <span className="text-[10px] text-white/30 uppercase tracking-wider flex items-center gap-1"><Zap size={10} /> Respuestas rápidas</span>
                            <button onClick={() => { setShowQRPopup(false); setShowQRModal(true) }} className="text-[10px] text-[#25D366] hover:underline">Gestionar</button>
                        </div>
                        {filteredQR.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-white/30 text-center">
                                No hay respuestas. <button onClick={() => { setShowQRPopup(false); setShowQRModal(true) }} className="text-[#25D366]">Crear una</button>
                            </div>
                        ) : filteredQR.map((qr, i) => (
                            <button
                                key={qr.id}
                                onClick={() => applyQR(qr)}
                                className={cn("w-full px-3 py-2.5 text-left hover:bg-white/[0.06] transition-colors flex items-center gap-3", i === selectedQRIndex && "bg-white/[0.06]")}
                            >
                                <span className="text-[#25D366] font-mono text-xs shrink-0">/{qr.shortcut}</span>
                                <span className="text-white text-sm truncate">{qr.content}</span>
                            </button>
                        ))}
                    </div>
                )}

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
                    <div className="flex items-center gap-3 bg-[#0a0a0a] border border-red-500/20 rounded-xl px-4 py-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <span className="text-red-400 font-mono text-sm font-medium">{formatRecordingTime(recordingSeconds)}</span>
                        <div className="flex-1 flex items-center gap-0.5">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="bg-red-400/50 rounded-full w-1"
                                    style={{ height: `${8 + Math.sin((Date.now() / 200 + i) * 1.5) * 6}px` }}
                                />
                            ))}
                        </div>
                        <button onClick={cancelRecording} className="text-white/30 hover:text-red-400 transition-colors p-1" title="Cancelar">
                            <X size={18} />
                        </button>
                        <button onClick={stopRecording} className="bg-[#25D366] hover:bg-[#1fad52] text-black p-2 rounded-full transition-colors shrink-0" title="Enviar audio">
                            <Send size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <button
                            className={cn("p-2 rounded-xl transition-colors", showEmojiPicker ? "text-[#25D366]" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <Smile size={20} />
                        </button>

                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" />
                        <button
                            className={cn("p-2 rounded-xl transition-colors", isUploading ? "text-[#25D366] animate-pulse" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            title="Adjuntar archivo"
                        >
                            <Paperclip size={20} />
                        </button>
                        <button
                            className="p-2 rounded-xl text-white/30 hover:text-[#25D366] hover:bg-white/[0.06] transition-colors"
                            onClick={() => setShowQRModal(true)}
                            title="Respuestas rápidas (o escribe /)"
                        >
                            <Zap size={20} />
                        </button>

                        <input
                            className="flex-1 bg-white/[0.06] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#25D366] placeholder:text-white/30 min-w-0"
                            placeholder="Escribe un mensaje... (/ para respuestas rápidas)"
                            value={newMessage}
                            onChange={(e) => {
                                const val = e.target.value
                                setNewMessage(val)
                                if (val.startsWith('/')) {
                                    setQrFilter(val.slice(1))
                                    setShowQRPopup(true)
                                    setSelectedQRIndex(0)
                                } else {
                                    setShowQRPopup(false)
                                }
                            }}
                            onKeyDown={(e) => {
                                if (showQRPopup && filteredQR.length > 0) {
                                    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedQRIndex(i => Math.min(i + 1, filteredQR.length - 1)); return }
                                    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedQRIndex(i => Math.max(i - 1, 0)); return }
                                    if (e.key === 'Enter') { e.preventDefault(); applyQR(filteredQR[selectedQRIndex]); return }
                                    if (e.key === 'Escape') { setShowQRPopup(false); return }
                                }
                                if (e.key === 'Enter' && !e.shiftKey && !showQRPopup) handleSendMessage()
                            }}
                        />

                        {newMessage.trim() ? (
                            <button onClick={handleSendMessage} className="bg-[#25D366] hover:bg-[#1fad52] text-black p-2.5 rounded-full transition-colors shrink-0">
                                <Send size={18} />
                            </button>
                        ) : (
                            <button
                                onMouseDown={startRecording}
                                onTouchStart={startRecording}
                                className="bg-[#25D366] hover:bg-[#1fad52] text-black p-2.5 rounded-full transition-colors shrink-0"
                                title="Mantén presionado para grabar audio"
                            >
                                <Mic size={18} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Contact Info Sidebar */}
        {showContactInfo && chatDetails && activeChatId && (
            <ContactInfoSidebar
                phoneNumber={chatDetails.phone_number}
                chatId={activeChatId}
                contactName={chatDetails.contact_name}
                tags={chatDetails.tags}
                onClose={() => setShowContactInfo(false)}
            />
        )}
        </div>
    )
}
