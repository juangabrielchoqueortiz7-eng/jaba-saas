
import { cn } from '@/lib/utils'
import { Check, CheckCheck, Image as ImageIcon, FileText, Play, Mic, Trash2, AlertCircle, RotateCcw, CornerUpLeft, Copy } from 'lucide-react'
import { useState, useRef } from 'react'
import NextImage from 'next/image'

interface MessageBubbleProps {
    content: string
    isMine: boolean
    timestamp: string
    status?: 'sent' | 'delivered' | 'read' | 'failed'
    mediaUrl?: string | null
    mediaType?: string | null
    onImageClick?: (url: string) => void
    onDelete?: () => void
    onRetry?: () => void
    onReply?: () => void
    searchHighlight?: string
    quotedContent?: string | null
    quotedIsMine?: boolean
    isGroupedWithPrevious?: boolean
    isGroupedWithNext?: boolean
}

// Detectar si el mensaje es una lista de planes enviada via WhatsApp interactivo
function isPlanListMessage(content: string) {
    return content?.includes('*Planes Enviados:*') || content?.includes('*Lista de Planes')
}

function parsePlanLines(content: string): string[] {
    return content
        .split('\n')
        .filter(line => /^(\u2022|-)\s+/.test(line))
        .map(line => line.replace(/^(\u2022|-)\s+/, '').trim())
}

function highlightText(text: string, highlight: string) {
    if (!highlight) return <>{text}</>
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase()
                    ? <mark key={i} className="bg-yellow-200 text-[#111B21] rounded-sm px-0.5">{part}</mark>
                    : part
            )}
        </>
    )
}

// Parse WhatsApp-style formatting: *bold*, _italic_, ~strikethrough~
function parseWhatsAppFormatting(text: string) {
    const parts: React.ReactNode[] = []
    const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g
    let lastIdx = 0
    let match

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIdx) {
            parts.push(text.slice(lastIdx, match.index))
        }
        const raw = match[0]
        if (raw.startsWith('*') && raw.endsWith('*')) {
            parts.push(<strong key={match.index} className="font-semibold">{raw.slice(1, -1)}</strong>)
        } else if (raw.startsWith('_') && raw.endsWith('_')) {
            parts.push(<em key={match.index}>{raw.slice(1, -1)}</em>)
        } else if (raw.startsWith('~') && raw.endsWith('~')) {
            parts.push(<s key={match.index}>{raw.slice(1, -1)}</s>)
        } else if (raw.startsWith('`') && raw.endsWith('`')) {
            parts.push(<code key={match.index} className="bg-black/[0.08] rounded px-1 text-[12px] font-mono">{raw.slice(1, -1)}</code>)
        }
        lastIdx = match.index + raw.length
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx))
    return parts.length > 0 ? <>{parts}</> : <>{text}</>
}

// Shared action buttons shown on hover
function ActionButtons({ onReply, onCopy, onDelete, align }: { onReply?: () => void; onCopy?: () => void; onDelete?: () => void; align: 'left' | 'right' }) {
    return (
        <div className={cn(
            "hidden sm:flex absolute top-1 z-10 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            align === 'left' ? "-left-24" : "-right-16"
        )}>
            {onReply && (
                <button
                    onClick={onReply}
                    title="Responder"
                    className="bg-white shadow-sm border border-black/[0.06] rounded-full p-1.5 hover:bg-[#F0F2F5] transition-colors"
                >
                    <CornerUpLeft size={12} className="text-[#111B21]/50" />
                </button>
            )}
            {onCopy && (
                <button
                    onClick={onCopy}
                    title="Copiar texto"
                    className="bg-white shadow-sm border border-black/[0.06] rounded-full p-1.5 hover:bg-[#F0F2F5] transition-colors"
                >
                    <Copy size={12} className="text-[#111B21]/50" />
                </button>
            )}
            {onDelete && (
                <button
                    onClick={onDelete}
                    title="Eliminar"
                    className="bg-white shadow-sm border border-black/[0.06] rounded-full p-1.5 hover:bg-[#F0F2F5] transition-colors"
                >
                    <Trash2 size={12} className="text-red-400" />
                </button>
            )}
        </div>
    )
}

