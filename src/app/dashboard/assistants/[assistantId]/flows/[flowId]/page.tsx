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
    MessageSquare, MousePointerClick, GitBranch, Bot, Clock, Zap, ListOrdered, Image, Send
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
    wait_input: { bg: 'rgba(74,222,128,0.15)', border: '#25D366', icon: '⏳' },
    delay: { bg: 'rgba(100,116,139,0.15)', border: '#64748b', icon: '⏱️' },
    send_template: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', icon: '📨' },
}

function isNodeConfigured(nodeType: string, config: any): boolean {
    if (!config) return false
    if (nodeType === 'trigger') return config.trigger_type !== 'keyword' || (config.keywords?.length > 0)
    if (nodeType === 'message') return !!config.text?.trim()
    if (nodeType === 'buttons') return !!config.text?.trim() && config.buttons?.length > 0
    if (nodeType === 'list') return !!config.body?.trim() && config.rows?.length > 0
    if (nodeType === 'condition') return !!config.value?.trim()
    if (nodeType === 'wait_input') return !!config.variable_name?.trim()
    if (nodeType === 'action') return !!config.action_type
    if (nodeType === 'send_template') return !!config.template_name?.trim()
    return true
}

function FlowNode({ data, selected }: { data: any; selected: boolean }) {
    const colors = nodeColors[data.nodeType] || nodeColors.message
    const isCondition = data.nodeType === 'condition'
    const isTrigger = data.nodeType === 'trigger'
    const configured = isNodeConfigured(data.nodeType, data.config)

    return (
        <div style={{
            background: colors.bg,
            border: `2px solid ${selected ? '#fff' : configured ? colors.border : '#ef4444'}`,
            borderRadius: 12,
            padding: '12px 16px',
            minWidth: 180,
            maxWidth: 260,
            backdropFilter: 'blur(8px)',
            boxShadow: selected ? '0 0 20px rgba(74,222,128,0.3)' : '0 4px 12px rgba(0,0,0,0.3)',
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
            {!configured && (
                <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
                    ⚠ Haz clic para configurar
                </div>
            )}
            {data.preview && configured && (
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
    { type: 'trigger', label: 'Inicio', icon: Zap, desc: 'Cuando el cliente escribe una palabra clave' },
    { type: 'message', label: 'Enviar mensaje', icon: MessageSquare, desc: 'Envía un texto al cliente' },
    { type: 'buttons', label: 'Enviar botones', icon: MousePointerClick, desc: 'El cliente elige entre opciones' },
    { type: 'list', label: 'Enviar menú', icon: ListOrdered, desc: 'Menú desplegable con opciones' },
    { type: 'wait_input', label: 'Esperar respuesta', icon: Clock, desc: 'Espera que el cliente escriba algo' },
    { type: 'condition', label: 'Si / Entonces', icon: GitBranch, desc: 'Toma decisiones según la respuesta' },
    { type: 'ai_response', label: 'Respuesta IA', icon: Bot, desc: 'La IA genera una respuesta automática' },
    { type: 'action', label: 'Acción', icon: Zap, desc: 'Poner etiqueta, enviar imagen, etc.' },
    { type: 'delay', label: 'Pausa', icon: Clock, desc: 'Espera unos segundos antes de continuar' },
    { type: 'send_template', label: 'Enviar plantilla', icon: Send, desc: 'Envía una plantilla Meta aprobada' },
]

// ========================
// CONFIG PANEL
// ========================

// Friendly variable chips for the flow editor
const FLOW_VARIABLES = [
    { label: 'Nombre', key: '{{contact.name}}' },
    { label: 'Teléfono', key: '{{contact.phone}}' },
    { label: 'Servicio', key: '{{subscription.service}}' },
    { label: 'Vencimiento', key: '{{subscription.expires_at}}' },
    { label: 'Días restantes', key: '{{subscription.days_remaining}}' },
    { label: 'Hoy', key: '{{date.today}}' },
]

function FlowVariableButtons({ onInsert }: { onInsert: (key: string) => void }) {
    return (
        <div style={{ marginTop: 4, marginBottom: 4 }}>
            <p style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: 6, fontWeight: 600 }}>
                + Insertar dato del cliente:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {FLOW_VARIABLES.map(v => (
                    <button
                        key={v.key}
                        type="button"
                        title={v.key}
                        onClick={() => onInsert(v.key)}
                        style={{
                            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                            color: '#a5b4fc', borderRadius: 20, padding: '3px 10px',
                            fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)' }}
                    >
                        {v.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function NodeConfigPanel({ node, onUpdate, onClose, metaTemplates }: { node: Node; onUpdate: (config: any, label: string) => void; onClose: () => void; metaTemplates?: Array<{ name: string; body: string }> }) {
    const [config, setConfig] = useState<any>(node.data.config || {})
    const [label, setLabel] = useState<string>((node.data.label as string) || '')
    const nodeType = node.data.nodeType as string

    const updateConfig = (key: string, value: any) => {
        const newConfig = { ...config, [key]: value }
        setConfig(newConfig)
        onUpdate(newConfig, label)
    }

    const appendToField = (fieldKey: string, value: string) => {
        const current = config[fieldKey] || ''
        updateConfig(fieldKey, current + value)
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
                <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>Configurar paso</h3>
                <Button onClick={onClose} style={{ color: '#94a3b8', padding: 4, background: 'transparent' }}>✕</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Nombre de este paso</label>
                <Input
                    value={label}
                    onChange={e => updateLabel(e.target.value)}
                    placeholder="Nombre descriptivo"
                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                />

                {/* TRIGGER CONFIG */}
                {nodeType === 'trigger' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>¿Cómo se activa este flujo?</label>
                        <select
                            value={config.trigger_type || 'keyword'}
                            onChange={e => updateConfig('trigger_type', e.target.value)}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px' }}
                        >
                            <option value="keyword">📝 Palabra o frase clave (recomendado)</option>
                            <option value="button_id">🔘 Respuesta a un botón</option>
                            <option value="message_type">📎 Tipo de mensaje (imagen, audio, etc.)</option>
                            <option value="event">⚡ Evento del sistema</option>
                        </select>

                        {config.trigger_type === 'keyword' && (
                            <>
                                <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué palabras activan este flujo? (separadas por coma)</label>
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
                                    <option value="contains">Cuando el mensaje contiene la palabra</option>
                                    <option value="exact">Cuando el mensaje es exactamente igual</option>
                                    <option value="starts_with">Cuando el mensaje empieza con</option>
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
                        <FlowVariableButtons onInsert={v => appendToField('text', v)} />
                        <textarea
                            value={config.text || ''}
                            onChange={e => updateConfig('text', e.target.value)}
                            placeholder="¡Hola! Bienvenido. Haz clic en los botones de arriba para personalizar con el nombre del cliente, fecha, etc."
                            rows={4}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                    </>
                )}

                {/* BUTTONS CONFIG */}
                {nodeType === 'buttons' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Mensaje</label>
                        <FlowVariableButtons onInsert={v => appendToField('text', v)} />
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
                                style={{ color: '#25D366', fontSize: '0.8rem', background: 'transparent' }}>
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
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Texto del botón que abre el menú</label>
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
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué debe revisar?</label>
                        <select
                            value={config.condition_type || 'contains'}
                            onChange={e => updateConfig('condition_type', e.target.value)}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px' }}
                        >
                            <option value="contains">El mensaje contiene la palabra</option>
                            <option value="equals">El mensaje es exactamente</option>
                            <option value="message_type">El tipo de mensaje es (imagen, audio...)</option>
                            <option value="has_variable">Si una variable tiene valor</option>
                            <option value="interactive_id">El cliente respondió al botón con ID</option>
                        </select>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué valor comparar?</label>
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
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>¿Cómo llamar a la respuesta del cliente?</label>
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
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>¿Cuántos segundos esperar antes de continuar?</label>
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
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué acción ejecutar?</label>
                        <select
                            value={config.action_type || 'add_tag'}
                            onChange={e => updateConfig('action_type', e.target.value)}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px' }}
                        >
                            <option value="add_tag">🏷️ Poner etiqueta al cliente</option>
                            <option value="remove_tag">🏷️ Quitarle etiqueta al cliente</option>
                            <option value="send_image">🖼️ Enviar una imagen</option>
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

                {/* SEND TEMPLATE CONFIG */}
                {nodeType === 'send_template' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Plantilla Meta aprobada</label>
                        {metaTemplates && metaTemplates.length > 0 ? (
                            <select
                                value={config.template_name || ''}
                                onChange={e => {
                                    const name = e.target.value
                                    updateConfig('template_name', name)
                                    // Auto-detectar parámetros del body
                                    const tpl = metaTemplates.find(t => t.name === name)
                                    if (tpl) {
                                        const matches = [...(tpl.body || '').matchAll(/\{\{(\d+)\}\}/g)]
                                        const params = matches.map((_, i) => ({
                                            label: `Variable ${i + 1}`,
                                            value: config.params?.[i]?.value || '',
                                        }))
                                        updateConfig('params', params)
                                    }
                                }}
                                style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', width: '100%' }}
                            >
                                <option value="">— Selecciona una plantilla —</option>
                                {metaTemplates.map(t => (
                                    <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        ) : (
                            <Input
                                value={config.template_name || ''}
                                onChange={e => updateConfig('template_name', e.target.value)}
                                placeholder="ej: recordatorio_renovacion_v1"
                                style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                            />
                        )}
                        {config.template_name && metaTemplates?.find(t => t.name === config.template_name)?.body && (
                            <p style={{ color: '#64748b', fontSize: '0.7rem', lineHeight: 1.4, background: 'rgba(30,30,50,0.6)', padding: '8px 10px', borderRadius: 6 }}>
                                {metaTemplates.find(t => t.name === config.template_name)!.body}
                            </p>
                        )}
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                            Parámetros del cuerpo{' '}
                            <span style={{ color: '#4b5563', fontWeight: 400 }}>({'{{1}}'}, {'{{2}}'}, ...)</span>
                        </label>
                        {(config.params || []).map((p: any, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ color: '#64748b', fontSize: '0.75rem', flexShrink: 0, width: 32 }}>{`{{${i + 1}}}`}</span>
                                <Input
                                    value={p.value || ''}
                                    onChange={e => {
                                        const params = [...(config.params || [])]
                                        params[i] = { ...params[i], value: e.target.value }
                                        updateConfig('params', params)
                                    }}
                                    placeholder="{{contact.name}}"
                                    style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', flex: 1, fontSize: '0.8rem' }}
                                />
                                <Button
                                    onClick={() => updateConfig('params', (config.params || []).filter((_: any, idx: number) => idx !== i))}
                                    style={{ color: '#ef4444', background: 'transparent', padding: '4px 6px', flexShrink: 0 }}
                                >✕</Button>
                            </div>
                        ))}
                        <Button
                            onClick={() => updateConfig('params', [...(config.params || []), { label: `Variable ${(config.params || []).length + 1}`, value: '' }])}
                            style={{ color: '#f59e0b', fontSize: '0.8rem', background: 'transparent' }}
                        >
                            + Agregar parámetro
                        </Button>
                        <FlowVariableButtons onInsert={v => {
                            const params = [...(config.params || [])]
                            if (params.length > 0) {
                                params[params.length - 1] = { ...params[params.length - 1], value: params[params.length - 1].value + v }
                                updateConfig('params', params)
                            }
                        }} />
                    </>
                )}

                {/* AI RESPONSE CONFIG */}
                {nodeType === 'ai_response' && (
                    <>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Instrucciones para la IA (opcional)</label>
                        <FlowVariableButtons onInsert={v => appendToField('system_prompt', v)} />
                        <textarea
                            value={config.system_prompt || ''}
                            onChange={e => updateConfig('system_prompt', e.target.value)}
                            placeholder="Ej: Responde de forma amigable. Ofrece los productos disponibles y sus precios."
                            rows={4}
                            style={{ background: 'rgba(30,30,50,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                            Si lo dejas vacío, usará el entrenamiento principal del asistente.
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
    const [metaTemplates, setMetaTemplates] = useState<Array<{ name: string; body: string }>>([])

    const nodeIdCounter = useRef(0)

    useEffect(() => {
        loadFlow()
        loadMetaTemplates()
    }, [flowId])

    const loadMetaTemplates = async () => {
        try {
            const res = await fetch('/api/meta-templates')
            const data = await res.json()
            const approved = (data.templates || [])
                .filter((t: any) => t.status === 'APPROVED')
                .map((t: any) => ({
                    name: t.name,
                    body: t.components?.find((c: any) => c.type === 'BODY')?.text || '',
                }))
            setMetaTemplates(approved)
        } catch { }
    }

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
            style: { stroke: '#25D366' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#25D366' },
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
            style: { stroke: '#25D366' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#25D366' },
        }, eds)),
        []
    )

    const addNode = (type: string) => {
        nodeIdCounter.current += 1
        const id = crypto.randomUUID()
        // Place new nodes in a predictable vertical stack centered on the canvas
        const xCenter = 300
        const yOffset = nodeIdCounter.current * 160
        const newNode: Node = {
            id,
            type: 'flowNode',
            position: { x: xCenter, y: yOffset },
            data: {
                label: nodeTypeCatalog.find(n => n.type === type)?.label || type,
                nodeType: type,
                config: type === 'trigger' ? { trigger_type: 'keyword', keywords: [], match_mode: 'contains' } : {},
                preview: '',
                isNew: true,
            },
        }
        setNodes(nds => [...nds, newNode])
        // Auto-open config panel for this node
        setSelectedNode(newNode)
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
            setSaveStatus('❌ Agrega al menos un nodo de Inicio para activar la conversación')
            setTimeout(() => setSaveStatus(''), 4000)
            return
        }
        const emptyTrigger = triggerNodes.find(n => {
            const cfg = n.data.config as any
            return cfg.trigger_type === 'keyword' && (!cfg.keywords || cfg.keywords.length === 0)
        })
        if (emptyTrigger) {
            setSaveStatus('❌ El nodo de Inicio necesita al menos una palabra clave')
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
            const msg = err?.message || 'Error desconocido'
            setSaveStatus(`❌ ${msg}`)
            setTimeout(() => setSaveStatus(''), 6000)
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
                    Arrastra o haz clic para agregar
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
                            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(74,222,128,0.1)' }}
                            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(30,30,50,0.5)' }}
                        >
                            <Icon size={16} style={{ color: nodeColors[item.type]?.border || '#25D366', flexShrink: 0 }} />
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
                {/* Onboarding overlay — shown when canvas is empty */}
                {nodes.length === 0 && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 10, display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none',
                    }}>
                        <div style={{
                            background: 'rgba(15,15,30,0.85)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 16, padding: '28px 36px', maxWidth: 420, textAlign: 'center',
                            backdropFilter: 'blur(12px)',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗺️</div>
                            <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
                                Tu flujo está vacío
                            </p>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 16 }}>
                                Construye tu flujo en 3 pasos:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                                {[
                                    { step: '1', text: 'Haz clic en "Inicio" en el panel izquierdo para agregar el primer paso' },
                                    { step: '2', text: 'Agrega pasos de "Enviar mensaje", "Enviar botones", etc.' },
                                    { step: '3', text: 'Conecta los pasos arrastrando desde el círculo inferior de un nodo al superior del siguiente' },
                                ].map(s => (
                                    <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <span style={{ background: '#25D366', color: '#000', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{s.step}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>{s.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
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
                        style: { stroke: '#25D366' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#25D366' },
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
                                    background: 'linear-gradient(135deg, #25D366, #25D366)', color: '#fff',
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
                            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(74,222,128,0.15)' }}
                            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                        >
                            <Copy size={15} style={{ color: '#25D366' }} />
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
                        metaTemplates={metaTemplates}
                    />
                )}
            </div>
        </div>
    )
}
