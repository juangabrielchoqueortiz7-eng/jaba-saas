'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteAssistant } from './actions'
import { useRouter } from 'next/navigation'

export function DeleteAssistantButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault() // Prevent link navigation if inside a link (though it shouldn't be)

        if (!confirm('¿Estás seguro de que deseas eliminar este asistente? Esta acción no se puede deshacer.')) {
            return
        }

        setLoading(true)
        const res = await deleteAssistant(id)
        setLoading(false)

        if (!res.success) {
            alert('Error al eliminar: ' + res.error)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            title="Eliminar Asistente"
            className="hover:text-red-500 transition-colors p-2 rounded-md hover:bg-slate-100"
        >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
        </button>
    )
}
