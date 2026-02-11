'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Trash2, Edit, FileText } from 'lucide-react'
import { getTemplates, createTemplate, deleteTemplate, type Template } from './actions'

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [search, setSearch] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [newTemplate, setNewTemplate] = useState({ name: '', content: '' })
    const [isPending, startTransition] = useTransition()

    // Load templates on mount
    useEffect(() => {
        loadTemplates()
    }, [])

    const loadTemplates = async () => {
        const data = await getTemplates()
        setTemplates(data)
    }

    const handleCreate = async () => {
        if (!newTemplate.name || !newTemplate.content) return

        startTransition(async () => {
            try {
                await createTemplate(newTemplate.name, newTemplate.content)
                await loadTemplates()
                setIsCreating(false)
                setNewTemplate({ name: '', content: '' })
            } catch (error) {
                console.error("Error creating template:", error)
                alert("Error al crear la plantilla")
            }
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return

        startTransition(async () => {
            try {
                await deleteTemplate(id)
                await loadTemplates()
            } catch (error) {
                console.error("Error deleting template:", error)
            }
        })
    }

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.content.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-200">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Plantillas de Respuesta</h1>
                    <p className="text-slate-400">Crea respuestas rápidas para usar en tus conversaciones.</p>
                </div>
                {!isCreating && (
                    <Button
                        onClick={() => setIsCreating(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    >
                        <Plus size={20} />
                        Nueva Plantilla
                    </Button>
                )}
            </div>

            {isCreating && (
                <Card className="mb-8 border-slate-800 bg-slate-900/50">
                    <CardHeader>
                        <CardTitle className="text-white">Nueva Plantilla</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre (Ej: Bienvenida)</Label>
                            <Input
                                value={newTemplate.name}
                                onChange={e => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Nombre de la plantilla..."
                                className="bg-slate-950 border-slate-800 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mensaje</Label>
                            <Textarea
                                value={newTemplate.content}
                                onChange={e => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                                placeholder="Escribe el mensaje aquí..."
                                className="bg-slate-950 border-slate-800 text-white h-32"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                onClick={() => setIsCreating(false)}
                                className="bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={isPending || !newTemplate.name || !newTemplate.content}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isPending ? 'Guardando...' : 'Guardar Plantilla'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar plantillas..."
                    className="pl-10 bg-slate-900/50 border-slate-800 text-white w-full max-w-md"
                />
            </div>

            <div className="space-y-4">
                {filteredTemplates.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No tienes plantillas creadas aún.</p>
                    </div>
                ) : (
                    filteredTemplates.map(template => (
                        <div
                            key={template.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-colors group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-white text-lg">{template.name}</h3>
                                    <p className="text-slate-400 text-sm line-clamp-1 max-w-2xl">
                                        {template.content}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    className="h-8 w-8 p-0 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
                                >
                                    <Edit size={18} />
                                </Button>
                                <Button
                                    className="h-8 w-8 p-0 bg-transparent text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                    onClick={() => handleDelete(template.id)}
                                >
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
