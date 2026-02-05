
import { ConversationList } from '@/components/chat/ConversationList'
import { ChatWindow } from '@/components/chat/ChatWindow'

export default function ChatsPage() {
    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
            <ConversationList />
            <ChatWindow />
        </div>
    )
}
