
import { cn } from '@/lib/utils'
import { Check, CheckCheck } from 'lucide-react'

interface MessageBubbleProps {
    content: string
    isMine: boolean
    timestamp: string
    status?: 'sent' | 'delivered' | 'read'
}

export function MessageBubble({ content, isMine, timestamp, status }: MessageBubbleProps) {
    return (
        <div className={cn("flex w-full mb-1", isMine ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                isMine
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
            )}>
                <p className="whitespace-pre-wrap break-words">{content}</p>
                <div className={cn(
                    "text-[10px] mt-1 flex items-center justify-end gap-1",
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
