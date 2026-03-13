'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ChatContextType {
    isChatOpen: boolean
    activeChatId: string | null
    openChat: (chatId?: string) => void
    closeChat: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [activeChatId, setActiveChatId] = useState<string | null>(null)

    const openChat = (chatId?: string) => {
        if (chatId) {
            setActiveChatId(chatId)
        }
        setIsChatOpen(true)
    }

    const closeChat = () => {
        setIsChatOpen(false)
        // Opcional: limpiar el chat activo al cerrar o mantenerlo para la próxima
        // setActiveChatId(null) 
    }

    return (
        <ChatContext.Provider value={{ isChatOpen, activeChatId, openChat, closeChat }}>
            {children}
        </ChatContext.Provider>
    )
}

export function useChat() {
    const context = useContext(ChatContext)
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider')
    }
    return context
}