export function MessageBubble({ content, isMine, timestamp, status, mediaUrl, mediaType, onImageClick, onDelete, onRetry, onReply, searchHighlight, quotedContent, quotedIsMine, isGroupedWithPrevious }: MessageBubbleProps) {
    const [imageError, setImageError] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    const detectedType = mediaType || (mediaUrl ? detectMediaType(mediaUrl, content) : null)
    const isFailed = status === 'failed'

    const handleCopy = content ? () => navigator.clipboard.writeText(content) : undefined

    // === PLAN LIST CARD ===
    if (isPlanListMessage(content)) {
        const plans = parsePlanLines(content)
        return (
            <div className={cn('flex w-full mb-1.5 group items-end gap-1.5 relative', isMine ? 'justify-end' : 'justify-start')}>
                {isMine && (
                    <ActionButtons align="left" onReply={onReply} onCopy={handleCopy} onDelete={onDelete} />
                )}
                <div className={cn(
                    'rounded-2xl overflow-hidden shadow-sm',
                    isMine ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'
                )} style={{ minWidth: 220, maxWidth: 'min(82vw, 360px)' }}>
                    <div className="px-3 pt-2.5 pb-1">
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[#075E54] text-xs font-bold uppercase tracking-wide">📋 Lista de Planes Enviada</span>
                        </div>
                        <div className="space-y-1">
                            {plans.map((plan, i) => {
                                const [namePart, pricePart] = plan.split(' — ')
                                return (
                                    <div key={i} className="flex items-center justify-between bg-black/[0.04] rounded-lg px-2 py-1.5">
                                        <span className="text-[#111B21] text-xs font-medium truncate flex-1">{namePart}</span>
                                        {pricePart && <span className="text-[#25D366] text-xs font-bold ml-2 shrink-0">{pricePart.split(' ·')[0]}</span>}
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-[10px] text-[#111B21]/40 mt-2">👆 El cliente lo recibió como botones interactivos</p>
                    </div>
                    <div className="px-3 pb-1.5 flex items-center justify-end gap-1">
                        <span className="text-[11px] text-[#111B21]/45">{timestamp}</span>
                        {isMine && <StatusIcon status={status} />}
                    </div>
                </div>
                {!isMine && (
                    <ActionButtons align="right" onReply={onReply} onCopy={handleCopy} onDelete={onDelete} />
                )}
            </div>
        )
    }

    const toggleAudio = () => {
        if (!audioRef.current) return
        if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true) }
        else { audioRef.current.pause(); setIsPlaying(false) }
    }

    return (
        <div className={cn("flex w-full group items-end", isMine ? "justify-end" : "justify-start")}>
            {/* Bubble */}
            <div
                className={cn(
                    "max-w-[82%] sm:max-w-[74%] md:max-w-[66%] relative overflow-visible",
                    isMine
                        ? isGroupedWithPrevious ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tr-sm"
                        : isGroupedWithPrevious ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-tl-sm",
                    isMine
                        ? isFailed ? "bg-red-50 shadow-sm" : "bg-[#DCF8C6] shadow-sm"
                        : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.13)]",
                    mediaUrl && detectedType !== 'audio' ? "p-0" : "px-3 py-2"
                )}
            >
                <ActionButtons
                    align={isMine ? 'left' : 'right'}
                    onReply={onReply}
                    onCopy={handleCopy}
                    onDelete={onDelete}
                />
                {/* Bubble tail */}
                {!isGroupedWithPrevious && (isMine ? (
                    <div
                        className="absolute top-0 -right-[7px] w-0 h-0"
                        style={{
                            borderTop: `8px solid ${isFailed ? '#fef2f2' : '#DCF8C6'}`,
                            borderLeft: '8px solid transparent',
                        }}
                    />
                ) : (
                    <div
                        className="absolute top-0 -left-[7px] w-0 h-0"
                        style={{
                            borderTop: '8px solid white',
                            borderRight: '8px solid transparent',
                        }}
                    />
                ))}

                {/* Quoted message */}
                {quotedContent && (
                    <div className={cn(
                        "mx-2 mt-2 pl-2.5 border-l-[3px] rounded-sm",
                        isMine ? "border-[#25D366] bg-[#075E54]/10" : "border-[#25D366] bg-black/[0.06]"
                    )}>
                        <p className="font-semibold text-[10px] text-[#25D366] pt-1">
                            {quotedIsMine ? 'Tú' : 'Cliente'}
                        </p>
                        <p className="text-[#111B21]/70 text-xs leading-tight line-clamp-2 pr-1 pb-1">{quotedContent}</p>
                    </div>
                )}

                {/* === IMAGE === */}
                {mediaUrl && detectedType === 'image' && !imageError && (
                    <div className="relative rounded-t-xl overflow-hidden">
                        {!imageLoaded && (
                            <div className="flex items-center justify-center w-full h-48 bg-black/[0.05]">
                                <ImageIcon size={28} className="text-[#111B21]/20 animate-pulse" />
                            </div>
                        )}
                        <NextImage
                            src={mediaUrl}
                            alt="Imagen"
                            width={420}
                            height={420}
                            unoptimized
                            className={cn(
                                "max-w-full max-h-[400px] object-contain cursor-pointer hover:opacity-95 transition-opacity",
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
                    <div className="flex items-center gap-2 px-3 py-3 text-[#111B21]/40">
                        <ImageIcon size={18} />
                        <span className="text-xs">Imagen no disponible</span>
                    </div>
                )}

                {/* === AUDIO === */}
                {mediaUrl && detectedType === 'audio' && (
                    <div className="flex items-center gap-3 min-w-[220px] px-3 py-2.5">
                        {/* Avatar circle */}
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                            isMine ? "bg-[#25D366]/20" : "bg-[#111B21]/08"
                        )}>
                            <Mic size={16} className={isMine ? "text-[#25D366]" : "text-[#111B21]/50"} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <audio ref={audioRef} src={mediaUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
                            {/* Waveform */}
                            <div className="flex items-center gap-0.5 h-8 mb-0.5">
                                {Array.from({ length: 32 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "rounded-full w-[2px] transition-all",
                                            isPlaying
                                                ? (i % 3 === 0 ? "bg-[#25D366]" : "bg-[#25D366]/50")
                                                : (isMine ? "bg-[#075E54]/30" : "bg-[#111B21]/20")
                                        )}
                                        style={{ height: `${6 + Math.sin(i * 0.7) * 6 + Math.cos(i * 1.3) * 3}px` }}
                                    />
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={toggleAudio}
                            className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                                isMine ? "bg-[#075E54] hover:bg-[#054d3f]" : "bg-[#25D366] hover:bg-[#1fad52]"
                            )}
                        >
                            {isPlaying ? (
                                <span className="flex gap-0.5">
                                    <span className="w-[3px] h-4 bg-white rounded-sm" />
                                    <span className="w-[3px] h-4 bg-white rounded-sm" />
                                </span>
                            ) : (
                                <Play size={16} className="text-white ml-0.5" />
                            )}
                        </button>
                    </div>
                )}

                {/* === VIDEO === */}
                {mediaUrl && detectedType === 'video' && (
                    <div className="relative rounded-t-xl overflow-hidden">
                        <video src={mediaUrl} controls className="max-w-full max-h-[400px]" preload="metadata" />
                    </div>
                )}

                {/* === DOCUMENT === */}
                {mediaUrl && detectedType === 'document' && (
                    <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-3 hover:bg-black/[0.03] transition-colors rounded-2xl"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                            isMine ? "bg-[#075E54]/15" : "bg-[#25D366]/15"
                        )}>
                            <FileText size={20} className="text-[#075E54]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-[#111B21]">{content || 'Documento'}</p>
                            <p className="text-[10px] text-[#111B21]/40 mt-0.5">Toca para abrir</p>
                        </div>
                    </a>
                )}

                {/* Text content */}
                {content && detectedType !== 'document' && (
                    <div className={cn(mediaUrl && detectedType !== 'audio' ? "px-3 py-2" : "")}>
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-[20px] text-[#111B21]">
                            {searchHighlight
                                ? highlightText(content, searchHighlight)
                                : parseWhatsAppFormatting(content)}
                        </p>
                    </div>
                )}

                {/* Failed notice */}
                {isFailed && (
                    <div className="px-3 pb-1 flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-red-500 shrink-0" />
                        <span className="text-[11px] text-red-500">No entregado</span>
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="ml-1 text-[11px] text-[#25D366] hover:underline flex items-center gap-0.5"
                            >
                                <RotateCcw size={10} /> Reintentar
                            </button>
                        )}
                    </div>
                )}

                {/* Timestamp & status */}
                <div className={cn(
                    "flex items-center justify-end gap-1 pb-1.5 pr-2",
                    (mediaUrl && detectedType !== 'audio') ? "absolute bottom-1 right-1 bg-black/20 rounded-full px-1.5" : "pt-0.5"
                )}>
                    <span className={cn(
                        "text-[11px]",
                        (mediaUrl && detectedType !== 'audio') ? "text-white/90" : "text-[#111B21]/45"
                    )}>{timestamp}</span>
                    {isMine && <StatusIcon status={status} overlay={!!(mediaUrl && detectedType !== 'audio')} />}
                </div>
            </div>
        </div>
    )
}

function StatusIcon({ status, overlay }: { status?: string; overlay?: boolean }) {
    const color = overlay ? "text-white/90" : undefined
    if (status === 'read') return <CheckCheck size={16} className={color || "text-[#53BDEB]"} />
    if (status === 'delivered') return <CheckCheck size={16} className={color || "text-[#111B21]/40"} />
    if (status === 'failed') return <AlertCircle size={14} className="text-red-500" />
    return <Check size={16} className={color || "text-[#111B21]/40"} />
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
