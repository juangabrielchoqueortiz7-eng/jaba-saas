// ── Wizard Step Types ──────────────────────────────────────────────────────

export interface WizardStep {
  id: string
  type: 'trigger' | 'message' | 'buttons' | 'list' | 'question' | 'ai_response' | 'action' | 'delay'
  config: WizardStepConfig
}

export type FlowButton = {
  id: string
  title: string
}

export type FlowListRow = {
  id: string
  title: string
  description?: string
}

export type FlowParam = {
  label: string
  value: string
}

export interface WizardStepConfig {
  label?: string
  keywords?: string | string[]
  trigger_type?: string
  button_id?: string
  body?: string
  footer?: string
  condition_type?: string
  value?: string
  match_mode?: string
  text?: string
  buttons?: FlowButton[]
  rows?: FlowListRow[]
  variable_name?: string
  button_text?: string
  system_prompt?: string
  action_type?: string
  tag?: string
  image_url?: string
  document_url?: string
  video_url?: string
  audio_url?: string
  filename?: string
  caption?: string
  seconds?: number
  template_name?: string
  params?: FlowParam[]
  [key: string]: unknown
}

interface GeneratedNode {
  id: string
  type: string
  label: string
  position_x: number
  position_y: number
  config: WizardStepConfig
}

interface GeneratedEdge {
  id: string
  source_node_id: string
  target_node_id: string
  source_handle: string
  label: string
}

// ── Step → Nodes + Edges Converter ─────────────────────────────────────────

export function stepsToNodesEdges(steps: WizardStep[]): {
  nodes: GeneratedNode[]
  edges: GeneratedEdge[]
} {
  const nodes: GeneratedNode[] = []
  const edges: GeneratedEdge[] = []

  const X = 400
  let currentY = 0
  const Y_GAP = 150

  for (const step of steps) {
    const nodeId = step.id

    switch (step.type) {
      case 'trigger': {
        nodes.push({
          id: nodeId,
          type: 'trigger',
          label: step.config.label || 'Activador',
          position_x: X,
          position_y: currentY,
          config: {
            trigger_type: 'keyword',
            keywords: Array.isArray(step.config.keywords)
              ? step.config.keywords.map(k => k.trim()).filter(Boolean)
              : (step.config.keywords || '').split(',').map(k => k.trim()).filter(Boolean),
            match_mode: step.config.match_mode || 'contains',
          },
        })
        currentY += Y_GAP
        break
      }

      case 'message': {
        nodes.push({
          id: nodeId,
          type: 'message',
          label: step.config.label || 'Mensaje',
          position_x: X,
          position_y: currentY,
          config: { text: step.config.text || '' },
        })
        currentY += Y_GAP
        break
      }

      case 'buttons': {
        const buttons = (step.config.buttons || []).map((b, i) => ({
          id: b.id || `btn_${i + 1}`,
          title: b.title || `Opcion ${i + 1}`,
        }))

        nodes.push({
          id: nodeId,
          type: 'buttons',
          label: step.config.label || 'Botones',
          position_x: X,
          position_y: currentY,
          config: { text: step.config.text || 'Elige una opcion:', buttons },
        })
        currentY += Y_GAP

        // Auto-add wait_input after buttons
        const waitId = `${nodeId}_wait`
        nodes.push({
          id: waitId,
          type: 'wait_input',
          label: 'Esperar eleccion',
          position_x: X,
          position_y: currentY,
          config: { variable_name: step.config.variable_name || 'eleccion' },
        })
        edges.push({
          id: crypto.randomUUID(),
          source_node_id: nodeId,
          target_node_id: waitId,
          source_handle: 'default',
          label: '',
        })
        currentY += Y_GAP
        break
      }

      case 'list': {
        const rows = (step.config.rows || []).map((r, i) => ({
          id: r.id || `opt_${i + 1}`,
          title: r.title || `Opcion ${i + 1}`,
          description: r.description || '',
        }))

        nodes.push({
          id: nodeId,
          type: 'list',
          label: step.config.label || 'Lista',
          position_x: X,
          position_y: currentY,
          config: {
            body: step.config.text || 'Selecciona una opcion:',
            button_text: step.config.button_text || 'Ver opciones',
            rows,
          },
        })
        currentY += Y_GAP

        // Auto-add wait_input after list
        const waitId = `${nodeId}_wait`
        nodes.push({
          id: waitId,
          type: 'wait_input',
          label: 'Esperar seleccion',
          position_x: X,
          position_y: currentY,
          config: { variable_name: step.config.variable_name || 'seleccion' },
        })
        edges.push({
          id: crypto.randomUUID(),
          source_node_id: nodeId,
          target_node_id: waitId,
          source_handle: 'default',
          label: '',
        })
        currentY += Y_GAP
        break
      }

      case 'question': {
        // Question = message + wait_input
        nodes.push({
          id: nodeId,
          type: 'message',
          label: step.config.label || 'Pregunta',
          position_x: X,
          position_y: currentY,
          config: { text: step.config.text || '' },
        })
        currentY += Y_GAP

        const waitId = `${nodeId}_wait`
        nodes.push({
          id: waitId,
          type: 'wait_input',
          label: `Capturar: ${step.config.variable_name || 'respuesta'}`,
          position_x: X,
          position_y: currentY,
          config: { variable_name: step.config.variable_name || 'respuesta' },
        })
        edges.push({
          id: crypto.randomUUID(),
          source_node_id: nodeId,
          target_node_id: waitId,
          source_handle: 'default',
          label: '',
        })
        currentY += Y_GAP
        break
      }

      case 'ai_response': {
        nodes.push({
          id: nodeId,
          type: 'ai_response',
          label: step.config.label || 'Respuesta IA',
          position_x: X,
          position_y: currentY,
          config: { system_prompt: step.config.system_prompt || '' },
        })
        currentY += Y_GAP
        break
      }

      case 'action': {
        nodes.push({
          id: nodeId,
          type: 'action',
          label: step.config.label || 'Accion',
          position_x: X,
          position_y: currentY,
          config: {
            action_type: step.config.action_type || 'add_tag',
            tag: step.config.tag || '',
            image_url: step.config.image_url || '',
            caption: step.config.caption || '',
          },
        })
        currentY += Y_GAP
        break
      }

      case 'delay': {
        nodes.push({
          id: nodeId,
          type: 'delay',
          label: `Pausa ${step.config.seconds || 2}s`,
          position_x: X,
          position_y: currentY,
          config: { seconds: step.config.seconds || 2 },
        })
        currentY += Y_GAP
        break
      }
    }
  }

  // Connect sequential nodes (node[n] last generated → node[n+1] first generated)
  // We need to track which nodes were generated per step to connect them
  let prevLastNodeId: string | null = null
  let nodeIndex = 0

  for (const step of steps) {
    // Find the first node of this step
    const firstNodeOfStep = nodes[nodeIndex]
    if (!firstNodeOfStep) break

    // Connect previous step's last node to this step's first node
    if (prevLastNodeId) {
      // Check if this edge already exists (from internal step connections)
      const exists = edges.some(e => e.source_node_id === prevLastNodeId && e.target_node_id === firstNodeOfStep.id)
      if (!exists) {
        edges.push({
          id: crypto.randomUUID(),
          source_node_id: prevLastNodeId,
          target_node_id: firstNodeOfStep.id,
          source_handle: 'default',
          label: '',
        })
      }
    }

    // Count how many nodes this step generated
    let stepNodeCount = 1
    if (step.type === 'buttons' || step.type === 'list' || step.type === 'question') {
      stepNodeCount = 2 // main node + wait_input
    }

    // Update prevLastNodeId to the last node of this step
    prevLastNodeId = nodes[nodeIndex + stepNodeCount - 1]?.id || firstNodeOfStep.id
    nodeIndex += stepNodeCount
  }

  return { nodes, edges }
}

