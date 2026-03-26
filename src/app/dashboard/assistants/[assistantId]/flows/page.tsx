'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Trash2, GitBranch, Power, PowerOff, ArrowRight } from 'lucide-react'
import { getFlows, createFlow, deleteFlow, updateFlow, seedSalesFlow, type ConversationFlow } from './actions'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function FlowsPage() {
    const params = useParams()
    const assistantId = params.assistantId as string
    const [flows, setFlows] = useState<ConversationFlow[]>([])
    const [search, setSearch] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [newFlowName, setNewFlowName] = useState('')
    const [newFlowDesc, setNewFlowDesc] = useState('')
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadFlows() }, [])

    const loadFlows = async () => {
        const data = await getFlows()
        setFlows(data)
    }

    const handleCreate = async () => {
        if (!newFlowName.trim()) return
        startTransition(async () => {
            await createFlow(newFlowName, newFlowDesc)
            setNewFlowName('')
            setNewFlowDesc('')
            setIsCreating(false)
            loadFlows()
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este flujo? Se borrarán todos los nodos y conexiones.')) return
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#eef0ff' }}>
                        Flujos Conversacionales
                    </h1>
                    <p style={{ color: 'rgba(238,240,255,0.45)', marginTop: 4 }}>
                        Crea y gestiona flujos de conversación visuales para tu bot
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        onClick={async () => {
                            startTransition(async () => {
                                const flowId = await seedSalesFlow()
                                if (flowId) loadFlows()
                            })
                        }}
                        disabled={isPending}
                        style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 12, padding: '10px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        🚀 Crear Flujo de Ventas
                    </Button>
                    <Button
                        onClick={() => setIsCreating(true)}
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    >
                        <Plus size={18} /> Nuevo Flujo
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <Input
                    placeholder="Buscar flujos..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 40, background: 'rgba(30,30,40,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e2e8f0' }}
                />
            </div>

            {/* Create Form */}
            {isCreating && (
                <Card style={{ background: '#13152a', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 16 }}>
                    <CardContent style={{ padding: 24 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Input
                                placeholder="Nombre del flujo (ej: Bienvenida, Renovación)"
                                value={newFlowName}
                                onChange={e => setNewFlowName(e.target.value)}
                                style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e2e8f0' }}
                            />
                            <Input
                                placeholder="Descripción (opcional)"
                                value={newFlowDesc}
                                onChange={e => setNewFlowDesc(e.target.value)}
                                style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e2e8f0' }}
                            />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <Button
                                        onClick={() => setIsCreating(false)}
                                        style={{ borderRadius: 10, borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8', background: 'transparent' }}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleCreate} disabled={isPending || !newFlowName.trim()}
                                    style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600 }}>
                                    {isPending ? 'Creando...' : 'Crear Flujo'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Flows List */}
            {filtered.length === 0 ? (
                <Card style={{ background: 'rgba(15,26,20,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, textAlign: 'center', padding: '48px 24px' }}>
                    <GitBranch size={48} style={{ color: '#4b5563', margin: '0 auto 16px' }} />
                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>No hay flujos creados</p>
                    <p style={{ color: '#4b5563', fontSize: '0.9rem', marginTop: 4 }}>Crea tu primer flujo conversacional para automatizar las respuestas de tu bot</p>
                </Card>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {filtered.map(flow => (
                        <Card key={flow.id} style={{
                            background: 'rgba(15,26,20,0.6)',
                            border: flow.is_active ? '1px solid rgba(37,211,102,0.4)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 16,
                            transition: 'all 0.2s',
                            cursor: 'default'
                        }}>
                            <CardContent style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 12,
                                        background: flow.is_active ? 'rgba(6,182,212,0.12)' : 'rgba(100,116,139,0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: flow.is_active ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <GitBranch size={22} style={{ color: flow.is_active ? '#22c55e' : '#64748b' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '1.05rem' }}>{flow.name}</h3>
                                        {flow.description && <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 2 }}>{flow.description}</p>}
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                                            <span style={{
                                                fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                                                background: flow.is_active ? 'rgba(6,182,212,0.12)' : 'rgba(100,116,139,0.15)',
                                                color: flow.is_active ? '#22c55e' : '#64748b',
                                                border: flow.is_active ? '1px solid rgba(6,182,212,0.2)' : '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                {flow.is_active ? '● Activo' : '○ Inactivo'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <Button
                                        onClick={() => handleToggleActive(flow)}
                                        title={flow.is_active ? 'Desactivar' : 'Activar'}
                                        style={{ borderRadius: 10, padding: '8px', color: flow.is_active ? '#22c55e' : '#64748b', background: 'transparent' }}
                                    >
                                        {flow.is_active ? <Power size={18} /> : <PowerOff size={18} />}
                                    </Button>

                                    <Link href={`/dashboard/assistants/${assistantId}/flows/${flow.id}`}>
                                        <Button
                                            style={{ borderRadius: 10, padding: '8px 16px', color: '#25D366', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', background: 'transparent' }}>
                                            Editar <ArrowRight size={14} />
                                        </Button>
                                    </Link>

                                    <Button
                                        onClick={() => handleDelete(flow.id)}
                                        style={{ borderRadius: 10, padding: '8px', color: '#ef4444', background: 'transparent' }}
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
