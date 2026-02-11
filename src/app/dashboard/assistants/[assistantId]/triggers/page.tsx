'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Search, Plus, Trash2, Edit, Zap, Clock, Workflow } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getTriggers, toggleTrigger, deleteTrigger } from './actions'

// Helper for type icons
const getTypeIcon = (type: string) => {
    switch (type) {
        case 'logic': return <Zap className="text-yellow-400" size={16} />
        case 'time': return <Clock className="text-blue-400" size={16} />
        default: return <Workflow className="text-purple-400" size={16} />
    }
}

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'logic': return 'Lógica'
        case 'time': return 'Tiempo'
        case 'flow': return 'Flujo'
        default: return type
    }
}

export default function TriggersPage() {
    const params = useParams()
    const assistantId = params?.assistantId as string

    const [triggers, setTriggers] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        loadTriggers()
    }, [])

    const loadTriggers = async () => {
        const data = await getTriggers()
        setTriggers(data)
    }

    const handleToggle = (id: string, currentState: boolean) => {
        // Optimistic update
        setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentState } : t))

        startTransition(async () => {
            try {
                await toggleTrigger(id, currentState)
            } catch (error) {
                // Revert on error
                setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: currentState } : t))
                console.error(error)
            }
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este disparador?')) return

        startTransition(async () => {
            await deleteTrigger(id)
            await loadTriggers()
        })
    }

    const filtered = triggers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-200">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Disparadores</h1>
                    <p className="text-slate-400">Automatiza acciones basadas en eventos o lógica inteligente.</p>
                </div>
                <Link href={`/dashboard/assistants/${assistantId}/triggers/new`}>
                    <Button className="bg-green-600 hover:bg-green-700 text-white gap-2">
                        <Plus size={20} />
                        Nuevo Disparador
                    </Button>
                </Link>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar disparaores..."
                    className="pl-10 bg-slate-900/50 border-slate-800 text-white w-full max-w-md"
                />
            </div>

            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-950 text-slate-200 uppercase font-semibold">
                            <tr>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">Nombre</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4 text-center">Acciones</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4">Creado</th>
                                <th className="p-4 text-right">Opciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        No hay disparadores creados.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((trigger, i) => (
                                    <tr key={trigger.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-4 text-center">{i + 1}</td>
                                        <td className="p-4 font-medium text-white">{trigger.name}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded-md w-fit">
                                                {getTypeIcon(trigger.type)}
                                                <span>{getTypeLabel(trigger.type)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="bg-slate-800 px-2 py-1 rounded text-xs px-3">
                                                {trigger.action_count}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {/* Toggle Switch */}
                                            <button
                                                onClick={() => handleToggle(trigger.id, trigger.is_active)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${trigger.is_active ? 'bg-blue-600' : 'bg-slate-700'}`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${trigger.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                                                />
                                            </button>
                                        </td>
                                        <td className="p-4">{new Date(trigger.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link href={`/dashboard/assistants/${assistantId}/triggers/${trigger.id}`}>
                                                <Button className="h-9 w-9 p-0 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white">
                                                    <Edit size={16} />
                                                </Button>
                                            </Link>
                                            <Button
                                                className="h-9 w-9 p-0 bg-transparent text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                onClick={() => handleDelete(trigger.id)}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
