/* eslint-disable react/no-unescaped-entities */
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
    type NodeMouseHandler,
    Panel,
    BackgroundVariant,
    MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import MediaUploadField from '@/components/flow-builder/MediaUploadField'
import {
    Save, ArrowLeft, Power, PowerOff, Trash2, Copy,
    MessageSquare, MousePointerClick, GitBranch, Bot, Clock, Zap, ListOrdered, Send
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { getFlowDetails, saveFlowCanvas, updateFlow } from '../actions'
import { getFlows } from '../actions'
import type { FlowButton, FlowListRow, FlowParam, WizardStepConfig } from '../wizard-utils'

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

type FlowNodeData = {
    label: string
    nodeType: string
    config: WizardStepConfig
    preview?: string
    isNew?: boolean
}

type FlowEditorNode = Node<FlowNodeData>

type MetaTemplateSummary = {
    name: string
    body: string
}

type MetaTemplateApiItem = {
    status?: string
    name: string
    components?: Array<{ type: string; text?: string }>
}

function isNodeConfigured(nodeType: string, config: WizardStepConfig): boolean {
    if (!config) return false
    if (nodeType === 'trigger') return config.trigger_type !== 'keyword' || ((config.keywords?.length ?? 0) > 0)
    if (nodeType === 'message') return !!config.text?.trim()
    if (nodeType === 'buttons') return !!config.text?.trim() && ((config.buttons?.length ?? 0) > 0)
    if (nodeType === 'list') return !!config.body?.trim() && ((config.rows?.length ?? 0) > 0)
    if (nodeType === 'condition') return !!config.value?.trim()
    if (nodeType === 'wait_input') return !!config.variable_name?.trim()
    if (nodeType === 'action') {
        if (!config.action_type) return false
        if (config.action_type === 'send_image') return !!config.image_url?.trim()
        if (config.action_type === 'send_document') return !!config.document_url?.trim()
        if (config.action_type === 'send_video') return !!config.video_url?.trim()
        if (config.action_type === 'send_audio') return !!config.audio_url?.trim()
        if (config.action_type === 'send_plans_list') return true
        if (config.action_type === 'create_renewal_order') return true
        if (config.action_type === 'send_qr_payment') return true
        if (config.action_type === 'renew_subscription') return true
        return true
    }
    if (nodeType === 'send_template') return !!config.template_name?.trim()
    return true
}

function FlowNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
    const colors = nodeColors[data.nodeType] || nodeColors.message
    const isCondition = data.nodeType === 'condition'
    const isTrigger = data.nodeType === 'trigger'
    const configured = isNodeConfigured(data.nodeType, data.config)

    return (
        <div style={{
            background: colors.bg,
            border: `2px solid ${selected ? '#0F172A' : configured ? colors.border : '#ef4444'}`,
            borderRadius: 12,
            padding: '12px 16px',
            minWidth: 180,
            maxWidth: 260,
            backdropFilter: 'blur(8px)',
            boxShadow: selected ? '0 0 0 3px rgba(34,197,94,0.25), 0 8px 24px rgba(15,23,42,0.08)' : '0 2px 8px rgba(15,23,42,0.06)',
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
            <div style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 500 }}>
                {data.label || 'Sin configurar'}
            </div>
            {!configured && (
                <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
                    ⚠ Haz clic para configurar
                </div>
            )}
            {data.preview && configured && (
                <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
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

function NodeConfigPanel({ node, onUpdate, onClose, metaTemplates }: { node: FlowEditorNode; onUpdate: (config: WizardStepConfig, label: string) => void; onClose: () => void; metaTemplates?: MetaTemplateSummary[] }) {
    const [config, setConfig] = useState<WizardStepConfig>(node.data.config || {})
    const [label, setLabel] = useState<string>((node.data.label as string) || '')
    const nodeType = node.data.nodeType as string

    const updateConfig = (key: string, value: WizardStepConfig[string]) => {
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
            background: '#FFFFFF', borderLeft: '1px solid rgba(15,23,42,0.1)',
            padding: 20, overflowY: 'auto', zIndex: 50, backdropFilter: 'blur(12px)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: '#0F172A', fontWeight: 700, fontSize: '1rem' }}>Configurar paso</h3>
                <Button onClick={onClose} style={{ color: '#475569', padding: 4, background: 'transparent' }}>✕</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Nombre de este paso</label>
                <Input
                    value={label}
                    onChange={e => updateLabel(e.target.value)}
                    placeholder="Nombre descriptivo"
                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                />

                {/* TRIGGER CONFIG */}
                {nodeType === 'trigger' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>¿Cómo se activa este flujo?</label>
                        <select
                            value={config.trigger_type || 'keyword'}
                            onChange={e => updateConfig('trigger_type', e.target.value)}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px' }}
                        >
                            <option value="keyword">📝 Palabra o frase clave (recomendado)</option>
                            <option value="button_id">🔘 Respuesta a un botón</option>
                            <option value="message_type">📎 Tipo de mensaje (imagen, audio, etc.)</option>
                            <option value="event">⚡ Evento del sistema</option>
                        </select>

                        {config.trigger_type === 'keyword' && (
                            <>
                                <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué palabras activan este flujo? (separadas por coma)</label>
                                <Input
                                    value={Array.isArray(config.keywords) ? config.keywords.join(', ') : (config.keywords || '')}
                                    onChange={e => updateConfig('keywords', e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean))}
                                    placeholder="hola, bienvenido, inicio"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                                <select
                                    value={config.match_mode || 'contains'}
                                    onChange={e => updateConfig('match_mode', e.target.value)}
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px' }}
                                >
                                    <option value="contains">Cuando el mensaje contiene la palabra</option>
                                    <option value="exact">Cuando el mensaje es exactamente igual</option>
                                    <option value="starts_with">Cuando el mensaje empieza con</option>
                                </select>
                            </>
                        )}

                        {config.trigger_type === 'button_id' && (
                            <>
                                <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>ID del botón (usa * para wildcard)</label>
                                <Input
                                    value={config.button_id || ''}
                                    onChange={e => updateConfig('button_id', e.target.value)}
                                    placeholder="renew_plan_*"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}
                    </>
                )}

                {/* MESSAGE CONFIG */}
                {nodeType === 'message' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Mensaje</label>
                        <FlowVariableButtons onInsert={v => appendToField('text', v)} />
                        <textarea
                            value={config.text || ''}
                            onChange={e => updateConfig('text', e.target.value)}
                            placeholder="¡Hola! Bienvenido. Haz clic en los botones de arriba para personalizar con el nombre del cliente, fecha, etc."
                            rows={4}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                    </>
                )}

                {/* BUTTONS CONFIG */}
                {nodeType === 'buttons' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Mensaje</label>
                        <FlowVariableButtons onInsert={v => appendToField('text', v)} />
                        <textarea
                            value={config.text || ''}
                            onChange={e => updateConfig('text', e.target.value)}
                            placeholder="Elige una opción:"
                            rows={2}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Botones (máx 3)</label>
                        {(config.buttons || [{ id: '', title: '' }]).map((btn: FlowButton, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: 6 }}>
                                <Input
                                    value={btn.id}
                                    onChange={e => {
                                        const btns = [...(config.buttons || [{ id: '', title: '' }])]
                                        btns[i] = { ...btns[i], id: e.target.value }
                                        updateConfig('buttons', btns)
                                    }}
                                    placeholder="ID"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', flex: 1 }}
                                />
                                <Input
                                    value={btn.title}
                                    onChange={e => {
                                        const btns = [...(config.buttons || [{ id: '', title: '' }])]
                                        btns[i] = { ...btns[i], title: e.target.value }
                                        updateConfig('buttons', btns)
                                    }}
                                    placeholder="Texto"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', flex: 2 }}
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
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Mensaje principal</label>
                        <textarea
                            value={config.body || ''}
                            onChange={e => updateConfig('body', e.target.value)}
                            placeholder="Selecciona una opción del menú:"
                            rows={3}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Texto del botón que abre el menú</label>
                        <Input
                            value={config.button_text || ''}
                            onChange={e => updateConfig('button_text', e.target.value)}
                            placeholder="Ver opciones"
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                        />
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>
                            Opciones de la lista
                            <span style={{ color: '#4b5563', fontWeight: 400, marginLeft: 6 }}>máx 10</span>
                        </label>
                        {(config.rows || [{ id: '', title: '', description: '' }]).map((row: FlowListRow, i: number) => (
                            <div key={i} style={{ background: '#F7F8FA', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid rgba(15,23,42,0.06)' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <Input
                                        value={row.id}
                                        onChange={e => {
                                            const rows = [...(config.rows || [])]
                                            rows[i] = { ...rows[i], id: e.target.value }
                                            updateConfig('rows', rows)
                                        }}
                                        placeholder={`ID (ej: opt_${i + 1})`}
                                        style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6, color: '#0F172A', flex: 1, fontSize: '0.8rem' }}
                                    />
                                    <Button
                                    onClick={() => updateConfig('rows', (config.rows || []).filter((_, idx) => idx !== i))}
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
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6, color: '#0F172A', fontSize: '0.8rem' }}
                                />
                                <Input
                                    value={row.description || ''}
                                    onChange={e => {
                                        const rows = [...(config.rows || [])]
                                        rows[i] = { ...rows[i], description: e.target.value }
                                        updateConfig('rows', rows)
                                    }}
                                    placeholder="Descripción (opcional)"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6, color: '#475569', fontSize: '0.75rem' }}
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
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Pie de página (opcional)</label>
                        <Input
                            value={config.footer || ''}
                            onChange={e => updateConfig('footer', e.target.value)}
                            placeholder="Texto del footer..."
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                        />
                    </>
                )}

                {/* CONDITION CONFIG */}
                {nodeType === 'condition' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué debe revisar?</label>
                        <select
                            value={config.condition_type || 'contains'}
                            onChange={e => updateConfig('condition_type', e.target.value)}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px' }}
                        >
                            <option value="contains">El mensaje contiene la palabra</option>
                            <option value="equals">El mensaje es exactamente</option>
                            <option value="message_type">El tipo de mensaje es (imagen, audio...)</option>
                            <option value="has_variable">Si una variable tiene valor</option>
                            <option value="interactive_id">El cliente respondió al botón con ID</option>
                        </select>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué valor comparar?</label>
                        <Input
                            value={config.value || ''}
                            onChange={e => updateConfig('value', e.target.value)}
                            placeholder={config.condition_type === 'message_type' ? 'image' : 'texto a comparar'}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                        />
                        <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                            Las conexiones con handle "true" se seguirán si la condición se cumple, "false" si no.
                        </p>
                    </>
                )}

                {/* WAIT INPUT CONFIG */}
                {nodeType === 'wait_input' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>¿Cómo llamar a la respuesta del cliente?</label>
                        <Input
                            value={config.variable_name || ''}
                            onChange={e => updateConfig('variable_name', e.target.value)}
                            placeholder="email, respuesta, etc."
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                        />
                        <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                            La respuesta del usuario se guardará en esta variable para usarla después.
                        </p>
                    </>
                )}

                {/* DELAY CONFIG */}
                {nodeType === 'delay' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>¿Cuántos segundos esperar antes de continuar?</label>
                        <Input
                            type="number"
                            value={config.seconds || 2}
                            onChange={e => updateConfig('seconds', parseInt(e.target.value) || 1)}
                            min={1}
                            max={30}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                        />
                    </>
                )}

                {/* ACTION CONFIG */}
                {nodeType === 'action' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>¿Qué acción ejecutar?</label>
                        <select
                            value={config.action_type || 'add_tag'}
                            onChange={e => updateConfig('action_type', e.target.value)}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px' }}
                        >
                            <optgroup label="Etiquetas">
                                <option value="add_tag">🏷️ Poner etiqueta al cliente</option>
                                <option value="remove_tag">🏷️ Quitarle etiqueta al cliente</option>
                            </optgroup>
                            <optgroup label="Medios">
                                <option value="send_image">🖼️ Enviar una imagen</option>
                                <option value="send_document">📄 Enviar un documento (PDF, etc.)</option>
                                <option value="send_video">🎥 Enviar un video</option>
                                <option value="send_audio">🎵 Enviar un audio</option>
                            </optgroup>
                            <optgroup label="Renovación / Pagos">
                                <option value="send_plans_list">📋 Mostrar planes disponibles</option>
                                <option value="create_renewal_order">🧾 Crear orden de pago</option>
                                <option value="send_qr_payment">📱 Enviar QR de pago</option>
                                <option value="renew_subscription">✅ Renovar suscripción</option>
                            </optgroup>
                        </select>
                        {(config.action_type === 'add_tag' || config.action_type === 'remove_tag') && (
                            <Input
                                value={config.tag || ''}
                                onChange={e => updateConfig('tag', e.target.value)}
                                placeholder="Nombre de la etiqueta"
                                style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                            />
                        )}
                        {config.action_type === 'send_image' && (
                            <>
                                <MediaUploadField
                                    kind="image"
                                    value={config.image_url as string || ''}
                                    onChange={url => updateConfig('image_url', url)}
                                    placeholder="JPG, PNG, WEBP — máx. 5 MB"
                                />
                                <Input
                                    value={config.caption as string || ''}
                                    onChange={e => updateConfig('caption', e.target.value)}
                                    placeholder="Pie de imagen (opcional)"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}
                        {config.action_type === 'send_document' && (
                            <>
                                <MediaUploadField
                                    kind="document"
                                    value={config.document_url as string || ''}
                                    onChange={url => {
                                        updateConfig('document_url', url)
                                        // Auto-completar nombre del archivo
                                        if (url && !config.filename) {
                                            const name = url.split('/').pop()?.split('?')[0] || ''
                                            // Remove timestamp prefix (e.g. "1714500000000-catalogo.pdf" → "catalogo.pdf")
                                            const clean = name.replace(/^\d+-/, '')
                                            updateConfig('filename', clean)
                                        }
                                    }}
                                    placeholder="PDF, Word, Excel — máx. 100 MB"
                                />
                                <Input
                                    value={config.filename as string || ''}
                                    onChange={e => updateConfig('filename', e.target.value)}
                                    placeholder="Nombre visible del archivo (ej: catalogo.pdf)"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                                <Input
                                    value={config.caption as string || ''}
                                    onChange={e => updateConfig('caption', e.target.value)}
                                    placeholder="Descripción del archivo (opcional)"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}
                        {config.action_type === 'send_video' && (
                            <>
                                <MediaUploadField
                                    kind="video"
                                    value={config.video_url as string || ''}
                                    onChange={url => updateConfig('video_url', url)}
                                    placeholder="MP4, MOV — máx. 16 MB"
                                />
                                <Input
                                    value={config.caption as string || ''}
                                    onChange={e => updateConfig('caption', e.target.value)}
                                    placeholder="Descripción del video (opcional)"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}
                        {config.action_type === 'send_audio' && (
                            <MediaUploadField
                                kind="audio"
                                value={config.audio_url as string || ''}
                                onChange={url => updateConfig('audio_url', url)}
                                placeholder="MP3, OGG, WAV — máx. 16 MB"
                            />
                        )}

                        {/* ── Renovación / Pagos ── */}
                        {config.action_type === 'send_plans_list' && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.72rem', background: 'rgba(34,197,94,0.06)', padding: '8px 10px', borderRadius: 8, margin: 0 }}>
                                    📋 Carga automáticamente los planes activos de tu catálogo y los envía al cliente como lista interactiva de WhatsApp.
                                </p>
                                <Input
                                    value={config.list_title as string || ''}
                                    onChange={e => updateConfig('list_title', e.target.value)}
                                    placeholder="Mensaje sobre la lista (ej: Estos son nuestros planes)"
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                                <Input
                                    value={config.button_text as string || ''}
                                    onChange={e => updateConfig('button_text', e.target.value)}
                                    placeholder='Texto del botón (ej: "Ver planes")'
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                                <Input
                                    value={config.variable_name as string || ''}
                                    onChange={e => updateConfig('variable_name', e.target.value)}
                                    placeholder='Variable donde guardar selección (ej: plan_id)'
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}

                        {config.action_type === 'create_renewal_order' && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.72rem', background: 'rgba(34,197,94,0.06)', padding: '8px 10px', borderRadius: 8, margin: 0 }}>
                                    🧾 Registra la orden del plan que el cliente seleccionó. Usa la variable donde guardaste su selección.
                                </p>
                                <Input
                                    value={config.plan_variable as string || ''}
                                    onChange={e => updateConfig('plan_variable', e.target.value)}
                                    placeholder='Variable con el plan elegido (ej: plan_id)'
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}

                        {config.action_type === 'send_qr_payment' && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.72rem', background: 'rgba(34,197,94,0.06)', padding: '8px 10px', borderRadius: 8, margin: 0 }}>
                                    📱 Envía el QR del plan que el cliente eligió. El QR se toma automáticamente de tu catálogo de productos.
                                </p>
                                <Input
                                    value={config.qr_message as string || ''}
                                    onChange={e => updateConfig('qr_message', e.target.value)}
                                    placeholder='Mensaje junto al QR (ej: Realiza tu pago y envía el comprobante aquí)'
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}

                        {config.action_type === 'renew_subscription' && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.72rem', background: 'rgba(34,197,94,0.06)', padding: '8px 10px', borderRadius: 8, margin: 0 }}>
                                    ✅ Renueva la suscripción del cliente automáticamente. Asegúrate de que el nodo anterior haya capturado el comprobante de pago.
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>Meses a agregar:</label>
                                    <select
                                        value={config.duration_months as number || 1}
                                        onChange={e => updateConfig('duration_months', Number(e.target.value))}
                                        style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px', flex: 1 }}
                                    >
                                        {[1, 2, 3, 6, 12].map(m => (
                                            <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>
                                        ))}
                                    </select>
                                </div>
                                <Input
                                    value={config.confirm_message as string || ''}
                                    onChange={e => updateConfig('confirm_message', e.target.value)}
                                    placeholder='Mensaje de confirmación (ej: ✅ ¡Renovación completada!)'
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                                />
                            </>
                        )}
                    </>
                )}

                {/* SEND TEMPLATE CONFIG */}
                {nodeType === 'send_template' && (
                    <>
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Plantilla Meta aprobada</label>
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
                                style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px', width: '100%' }}
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
                                style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A' }}
                            />
                        )}
                        {config.template_name && metaTemplates?.find(t => t.name === config.template_name)?.body && (
                            <p style={{ color: '#64748b', fontSize: '0.7rem', lineHeight: 1.4, background: '#F7F8FA', padding: '8px 10px', borderRadius: 6 }}>
                                {metaTemplates.find(t => t.name === config.template_name)!.body}
                            </p>
                        )}
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>
                            Parámetros del cuerpo{' '}
                            <span style={{ color: '#4b5563', fontWeight: 400 }}>({'{{1}}'}, {'{{2}}'}, ...)</span>
                        </label>
                        {(config.params || []).map((p: FlowParam, i: number) => (
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
                                    style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', flex: 1, fontSize: '0.8rem' }}
                                />
                                <Button
                                    onClick={() => updateConfig('params', (config.params || []).filter((_, idx) => idx !== i))}
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
                        <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>Instrucciones para la IA (opcional)</label>
                        <FlowVariableButtons onInsert={v => appendToField('system_prompt', v)} />
                        <textarea
                            value={config.system_prompt || ''}
                            onChange={e => updateConfig('system_prompt', e.target.value)}
                            placeholder="Ej: Responde de forma amigable. Ofrece los productos disponibles y sus precios."
                            rows={4}
                            style={{ background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, color: '#0F172A', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
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

    const [nodes, setNodes] = useState<FlowEditorNode[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [selectedNode, setSelectedNode] = useState<FlowEditorNode | null>(null)
    const [flowName, setFlowName] = useState('')
    const [isActive, setIsActive] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<string>('')
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
    const [metaTemplates, setMetaTemplates] = useState<MetaTemplateSummary[]>([])

    const nodeIdCounter = useRef(0)

    const loadMetaTemplates = useCallback(async () => {
        try {
            const res = await fetch('/api/meta-templates')
            const data = await res.json()
            const templates = (data.templates || []) as MetaTemplateApiItem[]
            const approved = templates
                .filter(t => t.status === 'APPROVED')
                .map(t => ({
                    name: t.name,
                    body: t.components?.find(c => c.type === 'BODY')?.text || '',
                }))
            setMetaTemplates(approved)
        } catch { }
    }, [])

    const loadFlow = useCallback(async () => {
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
        const rfNodes: FlowEditorNode[] = details.nodes.map(n => ({
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
    }, [flowId])

    useEffect(() => {
        void loadFlow()
        void loadMetaTemplates()
    }, [loadFlow, loadMetaTemplates])

    function getNodePreview(type: string, config: WizardStepConfig): string {
        if (type === 'trigger' && config.keywords?.length) {
            return `Palabras: ${Array.isArray(config.keywords) ? config.keywords.join(', ') : config.keywords}`
        }
        if (type === 'message' && config.text) return config.text.substring(0, 60)
        if (type === 'buttons' && config.buttons?.length) return `${config.buttons.length} botones`
        if (type === 'list' && config.rows?.length) return `${config.rows.length} opciones — "${config.button_text || 'Ver opciones'}"`
        if (type === 'condition') return `${config.condition_type}: ${config.value || ''}`
        if (type === 'delay') return `${config.seconds || 2}s de pausa`
        if (type === 'wait_input') return `Guarda en: ${config.variable_name || 'respuesta'}`
        if (type === 'action') {
            if (config.action_type === 'send_image') return `🖼️ ${config.image_url?.split('/').pop()?.split('?')[0] || 'imagen'}`
            if (config.action_type === 'send_document') return `📄 ${config.filename || config.document_url?.split('/').pop()?.split('?')[0] || 'documento'}`
            if (config.action_type === 'send_video') return `🎥 ${config.video_url?.split('/').pop()?.split('?')[0] || 'video'}`
            if (config.action_type === 'send_audio') return `🎵 ${config.audio_url?.split('/').pop()?.split('?')[0] || 'audio'}`
            if (config.action_type === 'send_plans_list') return '📋 Planes disponibles'
            if (config.action_type === 'create_renewal_order') return `🧾 Orden: ${config.plan_variable || 'plan_id'}`
            if (config.action_type === 'send_qr_payment') return '📱 QR de pago'
            if (config.action_type === 'renew_subscription') return `✅ Renovar ${config.duration_months || 1} mes(es)`
            return config.action_type || 'Acción'
        }
        return ''
    }

    const onNodesChange: OnNodesChange<FlowEditorNode> = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges<FlowEditorNode>(changes, nds)),
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
        const newNode: FlowEditorNode = {
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

    const handleNodeClick: NodeMouseHandler = (_, node) => {
        const typedNode = node as FlowEditorNode
        setSelectedNode(typedNode)
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
        const newNode: FlowEditorNode = {
            ...node,
            id: newId,
            position: { x: node.position.x + 40, y: node.position.y + 60 },
            data: { ...node.data },
            selected: false,
        }
        setNodes(nds => [...nds, newNode])
        setContextMenu(null)
    }, [nodes])

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: FlowEditorNode) => {
        event.preventDefault()
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
        setSelectedNode(node)
    }, [])

    const handlePaneClick = useCallback(() => {
        setSelectedNode(null)
        setContextMenu(null)
    }, [])

    const handleNodeConfigUpdate = (config: WizardStepConfig, label: string) => {
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
            const cfg = n.data.config
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
        } catch (err) {
            console.error('Error saving:', err)
            const msg = err instanceof Error ? err.message : 'Error desconocido'
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
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', width: '100%', position: 'relative', background: '#F7F8FA' }}>
            {/* Sidebar — Node Catalog */}
            <div style={{
                width: 220, background: '#FFFFFF', borderRight: '1px solid rgba(15,23,42,0.08)',
                padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Button onClick={() => router.push(`/dashboard/assistants/${assistantId}/flows`)}
                        style={{ padding: 6, color: '#475569', background: 'transparent' }}>
                        <ArrowLeft size={18} />
                    </Button>
                    <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                                background: '#F7F8FA', border: '1px solid rgba(15,23,42,0.06)',
                                borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                color: '#0F172A',
                            }}
                            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(74,222,128,0.1)' }}
                            onMouseLeave={e => { (e.target as HTMLElement).style.background = '#F7F8FA' }}
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
                            background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.1)',
                            borderRadius: 16, padding: '28px 36px', maxWidth: 420, textAlign: 'center',
                            backdropFilter: 'blur(12px)',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗺️</div>
                            <p style={{ color: '#0F172A', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
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
                                        <span style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.5 }}>{s.text}</span>
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
                    colorMode="light"
                    defaultEdgeOptions={{
                        animated: true,
                        style: { stroke: '#25D366' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#25D366' },
                    }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(15,23,42,0.08)" />
                    <Controls style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid rgba(15,23,42,0.1)' }} />

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
                                    border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(15,23,42,0.1)'}`,
                                    color: isActive ? '#22c55e' : '#475569',
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
                            background: '#FFFFFF',
                            border: '1px solid rgba(15,23,42,0.08)',
                            borderRadius: 10,
                            padding: 4,
                            zIndex: 100,
                            minWidth: 160,
                            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                            backdropFilter: 'blur(12px)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => handleDuplicateNode(contextMenu.nodeId)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                background: 'transparent', border: 'none', color: '#0F172A',
                                borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
                                fontSize: '0.85rem', fontWeight: 500,
                            }}
                            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(74,222,128,0.15)' }}
                            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                        >
                            <Copy size={15} style={{ color: '#25D366' }} />
                            Duplicar nodo
                        </button>
                        <div style={{ height: 1, background: 'rgba(15,23,42,0.08)', margin: '2px 8px' }} />
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
