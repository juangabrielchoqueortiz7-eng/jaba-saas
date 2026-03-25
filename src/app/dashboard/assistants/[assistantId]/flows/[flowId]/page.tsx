'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    ReactFlow,
    Controls,
    Background,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    Handle,
    Position,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type NodeTypes,
    Panel,
    BackgroundVariant,
    MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Save, ArrowLeft, Power, PowerOff, Trash2, Copy,
    MessageSquare, MousePointerClick, GitBranch, Bot, Clock, Zap, ListOrdered, Image
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { getFlowDetails, saveFlowCanvas, updateFlow } from '../actions'
import { getFlows, type ConversationFlow } from '../actions'

// ========================
// CUSTOM NODES
// ========================

const nodeColors: Record<string, { bg: string; border: string; icon: string }> = {
    trigger: { bg: 'rgba(234,179,8,0.15)', border: '#eab308', icon: '⚡' },
    message: { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', icon: '💬' },
    buttons: { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', icon: '🔘' },
    list: { bg: 'rgba(6,182,212,0.15)', border: '#06b6d4', icon: '📋' },
    condition: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', icon: '🔀' },
    ai_response: { bg: 'rgba(34,197,94,0.15)', border: '#22c55e', icon: '🤖' },
    action: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', icon: '⚙️' },
    wait_input: { bg: 'rgba(129,140,248,0.15)', border: '#818cf8', icon: '⏳' },
    delay: { bg: 'rgba(100,116,139,0.15)', border: '#64748b', icon: '⏱️' },
}

function FlowNode({ data, selected }: { data: any; selected: boolean }) {
    const colors = nodeColors[data.nodeType] || nodeColors.message
    const isCondition = data.nodeType === 'condition'
    const isTrigger = data.nodeType === 'trigger'

    return (
        <div style={{
            background: colors.bg,
            border: `2px solid ${selected ? '#fff' : colors.border}`,
            borderRadius: 12,
            padding: '12px 16px',
            minWidth: 180,
            maxWidth: 260,
            backdropFilter: 'blur(8px)',
            boxShadow: selected ? '0 0 20px rgba(129,140,248,0.3)' : '0 4px 12px rgba(0,0,0,0.3)',
            position: 'relative' as const,
        }}>
            {/* Target Handle (top) — all nodes except trigger */}
            {!isTrigger && (
                <Handle
                    type="target"
                    position={Position.Top}
                    style={{
                        width: 12, height: 12, background: colors.border,
                        border: '2px solid #1e1e32', borderRadius: '50%', top: -6,
                    }}
                />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{colors.icon}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.border, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {data.nodeType}
                </span>
            </div>
            <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>
                {data.label || 'Sin configurar'}
            </div>
            {data.preview && (
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {data.preview}
                </div>
            )}

            {/* Source Handle (bottom) — for condition nodes: two handles (true/false) */}
            {isCondition ? (
                <>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        style={{
                            width: 12, height: 12, background: '#22c55e',
                            border: '2px solid #1e1e32', borderRadius: '50%',
                            bottom: -6, left: '30%',
                        }}
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        style={{
                            width: 12, height: 12, background: '#ef4444',
                            border: '2px solid #1e1e32', borderRadius: '50%',
                            bottom: -6, left: '70%',
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.6rem', fontWeight: 700 }}>
                        <span style={{ color: '#22c55e' }}>✓ Sí</span>
                        <span style={{ color: '#ef4444' }}>✗ No</span>
                    </div>
                </>
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="default"
                    style={{
                        width: 12, height: 12, background: colors.border,
                        border: '2px solid #1e1e32', borderRadius: '50%', bottom: -6,
                    }}
                />
            )}
        </div>
    )
}

const nodeTypes: NodeTypes = {
    flowNode: FlowNode,
}

// ========================
// NODE TYPE CATALOG
// ========================

const nodeTypeCatalog = [
    { type: 'trigger', label: 'Disparador', icon: Zap, desc: 'Inicia el flujo con una palabra clave' },
    { type: 'message', label: 'Mensaje', icon: MessageSquare, desc: 'Envía un mensaje de texto' },
    { type: 'buttons', label: 'Botones', icon: MousePointerClick, desc: 'Envía botones interactivos' },
    { type: 'list', label: 'Lista', icon: ListOrdered, desc: 'Envía lista desplegable' },
    { type: 'condition', label: 'Condición', icon: GitBranch, desc: 'Evalúa una condición' },
    { type: 'ai_response', label: 'IA', icon: Bot, desc: 'Delega a la inteligencia artificial' },
    { type: 'action', label: 'Acción', icon: Zap, desc: 'Ejecuta una acción del sistema' },
    { type: 'wait_input', label: 'Esperar', icon: Clock, desc: 'Espera respuesta del usuario' },
    { type: 'delay', label: 'Pausa', icon: Clock, desc: 'Espera X segundos' },
]

// ========================
// CONFIG PANEL
// ========================

function NodeConfigPanel({ node, onUpdate, onClose }: { node: Node; onUpdate: (config: any, label: string) => void; onClose: () => void }) {
    const [config, setConfig] = useState<any>(node.data.config || {})
    const [label, setLabel] = useState<string>((node.data.label as string) || '')
    const nodeType = node.data.nodeType as string

    const updateConfig = (key: string, value: any) => {
        const newConfig = { ...config, [key]: value }
        setConfig(newConfig)
        onUpdate(newConfig, label)
    }

    const updateLabel = (val: string) => {
        setLabel(val)
        onUpdate(config, val)
    }

    return (
        <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 340,
            background: 'rgba(15,15,25,0.95)', borderLeft: '1px solid rgba(255,255,255,0.1)',
            padding: 20, overflowY: 'auto', zIndex: 50, backdropFilter: 'blur(12px)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>Configurar Nodo</h3>
                <Button onClick={onClose} style={{ color: '#94a3b8', padding: 4, background: 'transparent' }}>✕</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Etiqueta</label>
                <Input
                    value={label}
                    onChange={e => updateLabel(e.target.value)}
                    placeholder="Nombre descriptivo"
                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                />

                {/* TRIGGER CONFIG */}
                {nodeType === 'trigger' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Tipo de disparador</label>
                        <select
                            value={config.trigger_type || 'keyword'}
                            onChange={e => updateConfig('trigger_type', e.target.value)}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px' }}
                        >
                            <option value="keyword">Palabra clave</option>
                            <option value="button_id">ID de botón</option>
                            <option value="message_type">Tipo de mensaje</option>
                            <option value="event">Evento</option>
                        </select>

                        {config.trigger_type === 'keyword' && (
                            <>
                                <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Palabras clave (separadas por coma)</label>
                                <Input
                                    value={(config.keywords || []).join(', ')}
                                    onChange={e => updateConfig('keywords', e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean))}
                                    placeholder="hola, bienvenido, inicio"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                                />
                                <select
                                    value={config.match_mode || 'contains'}
                                    onChange={e => updateConfig('match_mode', e.target.value)}
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px' }}
                                >
                                    <option value="contains">Contiene</option>
                                    <option value="exact">Exacto</option>
                                    <option value="starts_with">Empieza con</option>
                                </select>
                            </>
                        )}

                        {config.trigger_type === 'button_id' && (
                            <>
                                <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>ID del botón (usa * para wildcard)</label>
                                <Input
                                    value={config.button_id || ''}
                                    onChange={e => updateConfig('button_id', e.target.value)}
                                    placeholder="renew_plan_*"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                                />
                            </>
                        )}
                    </>
                )}

                {/* MESSAGE CONFIG */}
                {nodeType === 'message' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Mensaje</label>
                        <textarea
                            value={config.text || ''}
                            onChange={e => updateConfig('text', e.target.value)}
                            placeholder="¡Hola {{contact_name}}! Bienvenido a {{service_name}}"
                            rows={4}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                            Variables: {'{{contact_name}}'}, {'{{phone_number}}'}, {'{{service_name}}'}, {'{{email}}'}, {'{{plan_name}}'}
                        </p>
                    </>
                )}

                {/* BUTTONS CONFIG */}
                {nodeType === 'buttons' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Mensaje</label>
                        <textarea
                            value={config.text || ''}
                            onChange={e => updateConfig('text', e.target.value)}
                            placeholder="Elige una opción:"
                            rows={2}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Botones (máx 3)</label>
                        {(config.buttons || [{ id: '', title: '' }]).map((btn: any, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: 6 }}>
                                <Input
                                    value={btn.id}
                                    onChange={e => {
                                        const btns = [...(config.buttons || [{ id: '', title: '' }])]
                                        btns[i] = { ...btns[i], id: e.target.value }
                                        updateConfig('buttons', btns)
                                    }}
                                    placeholder="ID"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', flex: 1 }}
                                />
                                <Input
                                    value={btn.title}
                                    onChange={e => {
                                        const btns = [...(config.buttons || [{ id: '', title: '' }])]
                                        btns[i] = { ...btns[i], title: e.target.value }
                                        updateConfig('buttons', btns)
                                    }}
                                    placeholder="Texto"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', flex: 2 }}
                                />
                            </div>
                        ))}
                        {(config.buttons || []).length < 3 && (
                            <Button onClick={() => updateConfig('buttons', [...(config.buttons || []), { id: '', title: '' }])}
                                style={{ color: '#818cf8', fontSize: '0.8rem', background: 'transparent' }}>
                                + Agregar botón
                            </Button>
                        )}
                    </>
                )}

                {/* LIST CONFIG */}
                {nodeType === 'list' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Mensaje principal</label>
                        <textarea
                            value={config.body || ''}
                            onChange={e => updateConfig('body', e.target.value)}
                            placeholder="Selecciona una opción del menú:"
                            rows={3}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Texto del botón para abrir lista</label>
                        <Input
                            value={config.button_text || ''}
                            onChange={e => updateConfig('button_text', e.target.value)}
                            placeholder="Ver opciones"
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                        />
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                            Opciones de la lista
                            <span style={{ color: '#4b5563', fontWeight: 400, marginLeft: 6 }}>máx 10</span>
                        </label>
                        {(config.rows || [{ id: '', title: '', description: '' }]).map((row: any, i: number) => (
                            <div key={i} style={{ background: 'rgba(15,15,25,0.6)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <Input
                                        value={row.id}
                                        onChange={e => {
                                            const rows = [...(config.rows || [])]
                                            rows[i] = { ...rows[i], id: e.target.value }
                                            updateConfig('rows', rows)
                                        }}
                                        placeholder={`ID (ej: opt_${i + 1})`}
                                        style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', flex: 1, fontSize: '0.8rem' }}
                                    />
                                    <Button
                                        onClick={() => updateConfig('rows', (config.rows || []).filter((_: any, idx: number) => idx !== i))}
                                        style={{ color: '#ef4444', background: 'transparent', padding: '4px 8px', flexShrink: 0 }}
                                    >✕</Button>
                                </div>
                                <Input
                                    value={row.title}
                                    onChange={e => {
                                        const rows = [...(config.rows || [])]
                                        rows[i] = { ...rows[i], title: e.target.value }
                                        updateConfig('rows', rows)
                                    }}
                                    placeholder="Título de la opción"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: '0.8rem' }}
                                />
                                <Input
                                    value={row.description || ''}
                                    onChange={e => {
                                        const rows = [...(config.rows || [])]
                                        rows[i] = { ...rows[i], description: e.target.value }
                                        updateConfig('rows', rows)
                                    }}
                                    placeholder="Descripción (opcional)"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', fontSize: '0.75rem' }}
                                />
                            </div>
                        ))}
                        {(config.rows || []).length < 10 && (
                            <Button
                                onClick={() => updateConfig('rows', [...(config.rows || []), { id: `opt_${(config.rows || []).length + 1}`, title: '', description: '' }])}
                                style={{ color: '#06b6d4', fontSize: '0.8rem', background: 'transparent' }}
                            >
                                + Agregar opción
                            </Button>
                        )}
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Pie de página (opcional)</label>
                        <Input
                            value={config.footer || ''}
                            onChange={e => updateConfig('footer', e.target.value)}
                            placeholder="Texto del footer..."
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                        />
                    </>
                )}

                {/* CONDITION CONFIG */}
                {nodeType === 'condition' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Tipo de condición</label>
                        <select
                            value={config.condition_type || 'contains'}
                            onChange={e => updateConfig('condition_type', e.target.value)}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px' }}
                        >
                            <option value="contains">Mensaje contiene</option>
                            <option value="equals">Mensaje es exactamente</option>
                            <option value="message_type">Tipo de mensaje es</option>
                            <option value="has_variable">Variable existe</option>
                            <option value="interactive_id">ID interactivo es</option>
                        </select>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Valor</label>
                        <Input
                            value={config.value || ''}
                            onChange={e => updateConfig('value', e.target.value)}
                            placeholder={config.condition_type === 'message_type' ? 'image' : 'texto a comparar'}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                        />
                        <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                            Las conexiones con handle "true" se seguirán si la condición se cumple, "false" si no.
                        </p>
                    </>
                )}

                {/* WAIT INPUT CONFIG */}
                {nodeType === 'wait_input' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Nombre de variable</label>
                        <Input
                            value={config.variable_name || ''}
                            onChange={e => updateConfig('variable_name', e.target.value)}
                            placeholder="email, respuesta, etc."
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                        />
                        <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                            La respuesta del usuario se guardará en esta variable para usarla después.
                        </p>
                    </>
                )}

                {/* DELAY CONFIG */}
                {nodeType === 'delay' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Segundos de espera</label>
                        <Input
                            type="number"
                            value={config.seconds || 2}
                            onChange={e => updateConfig('seconds', parseInt(e.target.value) || 1)}
                            min={1}
                            max={30}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                        />
                    </>
                )}

                {/* ACTION CONFIG */}
                {nodeType === 'action' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Tipo de acción</label>
                        <select
                            value={config.action_type || 'add_tag'}
                            onChange={e => updateConfig('action_type', e.target.value)}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px' }}
                        >
                            <option value="add_tag">Agregar etiqueta CRM</option>
                            <option value="remove_tag">Quitar etiqueta CRM</option>
                            <option value="send_image">Enviar imagen</option>
                        </select>
                        {(config.action_type === 'add_tag' || config.action_type === 'remove_tag') && (
                            <Input
                                value={config.tag || ''}
                                onChange={e => updateConfig('tag', e.target.value)}
                                placeholder="Nombre de la etiqueta"
                                style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                            />
                        )}
                        {config.action_type === 'send_image' && (
                            <>
                                <Input
                                    value={config.image_url || ''}
                                    onChange={e => updateConfig('image_url', e.target.value)}
                                    placeholder="URL de la imagen o {{qr_image_url}}"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                                />
                                <Input
                                    value={config.caption || ''}
                                    onChange={e => updateConfig('caption', e.target.value)}
                                    placeholder="Caption (opcional)"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                                />
                            </>
                        )}
                    </>
                )}

                {/* AI RESPONSE CONFIG */}
                {nodeType === 'ai_response' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Prompt del sistema (opcional)</label>
                        <textarea
                            value={config.system_prompt || ''}
                            onChange={e => updateConfig('system_prompt', e.target.value)}
                            placeholder="Instrucciones específicas para la IA en este punto del flujo..."
                            rows={4}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                            Si lo dejas vacío, usará el prompt de entrenamiento principal del asistente.
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}

