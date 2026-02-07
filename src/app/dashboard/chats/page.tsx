
import { ConversationList } from '@/components/chat/ConversationList'
import { ChatWindow } from '@/components/chat/ChatWindow'

export default function ChatsPage() {
    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-950">
            {/* Main Chat Area (Left/Center) */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
                <ChatWindow />
            </div>

            {/* Sidebar List (Right) */}
            <div className="w-96 shrink-0 bg-slate-900 border-l border-slate-800">
                <ConversationList />
            </div>
        </div>
    )
}
