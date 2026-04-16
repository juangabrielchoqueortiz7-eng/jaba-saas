'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronUp,
  Eye, EyeOff, Info,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createFlow, saveFlowCanvas } from './actions'
import type { FlowButton, FlowListRow, WizardStep, WizardStepConfig } from './wizard-utils'
import { stepsToNodesEdges, getDefaultStepConfig, STEP_TYPE_INFO } from './wizard-utils'
import PhonePreview from './PhonePreview'

// ── Step Editor Components ─────────────────────────────────────────────────

function TriggerStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Palabras clave que activan el flujo (separadas por coma)</label>
        <Input
          value={step.config.keywords || ''}
          onChange={e => onChange({ ...step.config, keywords: e.target.value })}
          placeholder="hola, info, menu, precios, ayuda"
          className="bg-[#F7F8FA] border-black/[0.06] text-[#0F172A]"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Cuando un cliente escriba cualquiera de estas palabras, el flujo se activara automaticamente.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Modo de coincidencia</label>
        <select
          value={step.config.match_mode || 'contains'}
          onChange={e => onChange({ ...step.config, match_mode: e.target.value })}
          className="w-full px-3 py-2 bg-[#F7F8FA] border border-black/[0.06] rounded-lg text-sm text-[#0F172A]"
        >
          <option value="contains">Contiene la palabra</option>
          <option value="exact">Coincidencia exacta</option>
          <option value="starts_with">Empieza con</option>
        </select>
      </div>
    </div>
  )
}

function MessageStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-500 mb-1 block">Mensaje</label>
      <textarea
        value={step.config.text || ''}
        onChange={e => onChange({ ...step.config, text: e.target.value })}
        placeholder="Hola {{contact_name}}! Bienvenido a nuestro servicio..."
        rows={3}
        className="w-full px-3 py-2 bg-[#F7F8FA] border border-black/[0.06] rounded-lg text-sm text-[#0F172A] resize-y"
      />
      <p className="text-[10px] text-slate-400">
        Variables: {'{{contact_name}}'}, {'{{phone_number}}'}, {'{{service_name}}'}
      </p>
    </div>
  )
}

function ButtonsStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  const buttons = step.config.buttons || [{ id: 'btn_1', title: '' }]
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Mensaje antes de los botones</label>
        <textarea
          value={step.config.text || ''}
          onChange={e => onChange({ ...step.config, text: e.target.value })}
          placeholder="Que te gustaria hacer hoy?"
          rows={2}
          className="w-full px-3 py-2 bg-[#F7F8FA] border border-black/[0.06] rounded-lg text-sm text-[#0F172A] resize-y"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Botones (maximo 3)</label>
        <div className="space-y-2">
          {buttons.map((btn: FlowButton, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-5 text-center">{i + 1}</span>
              <Input
                value={btn.title}
                onChange={e => {
                  const newBtns = [...buttons]
                  newBtns[i] = { ...newBtns[i], title: e.target.value, id: `btn_${i + 1}` }
                  onChange({ ...step.config, buttons: newBtns })
                }}
                placeholder={`Texto del boton ${i + 1}`}
                className="flex-1 bg-[#F7F8FA] border-black/[0.06] text-[#0F172A] h-9 text-sm"
              />
              {buttons.length > 1 && (
                <button
                  onClick={() => onChange({ ...step.config, buttons: buttons.filter((_, idx) => idx !== i) })}
                  className="p-1 text-red-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {buttons.length < 3 && (
          <button
            onClick={() => onChange({ ...step.config, buttons: [...buttons, { id: `btn_${buttons.length + 1}`, title: '' }] })}
            className="text-xs text-cyan-600 hover:text-cyan-700 mt-2 font-medium"
          >
            + Agregar boton
          </button>
        )}
      </div>
    </div>
  )
}

function ListStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  const rows = step.config.rows || [{ id: 'opt_1', title: '', description: '' }]
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Mensaje antes de la lista</label>
        <textarea
          value={step.config.text || ''}
          onChange={e => onChange({ ...step.config, text: e.target.value })}
          placeholder="Selecciona una opcion del menu:"
          rows={2}
          className="w-full px-3 py-2 bg-[#F7F8FA] border border-black/[0.06] rounded-lg text-sm text-[#0F172A] resize-y"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Texto del boton para abrir la lista</label>
        <Input
          value={step.config.button_text || ''}
          onChange={e => onChange({ ...step.config, button_text: e.target.value })}
          placeholder="Ver opciones"
          className="bg-[#F7F8FA] border-black/[0.06] text-[#0F172A] h-9 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Opciones de la lista (max 10)</label>
        <div className="space-y-2">
          {rows.map((row: FlowListRow, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs text-slate-400 w-5 text-center mt-2">{i + 1}</span>
              <div className="flex-1 space-y-1">
                <Input
                  value={row.title}
                  onChange={e => {
                    const newRows = [...rows]
                    newRows[i] = { ...newRows[i], title: e.target.value, id: `opt_${i + 1}` }
                    onChange({ ...step.config, rows: newRows })
                  }}
                  placeholder={`Titulo opcion ${i + 1}`}
                  className="bg-[#F7F8FA] border-black/[0.06] text-[#0F172A] h-8 text-xs"
                />
                <Input
                  value={row.description || ''}
                  onChange={e => {
                    const newRows = [...rows]
                    newRows[i] = { ...newRows[i], description: e.target.value }
                    onChange({ ...step.config, rows: newRows })
                  }}
                  placeholder="Descripcion (opcional)"
                  className="bg-[#F7F8FA] border-black/[0.06] text-slate-400 h-7 text-[11px]"
                />
              </div>
              {rows.length > 1 && (
                <button
                  onClick={() => onChange({ ...step.config, rows: rows.filter((_, idx) => idx !== i) })}
                  className="p-1 text-red-400 hover:text-red-500 mt-1"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        {rows.length < 10 && (
          <button
            onClick={() => onChange({ ...step.config, rows: [...rows, { id: `opt_${rows.length + 1}`, title: '', description: '' }] })}
            className="text-xs text-cyan-600 hover:text-cyan-700 mt-2 font-medium"
          >
            + Agregar opcion
          </button>
        )}
      </div>
    </div>
  )
}

function QuestionStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Pregunta para el cliente</label>
        <textarea
          value={step.config.text || ''}
          onChange={e => onChange({ ...step.config, text: e.target.value })}
          placeholder="Cual es tu correo electronico?"
          rows={2}
          className="w-full px-3 py-2 bg-[#F7F8FA] border border-black/[0.06] rounded-lg text-sm text-[#0F172A] resize-y"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Guardar respuesta como</label>
        <Input
          value={step.config.variable_name || ''}
          onChange={e => onChange({ ...step.config, variable_name: e.target.value })}
          placeholder="email, nombre, telefono..."
          className="bg-[#F7F8FA] border-black/[0.06] text-[#0F172A] h-9 text-sm"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Podras usar esta respuesta despues como {'{{nombre_variable}}'} en otros mensajes.
        </p>
      </div>
    </div>
  )
}

function AIStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  return (
    <div className="space-y-2">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <p className="text-[11px] text-emerald-700">La IA respondera usando el entrenamiento de tu asistente. Opcionalmente puedes darle instrucciones especificas.</p>
      </div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">Instrucciones especiales (opcional)</label>
      <textarea
        value={step.config.system_prompt || ''}
        onChange={e => onChange({ ...step.config, system_prompt: e.target.value })}
        placeholder="Ej: Enfocate en cerrar la venta. Muestra precios y planes disponibles."
        rows={3}
        className="w-full px-3 py-2 bg-[#F7F8FA] border border-black/[0.06] rounded-lg text-sm text-[#0F172A] resize-y"
      />
    </div>
  )
}

function ActionStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo de accion</label>
        <select
          value={step.config.action_type || 'add_tag'}
          onChange={e => onChange({ ...step.config, action_type: e.target.value })}
          className="w-full px-3 py-2 bg-[#F7F8FA] border border-black/[0.06] rounded-lg text-sm text-[#0F172A]"
        >
          <option value="add_tag">Agregar etiqueta</option>
          <option value="remove_tag">Quitar etiqueta</option>
          <option value="send_image">Enviar imagen</option>
        </select>
      </div>
      {(step.config.action_type === 'add_tag' || step.config.action_type === 'remove_tag') && (
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre de la etiqueta</label>
          <Input
            value={step.config.tag || ''}
            onChange={e => onChange({ ...step.config, tag: e.target.value })}
            placeholder="vip, lead-nuevo, interesado..."
            className="bg-[#F7F8FA] border-black/[0.06] text-[#0F172A] h-9 text-sm"
          />
        </div>
      )}
      {step.config.action_type === 'send_image' && (
        <>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">URL de la imagen</label>
            <Input
              value={step.config.image_url || ''}
              onChange={e => onChange({ ...step.config, image_url: e.target.value })}
              placeholder="https://..."
              className="bg-[#F7F8FA] border-black/[0.06] text-[#0F172A] h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Texto debajo de la imagen (opcional)</label>
            <Input
              value={step.config.caption || ''}
              onChange={e => onChange({ ...step.config, caption: e.target.value })}
              placeholder="Descripcion de la imagen"
              className="bg-[#F7F8FA] border-black/[0.06] text-[#0F172A] h-9 text-sm"
            />
          </div>
        </>
      )}
    </div>
  )
}