// ── Default step configs ───────────────────────────────────────────────────

export function getDefaultStepConfig(type: WizardStep['type']): WizardStepConfig {
  switch (type) {
    case 'trigger':
      return { label: 'Activador', keywords: '', match_mode: 'contains' }
    case 'message':
      return { label: 'Mensaje', text: '' }
    case 'buttons':
      return { label: 'Botones', text: 'Elige una opcion:', buttons: [{ id: 'btn_1', title: '' }, { id: 'btn_2', title: '' }], variable_name: 'eleccion' }
    case 'list':
      return { label: 'Lista', text: 'Selecciona una opcion:', button_text: 'Ver opciones', rows: [{ id: 'opt_1', title: '', description: '' }], variable_name: 'seleccion' }
    case 'question':
      return { label: 'Pregunta', text: '', variable_name: 'respuesta' }
    case 'ai_response':
      return { label: 'Respuesta IA', system_prompt: '' }
    case 'action':
      return { label: 'Accion', action_type: 'add_tag', tag: '' }
    case 'delay':
      return { label: 'Pausa', seconds: 3 }
    default:
      return {}
  }
}

export const STEP_TYPE_INFO: { type: WizardStep['type']; icon: string; label: string; desc: string }[] = [
  { type: 'message', icon: '💬', label: 'Enviar Mensaje', desc: 'Envia un mensaje de texto al cliente' },
  { type: 'buttons', icon: '🔘', label: 'Enviar Botones', desc: 'Muestra opciones como botones (max 3)' },
  { type: 'list', icon: '📋', label: 'Enviar Lista', desc: 'Muestra un menu desplegable (max 10)' },
  { type: 'question', icon: '❓', label: 'Hacer Pregunta', desc: 'Pregunta algo y guarda la respuesta' },
  { type: 'ai_response', icon: '🤖', label: 'Respuesta IA', desc: 'Deja que la IA responda inteligentemente' },
  { type: 'action', icon: '⚙️', label: 'Accion del Sistema', desc: 'Agrega etiqueta, envia imagen, etc.' },
  { type: 'delay', icon: '⏱️', label: 'Pausa', desc: 'Espera unos segundos antes de continuar' },
]
