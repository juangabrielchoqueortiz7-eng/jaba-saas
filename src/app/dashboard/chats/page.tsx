
import { ConversationList } from '@/components/chat/ConversationList'
import { ChatWindow } from '@/components/chat/ChatWindow'

export default function ChatsPage() {
    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)] md:h-[calc(100vh)] overflow-hidden bg-slate-950">
            {/* Conversation List (Top on mobile, Right sidebar on desktop) */}
            <div className="order-1 md:order-2 w-full md:w-96 shrink-0 bg-slate-900 border-b md:border-b-0 md:border-l border-slate-800 h-[50vh] md:h-full overflow-y-auto">
                <ConversationList />
            </div>

            {/* Chat Window (Bottom on mobile, Main area on desktop) */}
            <div className="order-2 md:order-1 flex-1 flex flex-col min-w-0 border-r border-slate-800 h-[50vh] md:h-full">
                <ChatWindow />
            </div>
        </div>
    )
}
