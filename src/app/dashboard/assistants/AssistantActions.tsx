'use client'

import { MessageSquare, Wrench, Power } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'

export function AssistantActions({ asst }: { asst: any }) {
    const router = useRouter()
    const supabase = createClient()
    const [aiStatus, setAiStatus] = useState(asst.ai_status)
    const [toggling, setToggling] = useState(false)

    const handleSelectAssistant = (id: string) => {
        localStorage.setItem('jaba_active_assistant', id)
    }

    const handleToggleStatus = async () => {
        setToggling(true)
        const newStatus = aiStatus === 'active' ? 'inactive' : 'active'
        const { error } = await supabase
            .from('whatsapp_credentials')
            .update({ ai_status: newStatus })
            .eq('id', asst.id)
        if (!error) setAiStatus(newStatus)
        setToggling(false)
    }

    return (
        <div className="flex items-center gap-1 text-slate-400">
            <Link
                href="/dashboard/chats"
                onClick={() => handleSelectAssistant(asst.id)}
                title="Ir al Chat"
                className="hover:text-green-500 transition-colors p-2 rounded-md hover:bg-slate-100"
            >
                <MessageSquare size={20} />
            </Link>

            <Link
                href="/dashboard/settings"
                onClick={() => handleSelectAssistant(asst.id)}
                title="Configurar WhatsApp"
                className="hover:text-blue-500 transition-colors p-2 rounded-md hover:bg-slate-100"
            >
                <Wrench size={20} />
            </Link>

            <button
                title={aiStatus === 'active' ? 'Bot activo — clic para pausar' : 'Bot pausado — clic para activar'}
                onClick={handleToggleStatus}
                disabled={toggling}
                className={`transition-colors p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 ${aiStatus === 'active' ? 'text-green-500 hover:text-green-600' : 'hover:text-green-500'}`}
            >
                <Power size={20} />
            </button>
        </div>
    )
}
