'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Search, Trash2, GitBranch, Power, PowerOff, ArrowRight, ChevronDown, ChevronUp, HelpCircle, Zap, MessageSquare, ShoppingCart } from 'lucide-react'
import { getFlows, deleteFlow, updateFlow, type ConversationFlow } from './actions'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import FlowTemplates from './FlowTemplates'

export default function FlowsPage() {
    const params = useParams()
    const router = useRouter()
    const assistantId = params.assistantId as string
    const [flows, setFlows] = useState<ConversationFlow[]>([])
    const [search, setSearch] = useState('')
    const [isPending, startTransition] = useTransition()
    const [showHelp, setShowHelp] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)

    useEffect(() => { loadFlows() }, [])

    const loadFlows = async () => {
        const data = await getFlows()
        setFlows(data)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar este flujo? Se borrarán todos los nodos y conexiones.')) return
        startTransition(async () => {
            await deleteFlow(id)
            loadFlows()
        })
    }

    const handleToggleActive = async (flow: ConversationFlow) => {
        startTransition(async () => {
            await updateFlow(flow.id, { is_active: !flow.is_active })
            loadFlows()
        })
    }

    const filtered = flows.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.description?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-8 max-w-7xl mx-auto text-[#0F172A] space-y-6">
            {/* Templates Modal */}
            {showTemplates && (
                <FlowTemplates
                    assistantId={assistantId}
                    onStartBlank={() => {
                        setShowTemplates(false)
                        router.push(`/dashboard/assistants/${assistantId}/flows/new`)
                    }}
                    onClose={() => setShowTemplates(false)}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[#0F172A]">Flujos Conversacionales</h1>
                    <p className="text-slate-400 text-sm mt-1">Crea y gestiona flujos de conversación visuales para tu bot</p>
                </div>
                <Button
                    onClick={() => setShowTemplates(true)}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 rounded-xl px-5 py-2.5 font-semibold"
                >
                    <Plus size={18} /> Nuevo Flujo
                </Button>
            </div>

            {/* Info Card */}
            <div className="rounded-[14px] border border-cyan-500/25 bg-cyan-500/[0.04] overflow-hidden">
                <button
                    onClick={() => setShowHelp(v => !v)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 bg-transparent border-none cursor-pointer text-left"
                >
                    <HelpCircle size={16} className="text-cyan-600 shrink-0" />
                    <span className="flex-1 font-semibold text-sm text-[#0F172A]">¿Qué son los Flujos? — Haz clic para aprender</span>
                    {showHelp ? <ChevronUp size={16} className="text-cyan-600" /> : <ChevronDown size={16} className="text-cyan-600" />}
                </button>
                {showHelp && (
                    <div className="px-5 pb-5 space-y-4">
                        <p className="text-sm text-[#0F172A]/65 leading-relaxed">
                            Los flujos son <strong>conversaciones guiadas paso a paso</strong> que tu bot sigue automáticamente.
                            Cuando un cliente escribe una palabra clave o selecciona una opción, el flujo se activa y
                            lo lleva por un camino definido: preguntas, respuestas, botones, acciones y más.
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { icon: <ShoppingCart size={18} />, title: 'Flujo de Ventas', desc: 'Guía al cliente desde el interés hasta la compra automáticamente.' },
                                { icon: <MessageSquare size={18} />, title: 'Flujo de Soporte', desc: 'Responde preguntas frecuentes y escala solo si es necesario.' },
                                { icon: <Zap size={18} />, title: 'Flujo de Renovación', desc: 'Recuerda al cliente su vencimiento y facilita el pago.' },
                            ].map((item, i) => (
                                <div key={i} className="bg-white border border-black/[0.07] rounded-xl p-3">
                                    <div className="text-cyan-600 mb-2">{item.icon}</div>
                                    <p className="font-bold text-xs text-[#0F172A] mb-1">{item.title}</p>
                                    <p className="text-[11px] text-[#0F172A]/50 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="bg-cyan-500/[0.08] rounded-lg px-4 py-3 text-xs text-[#0F172A]/65">
                            <strong>Diferencia con Disparadores:</strong> Los Disparadores ejecutan una acción puntual (enviar un mensaje, cambiar estado).
                            Los Flujos crean conversaciones completas con múltiples pasos y bifurcaciones. Puedes vincular un disparador para que inicie un flujo.
                        </div>
                    </div>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                    placeholder="Buscar flujos..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 bg-white border-black/[0.08] rounded-xl text-[#0F172A]"
                />
            </div>

            {/* Flows List */}
            {filtered.length === 0 ? (
                <div className="bg-[#F7F8FA] border border-black/[0.08] rounded-2xl text-center py-12 px-6">
                    <GitBranch size={48} className="text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">No hay flujos creados</p>
                    <p className="text-slate-400 text-sm mt-1 mb-5">Crea tu primer flujo conversacional para automatizar las respuestas de tu bot</p>
                    <Button
                        onClick={() => setShowTemplates(true)}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 rounded-xl px-6 py-2.5 font-semibold mx-auto"
                    >
                        <Plus size={18} /> Crear mi primer flujo
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filtered.map(flow => (
                        <Card
                            key={flow.id}
                            className={`bg-white rounded-2xl transition-all ${
                                flow.is_active
                                    ? 'border-green-400/40'
                                    : 'border-black/[0.08]'
                            }`}
                        >
                            <CardContent className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                                        flow.is_active
                                            ? 'bg-cyan-500/10 border-cyan-500/30'
                                            : 'bg-slate-100 border-black/[0.08]'
                                    }`}>
                                        <GitBranch size={22} className={flow.is_active ? 'text-green-500' : 'text-slate-400'} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-[#0F172A] text-base">{flow.name}</h3>
                                        {flow.description && <p className="text-slate-400 text-sm mt-0.5">{flow.description}</p>}
                                        <div className="flex gap-2 items-center mt-1.5">
                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                                flow.is_active
                                                    ? 'bg-green-50 text-green-600 border-green-200'
                                                    : 'bg-slate-50 text-slate-400 border-black/[0.06]'
                                            }`}>
                                                {flow.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <Button
                                        onClick={() => handleToggleActive(flow)}
                                        title={flow.is_active ? 'Desactivar' : 'Activar'}
                                        className={`h-9 w-9 p-0 bg-transparent ${flow.is_active ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        {flow.is_active ? <Power size={18} /> : <PowerOff size={18} />}
                                    </Button>

                                    <Link href={`/dashboard/assistants/${assistantId}/flows/${flow.id}`}>
                                        <Button className="bg-transparent text-cyan-600 hover:bg-cyan-50 gap-1.5 text-sm rounded-xl px-3">
                                            Editar <ArrowRight size={14} />
                                        </Button>
                                    </Link>

                                    <Button
                                        onClick={() => handleDelete(flow.id)}
                                        className="h-9 w-9 p-0 bg-transparent text-red-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
