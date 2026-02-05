
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
    content: string
    isMine: boolean
    timestamp: string
    status?: 'sent' | 'delivered' | 'read'
}

export function MessageBubble({ content, isMine, timestamp, status }: MessageBubbleProps) {
    return (
        <div className={cn("flex w-full mb-4", isMine ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                isMine
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
            )}>
                <p>{content}</p>
                <div className={cn(
                    "text-[10px] mt-1 flex items-center justify-end gap-1",
                    isMine ? "text-indigo-200" : "text-slate-400"
                )}>
                    <span>{timestamp}</span>
                    {isMine && (
                        <span>
                            {status === 'read' && '✓✓'}
                            {status === 'delivered' && '✓✓'}
                            {status === 'sent' && '✓'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
