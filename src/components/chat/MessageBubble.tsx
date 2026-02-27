
import { cn } from '@/lib/utils'
import { Check, CheckCheck, Image as ImageIcon, FileText, Play, Mic } from 'lucide-react'
import { useState, useRef } from 'react'

interface MessageBubbleProps {
    content: string
    isMine: boolean
    timestamp: string
    status?: 'sent' | 'delivered' | 'read'
    mediaUrl?: string | null
    mediaType?: string | null
}

export function MessageBubble({ content, isMine, timestamp, status, mediaUrl, mediaType }: MessageBubbleProps) {
    const [imageError, setImageError] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)

    const detectedType = mediaType || (mediaUrl ? detectMediaType(mediaUrl, content) : null)

    return (
        <div className={cn("flex w-full mb-0.5", isMine ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[65%] rounded-lg shadow-md overflow-hidden relative",
                isMine
                    ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none"
                    : "bg-[#202c33] text-[#e9edef] rounded-tl-none",
                mediaUrl && detectedType !== 'audio' ? "p-0" : "px-3 py-1.5"
            )}>
                {/* === IMAGE === */}
                {mediaUrl && detectedType === 'image' && !imageError && (
                    <div className="relative">
                        {!imageLoaded && (
                            <div className="flex items-center justify-center w-full h-48 bg-[#111b21]">
                                <ImageIcon size={32} className="text-[#8696a0] animate-pulse" />
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
                            onClick={() => window.open(mediaUrl, '_blank')}
                        />
                    </div>
                )}

                {/* === IMAGE FALLBACK === */}
                {mediaUrl && detectedType === 'image' && imageError && (
                    <div className="flex items-center gap-2 px-3 py-3 text-[#8696a0]">
                        <ImageIcon size={18} />
                        <span className="text-xs">Imagen no disponible</span>
                    </div>
                )}

                {/* === AUDIO === */}
                {mediaUrl && detectedType === 'audio' && (
                    <div className="flex items-center gap-3 min-w-[240px]">
                        <button
                            onClick={() => {
                                if (audioRef.current) {
                                    if (audioRef.current.paused) audioRef.current.play()
                                    else audioRef.current.pause()
                                }
                            }}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                                isMine ? "bg-[#00a884] hover:bg-[#06cf9c]" : "bg-[#3b4a54] hover:bg-[#4a5c68]"
                            )}
                        >
                            <Play size={18} className="ml-0.5 text-white" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <audio
                                ref={audioRef}
                                src={mediaUrl}
                                controls
                                controlsList="nodownload"
                                className="w-full h-8"
                                style={{
                                    filter: 'invert(0.85) hue-rotate(180deg)',
                                    maxWidth: '200px'
                                }}
                            />
                        </div>
                        <Mic size={14} className="flex-shrink-0 text-[#8696a0]" />
                    </div>
                )}

                {/* === VIDEO === */}
                {mediaUrl && detectedType === 'video' && (
                    <div className="relative">
                        <video
                            src={mediaUrl}
                            controls
                            className="max-w-full max-h-[400px] rounded-lg"
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
                        className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isMine ? "bg-[#00a884]" : "bg-[#3b4a54]"
                        )}>
                            <FileText size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {content || 'Documento'}
                            </p>
                            <p className="text-[10px] text-[#8696a0]">
                                Toca para abrir
                            </p>
                        </div>
                    </a>
                )}

                {/* Text content */}
                {content && detectedType !== 'document' && (
                    <div className={cn(mediaUrl && detectedType !== 'audio' ? "px-3 py-1.5" : "")}>
                        <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">{content}</p>
                    </div>
                )}

                {/* Timestamp & status */}
                <div className={cn(
                    "text-[11px] flex items-center justify-end gap-1 px-2 pb-1",
                    "text-[#ffffff99]"
                )}>
                    <span>{timestamp}</span>
                    {isMine && (
                        <span className="flex items-center ml-0.5">
                            {status === 'read' ? (
                                <CheckCheck size={16} className="text-[#53bdeb]" />
                            ) : status === 'delivered' ? (
                                <CheckCheck size={16} className="text-[#ffffff99]" />
                            ) : (
                                <Check size={16} className="text-[#ffffff99]" />
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
    if (lower.match(/\.(mp3|ogg|opus|wav|m4a|aac)/)) return 'audio'
    if (lower.match(/\.(mp4|mov|avi|webm|mkv|3gp)/)) return 'video'
    if (lower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip)/)) return 'document'
    if (content.startsWith('🎵') || content.includes('audio') || content.includes('voz')) return 'audio'
    if (content.startsWith('🎬') || content.includes('video')) return 'video'
    if (content.startsWith('📎') || content.includes('Documento')) return 'document'
    return 'image'
}
