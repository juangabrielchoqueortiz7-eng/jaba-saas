
import { cn } from '@/lib/utils'
import { Check, CheckCheck, Image as ImageIcon, FileText, Play, Mic, Trash2 } from 'lucide-react'
import { useState, useRef } from 'react'

interface MessageBubbleProps {
    content: string
    isMine: boolean
    timestamp: string
    status?: 'sent' | 'delivered' | 'read'
    mediaUrl?: string | null
    mediaType?: string | null
    onImageClick?: (url: string) => void
    onDelete?: () => void
    searchHighlight?: string
}

// Detectar si el mensaje es una lista de planes enviada via WhatsApp interactivo
function isPlanListMessage(content: string) {
    return content?.startsWith('📋 *Planes Enviados:*') || content?.startsWith('📋 *Lista de Planes')
}

function parsePlanLines(content: string): string[] {
    return content
        .split('\n')
        .filter(line => line.startsWith('• '))
        .map(line => line.replace('• ', '').trim())
}

function isReminderTemplateMessage(content: string) {
    return content?.includes('[Template: recordatorio_renovacion_v1')
}

function highlightText(text: string, highlight: string) {
    if (!highlight) return <>{text}</>
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase()
                    ? <mark key={i} className="bg-[#25D366]/30 text-white rounded-sm px-0.5">{part}</mark>
                    : part
            )}
        </>
    )
}