function DelayStepEditor({ step, onChange }: { step: WizardStep; onChange: (config: WizardStepConfig) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-500 mb-1 block">Segundos de espera</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={30}
          value={step.config.seconds || 3}
          onChange={e => onChange({ ...step.config, seconds: parseInt(e.target.value) })}
          className="flex-1 accent-cyan-500"
        />
        <span className="text-sm font-bold text-[#0F172A] w-12 text-center">{step.config.seconds || 3}s</span>
      </div>
    </div>
  )
}

// ── Step type icons ────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, string> = {
  trigger: '⚡', message: '💬', buttons: '🔘', list: '📋',
  question: '❓', ai_response: '🤖', action: '⚙️', delay: '⏱️',
}

const STEP_COLORS: Record<string, string> = {
  trigger: 'border-yellow-300 bg-yellow-50',
  message: 'border-blue-200 bg-blue-50',
  buttons: 'border-purple-200 bg-purple-50',
  list: 'border-cyan-200 bg-cyan-50',
  question: 'border-amber-200 bg-amber-50',
  ai_response: 'border-emerald-200 bg-emerald-50',
  action: 'border-red-200 bg-red-50',
  delay: 'border-slate-200 bg-slate-50',
}

const STEP_LABELS: Record<string, string> = {
  trigger: 'Activador', message: 'Mensaje', buttons: 'Botones', list: 'Lista',
  question: 'Pregunta', ai_response: 'IA', action: 'Accion', delay: 'Pausa',
}

// ── Main Wizard ────────────────────────────────────────────────────────────

type FlowRecipe = {
  id: string
  title: string
  description: string
  flowName: string
  flowDesc: string
  steps: Array<{ type: WizardStep['type']; config: WizardStepConfig }>
}