// ========================
// MAIN EDITOR
// ========================

export default function FlowEditorPage() {
    const params = useParams()
    const router = useRouter()
    const flowId = params.flowId as string
    const assistantId = params.assistantId as string

    const [nodes, setNodes] = useState<Node[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [selectedNode, setSelectedNode] = useState<Node | null>(null)
    const [flowName, setFlowName] = useState('')
    const [isActive, setIsActive] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<string>('')
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)

    const nodeIdCounter = useRef(0)

    useEffect(() => {
        loadFlow()
    }, [flowId])

    const loadFlow = async () => {
        const [flows, details] = await Promise.all([
            getFlows(),
            getFlowDetails(flowId)
        ])

        const flow = flows.find(f => f.id === flowId)
        if (flow) {
            setFlowName(flow.name)
            setIsActive(flow.is_active)
        }

        // Convert DB nodes to React Flow nodes
        const rfNodes: Node[] = details.nodes.map(n => ({
            id: n.id,
            type: 'flowNode',
            position: { x: n.position_x, y: n.position_y },
            data: {
                label: n.label,
                nodeType: n.type,
                config: n.config,
                preview: getNodePreview(n.type, n.config),
            },
        }))

        // Convert DB edges to React Flow edges
        const rfEdges: Edge[] = details.edges.map(e => ({
            id: e.id,
            source: e.source_node_id,
            target: e.target_node_id,
            sourceHandle: e.source_handle,
            label: e.label,
            animated: true,
            style: { stroke: '#818cf8' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
        }))

        setNodes(rfNodes)
        setEdges(rfEdges)
        nodeIdCounter.current = rfNodes.length
    }

    const getNodePreview = (type: string, config: any): string => {
        if (type === 'trigger' && config.keywords?.length) return `Palabras: ${config.keywords.join(', ')}`
        if (type === 'message' && config.text) return config.text.substring(0, 60)
        if (type === 'buttons' && config.buttons?.length) return `${config.buttons.length} botones`
        if (type === 'list' && config.rows?.length) return `${config.rows.length} opciones — "${config.button_text || 'Ver opciones'}"`
        if (type === 'condition') return `${config.condition_type}: ${config.value || ''}`
        if (type === 'delay') return `${config.seconds || 2}s de pausa`
        if (type === 'wait_input') return `Guarda en: ${config.variable_name || 'respuesta'}`
        if (type === 'action') return config.action_type || 'Acción'
        return ''
    }

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    )

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    )

    const onConnect: OnConnect = useCallback(
        (connection) => setEdges((eds) => addEdge({
            ...connection,
            animated: true,
            style: { stroke: '#818cf8' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
        }, eds)),
        []
    )

    const addNode = (type: string) => {
        nodeIdCounter.current += 1
        const id = crypto.randomUUID()
        const newNode: Node = {
            id,
            type: 'flowNode',
            position: { x: 250 + Math.random() * 200, y: 100 + nodeIdCounter.current * 120 },
            data: {
                label: nodeTypeCatalog.find(n => n.type === type)?.label || type,
                nodeType: type,
                config: type === 'trigger' ? { trigger_type: 'keyword', keywords: [], match_mode: 'contains' } : {},
                preview: '',
            },
        }
        setNodes(nds => [...nds, newNode])
    }

    const handleNodeClick = (_: any, node: Node) => {
        setSelectedNode(node)
        setContextMenu(null)
    }

    const handleDeleteNode = useCallback((nodeId: string) => {
        setNodes(nds => nds.filter(n => n.id !== nodeId))
        setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
        if (selectedNode?.id === nodeId) setSelectedNode(null)
        setContextMenu(null)
    }, [selectedNode])

    const handleDuplicateNode = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return
        const newId = crypto.randomUUID()
        const newNode: Node = {
            ...node,
            id: newId,
            position: { x: node.position.x + 40, y: node.position.y + 60 },
            data: { ...node.data },
            selected: false,
        }
        setNodes(nds => [...nds, newNode])
        setContextMenu(null)
    }, [nodes])

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault()
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
        setSelectedNode(node)
    }, [])

    const handlePaneClick = useCallback(() => {
        setSelectedNode(null)
        setContextMenu(null)
    }, [])

    const handleNodeConfigUpdate = (config: any, label: string) => {
        if (!selectedNode) return
        setNodes(nds => nds.map(n => {
            if (n.id === selectedNode.id) {
                return {
                    ...n,
                    data: {
                        ...n.data,
                        config,
                        label,
                        preview: getNodePreview(n.data.nodeType as string, config),
                    }
                }
            }
            return n
        }))
    }

    const handleSave = async () => {
        // Validación básica
        const triggerNodes = nodes.filter(n => n.data.nodeType === 'trigger')
        if (triggerNodes.length === 0) {
            setSaveStatus('❌ Agrega al menos un nodo Disparador para activar el flujo')
            setTimeout(() => setSaveStatus(''), 4000)
            return
        }
        const emptyTrigger = triggerNodes.find(n => {
            const cfg = n.data.config as any
            return cfg.trigger_type === 'keyword' && (!cfg.keywords || cfg.keywords.length === 0)
        })
        if (emptyTrigger) {
            setSaveStatus('❌ El nodo Disparador necesita al menos una palabra clave')
            setTimeout(() => setSaveStatus(''), 4000)
            return
        }

        setIsSaving(true)
        setSaveStatus('')
        try {
            const dbNodes = nodes.map(n => ({
                id: n.id,
                type: n.data.nodeType as string,
                label: (n.data.label as string) || '',
                position_x: n.position.x,
                position_y: n.position.y,
                config: n.data.config || {},
            }))

            const dbEdges = edges.map(e => ({
                id: e.id,
                source_node_id: e.source,
                target_node_id: e.target,
                source_handle: (e.sourceHandle as string) || 'default',
                label: (e.label as string) || '',
            }))

            await saveFlowCanvas(flowId, dbNodes, dbEdges)
            setSaveStatus('✅ Guardado')
            setTimeout(() => setSaveStatus(''), 3000)
        } catch (err: any) {
            console.error('Error saving:', err)
            setSaveStatus('❌ Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    const handleToggleActive = async () => {
        const newActive = !isActive
        setIsActive(newActive)
        await updateFlow(flowId, { is_active: newActive })
    }

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', width: '100%', position: 'relative', background: '#0a0a14' }}>
            {/* Sidebar — Node Catalog */}
            <div style={{
                width: 220, background: 'rgba(15,15,25,0.95)', borderRight: '1px solid rgba(255,255,255,0.08)',
                padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Button onClick={() => router.push(`/dashboard/assistants/${assistantId}/flows`)}
                        style={{ padding: 6, color: '#94a3b8', background: 'transparent' }}>
                        <ArrowLeft size={18} />
                    </Button>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {flowName}
                    </span>
                </div>

                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px' }}>
                    Nodos
                </div>

                {nodeTypeCatalog.map(item => {
                    const Icon = item.icon
                    return (
                        <button
                            key={item.type}
                            onClick={() => addNode(item.type)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                background: 'rgba(30,30,50,0.5)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                color: '#e2e8f0',
                            }}
                            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(129,140,248,0.1)' }}
                            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(30,30,50,0.5)' }}
                        >
                            <Icon size={16} style={{ color: nodeColors[item.type]?.border || '#818cf8', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.label}</div>
                                <div style={{ fontSize: '0.68rem', color: '#4b5563', lineHeight: 1.2, marginTop: 2 }}>{item.desc}</div>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleNodeClick}
                    onNodeContextMenu={handleNodeContextMenu}
                    onPaneClick={handlePaneClick}
                    nodeTypes={nodeTypes}
                    deleteKeyCode={['Backspace', 'Delete']}
                    fitView
                    colorMode="dark"
                    defaultEdgeOptions={{
                        animated: true,
                        style: { stroke: '#818cf8' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
                    }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
                    <Controls style={{ background: 'rgba(15,15,25,0.9)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }} />

                    <Panel position="top-right">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {saveStatus && (
                                <span style={{ color: saveStatus.startsWith('✅') ? '#22c55e' : '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                                    {saveStatus}
                                </span>
                            )}
                            <Button
                                onClick={handleToggleActive}
                                style={{
                                    background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
                                    border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                    color: isActive ? '#22c55e' : '#94a3b8',
                                    borderRadius: 10, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem'
                                }}
                            >
                                {isActive ? <Power size={16} /> : <PowerOff size={16} />}
                                {isActive ? 'Activo' : 'Inactivo'}
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                style={{
                                    background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: '#fff',
                                    border: 'none', borderRadius: 10, padding: '8px 20px',
                                    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem'
                                }}
                            >
                                <Save size={16} />
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </Panel>
                </ReactFlow>

                {/* Context Menu (right-click) */}
                {contextMenu && (
                    <div
                        style={{
                            position: 'fixed',
                            left: contextMenu.x,
                            top: contextMenu.y,
                            background: 'rgba(15,15,30,0.98)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 10,
                            padding: 4,
                            zIndex: 100,
                            minWidth: 160,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(12px)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => handleDuplicateNode(contextMenu.nodeId)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                background: 'transparent', border: 'none', color: '#e2e8f0',
                                borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
                                fontSize: '0.85rem', fontWeight: 500,
                            }}
                            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(129,140,248,0.15)' }}
                            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                        >
                            <Copy size={15} style={{ color: '#818cf8' }} />
                            Duplicar nodo
                        </button>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 8px' }} />
                        <button
                            onClick={() => handleDeleteNode(contextMenu.nodeId)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                background: 'transparent', border: 'none', color: '#ef4444',
                                borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
                                fontSize: '0.85rem', fontWeight: 500,
                            }}
                            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(239,68,68,0.1)' }}
                            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                        >
                            <Trash2 size={15} />
                            Eliminar nodo
                        </button>
                    </div>
                )}

                {/* Config Panel */}
                {selectedNode && (
                    <NodeConfigPanel
                        node={selectedNode}
                        onUpdate={handleNodeConfigUpdate}
                        onClose={() => setSelectedNode(null)}
                    />
                )}
            </div>
        </div>
    )
}