export function MessageBubble({ content, isMine, timestamp, status, mediaUrl, mediaType, onImageClick, onDelete, searchHighlight }: MessageBubbleProps) {
    const [imageError, setImageError] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    const detectedType = mediaType || (mediaUrl ? detectMediaType(mediaUrl, content) : null)

    // === PLAN LIST CARD ===
    if (isPlanListMessage(content)) {
        const plans = parsePlanLines(content)
        return (
            <div className={cn('flex w-full mb-2 group relative', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                    'rounded-xl overflow-hidden border',
                    isMine
                        ? 'bg-[#F0FDF4] border-l-2 border-l-[#25D366] border-black/[0.06]'
                        : 'bg-white border-black/[0.08]'
                )} style={{ minWidth: 220, maxWidth: '65%' }}>
                    <div className="px-3 pt-2.5 pb-1">
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[#25D366] text-xs font-bold uppercase tracking-wide">📋 Lista de Planes Enviada</span>
                        </div>
                        <div className="space-y-1">
                            {plans.map((plan, i) => {
                                const [namePart, pricePart] = plan.split(' — ')
                                return (
                                    <div key={i} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-2 py-1.5">
                                        <span className="text-white text-xs font-medium truncate flex-1">{namePart}</span>
                                        {pricePart && <span className="text-[#25D366] text-xs font-bold ml-2 shrink-0">{pricePart.split(' ·')[0]}</span>}
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-[10px] text-white/30 mt-2">👆 El cliente lo recibió como botones interactivos</p>
                    </div>
                    <div className="px-2 pb-1 flex justify-end">
                        <span className="text-[10px] text-white/30">{timestamp}</span>
                    </div>
                </div>
            </div>
        )
    }

    const toggleAudio = () => {
        if (!audioRef.current) return
        if (audioRef.current.paused) {
            audioRef.current.play()
            setIsPlaying(true)
        } else {
            audioRef.current.pause()
            setIsPlaying(false)
        }
    }

    return (
        <div
            className={cn("flex w-full mb-0.5 group relative", isMine ? "justify-end" : "justify-start")}
            onMouseLeave={() => setShowMenu(false)}
        >
            {/* Context menu (delete) */}
            {isMine && onDelete && showMenu && (
                <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="absolute right-[calc(65%+8px)] top-1 z-10 bg-white text-[#0F172A]/55 hover:text-red-400 border border-black/[0.08] rounded-lg px-2 py-1 text-xs flex items-center gap-1 shadow-lg transition-colors"
                >
                    <Trash2 size={12} />
                    Eliminar
                </button>
            )}

            <div
                className={cn(
                    "max-w-[65%] rounded-xl shadow-sm overflow-hidden relative border",
                    isMine
                        ? "bg-[#F0FDF4] border-l-2 border-l-[#25D366] border-black/[0.06]"
                        : "bg-white border-black/[0.08]",
                    mediaUrl && detectedType !== 'audio' ? "p-0" : "px-3 py-2"
                )}
                onMouseEnter={() => isMine && setShowMenu(true)}
            >
                {/* === IMAGE === */}
                {mediaUrl && detectedType === 'image' && !imageError && (
                    <div className="relative">
                        {!imageLoaded && (
                            <div className="flex items-center justify-center w-full h-48 bg-black">
                                <ImageIcon size={32} className="text-white/30 animate-pulse" />
                            </div>
                        )}
                        <img
                            src={mediaUrl}
                            alt="Imagen"
                            className={cn(
                                "max-w-full max-h-[400px] object-contain cursor-pointer hover:opacity-90 transition-opacity",
                                !imageLoaded && "hidden"
                            )}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => setImageError(true)}
                            onClick={() => onImageClick ? onImageClick(mediaUrl) : window.open(mediaUrl, '_blank')}
                        />
                    </div>
                )}

                {/* === IMAGE FALLBACK === */}
                {mediaUrl && detectedType === 'image' && imageError && (
                    <div className="flex items-center gap-2 px-3 py-3 text-white/30">
                        <ImageIcon size={18} />
                        <span className="text-xs">Imagen no disponible</span>
                    </div>
                )}

                {/* === AUDIO === */}
                {mediaUrl && detectedType === 'audio' && (
                    <div className="flex items-center gap-3 min-w-[220px] px-3 py-2">
                        <button
                            onClick={toggleAudio}
                            className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                                isMine ? "bg-[#25D366] hover:bg-[#1fad52]" : "bg-white/[0.10] hover:bg-white/[0.15]"
                            )}
                        >
                            {isPlaying ? (
                                <span className="flex gap-0.5">
                                    <span className="w-1 h-4 bg-black rounded-sm" />
                                    <span className="w-1 h-4 bg-black rounded-sm" />
                                </span>
                            ) : (
                                <Play size={16} className={cn("ml-0.5", isMine ? "text-black" : "text-white")} />
                            )}
                        </button>
                        <div className="flex-1 min-w-0">
                            <audio
                                ref={audioRef}
                                src={mediaUrl}
                                onEnded={() => setIsPlaying(false)}
                                className="hidden"
                            />
                            <div className="flex items-center gap-0.5 h-6">
                                {Array.from({ length: 30 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn("rounded-full w-0.5", isMine ? "bg-white/40" : "bg-white/20")}
                                        style={{ height: `${6 + Math.sin(i * 0.7) * 6 + Math.cos(i * 1.3) * 3}px` }}
                                    />
                                ))}
                            </div>
                        </div>
                        <Mic size={12} className="flex-shrink-0 text-white/30" />
                    </div>
                )}

                {/* === VIDEO === */}
                {mediaUrl && detectedType === 'video' && (
                    <div className="relative">
                        <video
                            src={mediaUrl}
                            controls
                            className="max-w-full max-h-[400px] rounded-xl"
                            preload="metadata"
                        />
                    </div>
                )}

                {/* === DOCUMENT === */}
                {mediaUrl && detectedType === 'document' && (
                    <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isMine ? "bg-[#25D366]" : "bg-white/[0.10]"
                        )}>
                            <FileText size={20} className={isMine ? "text-black" : "text-white"} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-white">{content || 'Documento'}</p>
                            <p className="text-[10px] text-white/30">Toca para abrir</p>
                        </div>
                    </a>
                )}

                {/* Text content */}
                {content && detectedType !== 'document' && (
                    <div className={cn(mediaUrl && detectedType !== 'audio' ? "px-3 py-2" : "")}>
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-[19px] text-white">
                            {searchHighlight ? highlightText(content, searchHighlight) : content}
                        </p>
                    </div>
                )}

                {/* Timestamp & status */}
                <div className="text-[11px] flex items-center justify-end gap-1 px-2 pb-1 text-white/30">
                    <span>{timestamp}</span>
                    {isMine && (
                        <span className="flex items-center ml-0.5">
                            {status === 'read' ? (
                                <CheckCheck size={16} className="text-[#25D366]" />
                            ) : status === 'delivered' ? (
                                <CheckCheck size={16} className="text-white/30" />
                            ) : (
                                <Check size={16} className="text-white/30" />
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

function detectMediaType(url: string, content: string): string {
    const lower = url.toLowerCase()
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/)) return 'image'
    if (lower.match(/\.(mp3|ogg|opus|wav|m4a|aac|webm)/)) return 'audio'
    if (lower.match(/\.(mp4|mov|avi|mkv|3gp)/)) return 'video'
    if (lower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip)/)) return 'document'
    if (content.startsWith('🎵') || content.includes('audio') || content.includes('voz')) return 'audio'
    if (content.startsWith('🎬') || content.includes('video')) return 'video'
    if (content.startsWith('📎') || content.includes('Documento')) return 'document'
    return 'image'
}