const FLOW_RECIPES: FlowRecipe[] = [
  {
    id: 'sales',
    title: 'Ventas',
    description: 'Presenta opciones, captura interes y marca el chat.',
    flowName: 'Flujo de ventas',
    flowDesc: 'Guia al cliente desde la consulta hasta el siguiente paso de compra.',
    steps: [
      { type: 'trigger', config: { keywords: 'precio, planes, comprar, info', match_mode: 'contains' } },
      { type: 'message', config: { text: 'Hola {{contact_name}}. Te comparto las opciones disponibles y te ayudo a elegir la mejor.' } },
      { type: 'buttons', config: { text: 'Que te gustaria hacer?', buttons: [{ id: 'btn_1', title: 'Ver planes' }, { id: 'btn_2', title: 'Hablar con asesor' }] } },
      { type: 'action', config: { action_type: 'add_tag', tag: 'lead_interesado' } },
    ],
  },
  {
    id: 'booking',
    title: 'Reservas o citas',
    description: 'Pide datos clave para agendar sin perder el orden.',
    flowName: 'Flujo de reservas',
    flowDesc: 'Captura fecha, hora y datos para confirmar una reserva o cita.',
    steps: [
      { type: 'trigger', config: { keywords: 'reservar, cita, agenda, turno', match_mode: 'contains' } },
      { type: 'message', config: { text: 'Perfecto. Te ayudo a coordinar la reserva.' } },
      { type: 'question', config: { text: 'Que fecha y hora te gustaria reservar?', variable_name: 'fecha_hora' } },
      { type: 'question', config: { text: 'A nombre de quien hacemos la reserva?', variable_name: 'nombre_reserva' } },
      { type: 'message', config: { text: 'Gracias. Revisaremos disponibilidad y te confirmaremos por aqui.' } },
    ],
  },
  {
    id: 'support',
    title: 'Soporte',
    description: 'Ordena problemas y pide el detalle correcto.',
    flowName: 'Flujo de soporte',
    flowDesc: 'Recopila informacion para atender mejor un caso de ayuda.',
    steps: [
      { type: 'trigger', config: { keywords: 'ayuda, soporte, problema, error', match_mode: 'contains' } },
      { type: 'message', config: { text: 'Gracias por escribirnos. Te ayudamos a revisar el caso.' } },
      { type: 'question', config: { text: 'Cuentame brevemente que problema tienes.', variable_name: 'detalle_soporte' } },
      { type: 'action', config: { action_type: 'add_tag', tag: 'soporte_pendiente' } },
    ],
  },
]

interface FlowWizardProps {
  assistantId: string
}

