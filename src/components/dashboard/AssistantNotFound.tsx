'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export function AssistantNotFound() {
    useEffect(() => {
        // Clear the invalid ID so the sidebar doesn't keep pointing here
        localStorage.removeItem('jaba_active_assistant')
    }, [])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 text-slate-500">
                <FileQuestion size={48} />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Asistente no encontrado</h2>
            <p className="text-slate-400 max-w-md mb-8">
                El asistente que buscas no existe o no tienes permisos para verlo.
                Hemos actualizado tu navegación.
            </p>

            <Link
                href="/dashboard/assistants"
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-green-500/20"
            >
                Volver a mis asistentes
            </Link>
        </div>
    )
}
