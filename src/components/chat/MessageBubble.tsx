
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

    // Detectar tipo de media automáticamente si no se proporciona
    const detectedType = mediaType || (mediaUrl ? detectMediaType(mediaUrl, content) : null)

    return (
        <div className={cn("flex w-full mb-1", isMine ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[70%] rounded-2xl shadow-sm overflow-hidden",
                isMine
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700",
                mediaUrl && detectedType !== 'audio' ? "p-0" : "px-4 py-2"
            )}>
                {/* === IMAGE === */}
                {mediaUrl && detectedType === 'image' && !imageError && (
                    <div className="relative">
                        {!imageLoaded && (
                            <div className="flex items-center justify-center w-full h-48 bg-slate-700/50">
                                <ImageIcon size={32} className="text-slate-500 animate-pulse" />
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
                    <div className="flex items-center gap-2 px-4 py-3 text-slate-400">
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
                                isMine ? "bg-indigo-500 hover:bg-indigo-400" : "bg-slate-700 hover:bg-slate-600"
                            )}
                        >
                            <Play size={18} className="ml-0.5" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <audio
                                ref={audioRef}
                                src={mediaUrl}
                                controls
                                controlsList="nodownload"
                                className="w-full h-8 opacity-80"
                                style={{
                                    filter: isMine ? 'invert(1) hue-rotate(180deg)' : 'invert(0.8)',
                                    maxWidth: '200px'
                                }}
                            />
                        </div>
                        <Mic size={14} className={cn("flex-shrink-0", isMine ? "text-indigo-300" : "text-slate-500")} />
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
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                            isMine ? "hover:bg-indigo-500/50" : "hover:bg-slate-700/50"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isMine ? "bg-indigo-500" : "bg-slate-700"
                        )}>
                            <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {content || 'Documento'}
                            </p>
                            <p className={cn("text-[10px]", isMine ? "text-indigo-200" : "text-slate-500")}>
                                Toca para abrir
                            </p>
                        </div>
                    </a>
                )}

                {/* Text content */}
                {content && detectedType !== 'document' && (
                    <div className={cn(mediaUrl && detectedType !== 'audio' ? "px-4 py-2" : "")}>
                        <p className="whitespace-pre-wrap break-words text-sm">{content}</p>
                    </div>
                )}

                {/* Timestamp & status */}
                <div className={cn(
                    "text-[10px] flex items-center justify-end gap-1 px-4 pb-1.5",
                    isMine ? "text-indigo-200" : "text-slate-400"
                )}>
                    <span>{timestamp}</span>
                    {isMine && (
                        <span className="flex items-center">
                            {status === 'read' ? (
                                <CheckCheck size={14} className="text-blue-300" />
                            ) : status === 'delivered' ? (
                                <CheckCheck size={14} />
                            ) : (
                                <Check size={14} />
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
    // Infer from content text
    if (content.startsWith('🎵') || content.includes('audio') || content.includes('voz')) return 'audio'
    if (content.startsWith('🎬') || content.includes('video')) return 'video'
    if (content.startsWith('📎') || content.includes('Documento')) return 'document'
    return 'image' // default
}
