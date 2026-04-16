'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ConversationList } from './ConversationList'
import { ChatWindow } from './ChatWindow'
import { cn } from '@/lib/utils'

export function ChatPageShell() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeChatId = searchParams.get('chatId')

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] md:h-[100dvh] overflow-hidden bg-[#F0F2F5]">
            <aside
                className={cn(
                    "w-full md:w-[360px] xl:w-[400px] shrink-0 border-r border-black/[0.08] bg-white h-full min-h-0",
                    activeChatId ? "hidden md:flex" : "flex"
                )}
            >
                <ConversationList selectedChatId={activeChatId} />
            </aside>

            <main
                className={cn(
                    "flex-1 min-w-0 h-full min-h-0",
                    activeChatId ? "flex" : "hidden md:flex"
                )}
            >
                <ChatWindow
                    showMobileBack
                    onBack={() => router.push('/dashboard/chats')}
                />
            </main>
        </div>
    )
}
