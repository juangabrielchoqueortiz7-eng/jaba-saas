
import { cn } from '@/lib/utils'
import { Check, CheckCheck, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'

interface MessageBubbleProps {
    content: string
    isMine: boolean
    timestamp: string
    status?: 'sent' | 'delivered' | 'read'
    mediaUrl?: string | null
}

export function MessageBubble({ content, isMine, timestamp, status, mediaUrl }: MessageBubbleProps) {
    const [imageError, setImageError] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)

    return (
        <div className={cn("flex w-full mb-1", isMine ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[70%] rounded-2xl shadow-sm overflow-hidden",
                isMine
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700",
                mediaUrl ? "p-0" : "px-4 py-2"
            )}>
                {/* Image */}
                {mediaUrl && !imageError && (
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

                {/* Fallback when image fails to load */}
                {mediaUrl && imageError && (
                    <div className="flex items-center gap-2 px-4 py-3 text-slate-400">
                        <ImageIcon size={18} />
                        <span className="text-xs">Imagen no disponible</span>
                    </div>
                )}

                {/* Text content */}
                {content && (
                    <div className={cn(mediaUrl ? "px-4 py-2" : "")}>
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