export default function FlowWizard({ assistantId }: FlowWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [flowName, setFlowName] = useState('')
  const [flowDesc, setFlowDesc] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const [showAddStep, setShowAddStep] = useState(false)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  // Start with trigger step
  const [steps, setSteps] = useState<WizardStep[]>([
    { id: crypto.randomUUID(), type: 'trigger', config: getDefaultStepConfig('trigger') },
  ])

  const applyFlowRecipe = (recipe: FlowRecipe) => {
    const nextSteps = recipe.steps.map(step => ({
      id: crypto.randomUUID(),
      type: step.type,
      config: step.config,
    }))
    setFlowName(recipe.flowName)
    setFlowDesc(recipe.flowDesc)
    setSteps(nextSteps)
    setExpandedStep(nextSteps[0]?.id || null)
    setShowAddStep(false)
  }

  const addStep = (type: WizardStep['type']) => {
    const newStep: WizardStep = {
      id: crypto.randomUUID(),
      type,
      config: getDefaultStepConfig(type),
    }
    setSteps([...steps, newStep])
    setShowAddStep(false)
    setExpandedStep(newStep.id)
  }

  const removeStep = (index: number) => {
    if (index === 0) return // Can't remove trigger
    setSteps(steps.filter((_, i) => i !== index))
  }

  const updateStepConfig = (index: number, config: WizardStepConfig) => {
    setSteps(steps.map((s, i) => i === index ? { ...s, config } : s))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (index === 0) return // Can't move trigger
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 1 || targetIndex >= steps.length) return
    const newSteps = [...steps]
    const temp = newSteps[index]
    newSteps[index] = newSteps[targetIndex]
    newSteps[targetIndex] = temp
    setSteps(newSteps)
  }

  const handleSave = () => {
    if (!flowName.trim()) return alert('El nombre del flujo es obligatorio')

    const triggerStep = steps[0]
    const keywordSource = triggerStep.config.keywords
    const keywords = Array.isArray(keywordSource)
      ? keywordSource.map(k => k.trim()).filter(Boolean)
      : (keywordSource || '').split(',').map(k => k.trim()).filter(Boolean)
    if (keywords.length === 0) return alert('Agrega al menos una palabra clave en el Activador')

    if (steps.length < 2) return alert('Agrega al menos un paso despues del Activador')

    startTransition(async () => {
      try {
        // 1. Create the flow
        const flow = await createFlow(flowName, flowDesc)
        if (!flow) throw new Error('Error al crear el flujo')

        // 2. Convert wizard steps to nodes + edges
        const { nodes, edges } = stepsToNodesEdges(steps)

        // 3. Save canvas
        await saveFlowCanvas(
          flow.id,
          nodes.map(n => ({ id: n.id, type: n.type, label: n.label, position_x: n.position_x, position_y: n.position_y, config: n.config })),
          edges.map(e => ({ id: e.id, source_node_id: e.source_node_id, target_node_id: e.target_node_id, source_handle: e.source_handle, label: e.label })),
        )

        // 4. Navigate to the canvas editor for final adjustments
        router.push(`/dashboard/assistants/${assistantId}/flows/${flow.id}`)
      } catch (err) {
        console.error(err)
        alert('Error al guardar el flujo')
      }
    })
  }

  const renderStepEditor = (step: WizardStep, index: number) => {
    switch (step.type) {
      case 'trigger': return <TriggerStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      case 'message': return <MessageStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      case 'buttons': return <ButtonsStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      case 'list': return <ListStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      case 'question': return <QuestionStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      case 'ai_response': return <AIStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      case 'action': return <ActionStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      case 'delay': return <DelayStepEditor step={step} onChange={c => updateStepConfig(index, c)} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Top bar */}
      <div className="bg-white border-b border-black/[0.07] px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/dashboard/assistants/${assistantId}/flows`)}
            className="p-2 hover:bg-[#F7F8FA] rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <Input
              value={flowName}
              onChange={e => setFlowName(e.target.value)}
              placeholder="Nombre del flujo..."
              className="bg-transparent border-none text-lg font-bold text-[#0F172A] placeholder:text-slate-300 p-0 h-auto focus-visible:ring-0"
            />
            <Input
              value={flowDesc}
              onChange={e => setFlowDesc(e.target.value)}
              placeholder="Descripcion breve (opcional)"
              className="bg-transparent border-none text-xs text-slate-400 placeholder:text-slate-300 p-0 h-auto focus-visible:ring-0 mt-0.5"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              showPreview ? 'bg-cyan-50 text-cyan-600 border border-cyan-200' : 'bg-[#F7F8FA] text-slate-400 border border-black/[0.06]'
            }`}
          >
            {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
            Vista Previa
          </button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl"
          >
            <Save size={16} />
            {isPending ? 'Guardando...' : 'Guardar Flujo'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-6 p-6 max-w-7xl mx-auto">
        {/* Left: Steps */}
        <div className={`${showPreview ? 'flex-1' : 'w-full max-w-3xl mx-auto'} space-y-3`}>
          <div className="rounded-lg border border-black/[0.08] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-700">Crear rapido</p>
                <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Empieza con un flujo profesional</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Elige una base, revisa los mensajes y guarda. Luego puedes ajustar el diagrama si lo necesitas.
                </p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-[#F7F8FA] px-3 py-2 text-xs font-semibold text-slate-500">
                Paso a paso, sin complicarte
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {FLOW_RECIPES.map(recipe => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => applyFlowRecipe(recipe)}
                  className="rounded-lg border border-black/[0.07] bg-[#F7F8FA] p-4 text-left transition-colors hover:border-cyan-300 hover:bg-cyan-50"
                >
                  <p className="text-sm font-bold text-[#0F172A]">{recipe.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{recipe.description}</p>
                  <p className="mt-3 text-[11px] font-semibold text-cyan-700">{recipe.steps.length} pasos prearmados</p>
                </button>
              ))}
            </div>
          </div>

          {/* Info bar */}
          <div className="flex items-start gap-2 px-4 py-3 bg-cyan-50 border border-cyan-200 rounded-xl">
            <Info size={14} className="text-cyan-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-cyan-700 leading-relaxed">
              Crea tu flujo agregando pasos de arriba a abajo. El bot seguira estos pasos en orden cuando un cliente active el flujo.
              Al guardar, podras ver y ajustar el diagrama en el <strong>Modo Avanzado</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {[
              'Activador: que palabras inician el flujo.',
              'Respuesta: que mensaje, pregunta o botones vera el cliente.',
              'Cierre: etiqueta, espera, IA o accion final.',
            ].map(item => (
              <div key={item} className="rounded-lg border border-black/[0.07] bg-white px-3 py-2 text-xs text-slate-600">
                {item}
              </div>
            ))}
          </div>

          {/* Steps list */}
          {steps.map((step, index) => {
            const isExpanded = expandedStep === step.id
            return (
              <div key={step.id}>
                {/* Connector line */}
                {index > 0 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-5 bg-slate-200 rounded-full" />
                  </div>
                )}

                {/* Step card */}
                <div className={`rounded-xl border-2 ${STEP_COLORS[step.type]} overflow-hidden transition-all`}>
                  {/* Step header */}
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-lg">{STEP_ICONS[step.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Paso {index + 1}</span>
                        <span className="text-xs font-semibold text-[#0F172A]">{STEP_LABELS[step.type]}</span>
                      </div>
                      {/* Collapsed preview */}
                      {!isExpanded && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {step.type === 'trigger' && (step.config.keywords || 'Sin palabras clave')}
                          {step.type === 'message' && (step.config.text || 'Sin mensaje').substring(0, 60)}
                          {step.type === 'buttons' && `${(step.config.buttons || []).length} botones`}
                          {step.type === 'list' && `${(step.config.rows || []).length} opciones`}
                          {step.type === 'question' && (step.config.text || 'Sin pregunta').substring(0, 50)}
                          {step.type === 'ai_response' && (step.config.system_prompt ? 'Con instrucciones' : 'IA por defecto')}
                          {step.type === 'action' && (step.config.action_type === 'add_tag' ? `+${step.config.tag || '...'}` : step.config.action_type)}
                          {step.type === 'delay' && `${step.config.seconds || 3} segundos`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Move buttons */}
                      {index > 1 && (
                        <button onClick={e => { e.stopPropagation(); moveStep(index, 'up') }} className="p-1 text-slate-300 hover:text-slate-500">
                          <ChevronUp size={14} />
                        </button>
                      )}
                      {index > 0 && index < steps.length - 1 && (
                        <button onClick={e => { e.stopPropagation(); moveStep(index, 'down') }} className="p-1 text-slate-300 hover:text-slate-500">
                          <ChevronDown size={14} />
                        </button>
                      )}
                      {/* Delete */}
                      {index > 0 && (
                        <button onClick={e => { e.stopPropagation(); removeStep(index) }} className="p-1 text-red-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Step editor */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-black/[0.06]">
                      {renderStepEditor(step, index)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add step button */}
          <div className="flex justify-center pt-2">
            <div className="w-0.5 h-4 bg-slate-200 rounded-full mb-2" />
          </div>

          {showAddStep ? (
            <div className="bg-white rounded-xl border border-black/[0.08] p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 mb-3">Que paso quieres agregar?</p>
              <div className="grid grid-cols-2 gap-2">
                {STEP_TYPE_INFO.map(info => (
                  <button
                    key={info.type}
                    onClick={() => addStep(info.type)}
                    className="flex items-start gap-2.5 p-3 rounded-lg border border-black/[0.06] bg-[#F7F8FA] hover:bg-cyan-50 hover:border-cyan-200 transition-all text-left group"
                  >
                    <span className="text-base">{info.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-[#0F172A] group-hover:text-cyan-700">{info.label}</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{info.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddStep(false)}
                className="w-full mt-3 text-xs text-slate-400 hover:text-slate-600 py-1"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setShowAddStep(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-black/[0.12] bg-white hover:border-cyan-400 hover:bg-cyan-50/50 text-slate-400 hover:text-cyan-600 transition-all text-sm font-medium"
              >
                <Plus size={16} />
                Agregar paso
              </button>
            </div>
          )}
        </div>

        {/* Right: Phone Preview */}
        {showPreview && (
          <div className="w-[320px] flex-shrink-0 sticky top-24 self-start">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">Vista previa</p>
            <PhonePreview steps={steps} flowName={flowName || 'Mi Bot'} />
          </div>
        )}
      </div>
    </div>
  )
}
