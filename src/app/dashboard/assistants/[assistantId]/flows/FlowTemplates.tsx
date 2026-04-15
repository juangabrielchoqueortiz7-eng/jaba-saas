'use client'

import { useState, useTransition } from 'react'
import {
  ChevronRight, MessageSquare, HelpCircle, ShoppingCart,
  UserPlus, ClipboardList, Clock, Star, Bell, Loader2, Wand2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createFlowFromTemplate } from './actions'

// ── Template Types ─────────────────────────────────────────────────────────

interface TemplateNode {
  type: string
  label: string
  position_x: number
  position_y: number
  config: Record<string, unknown>
}

interface TemplateEdge {
  sourceIndex: number
  targetIndex: number
  source_handle: string
  label: string
}

interface FlowTemplate {
  id: string
  name: string
  description: string
  badge: string
  badgeColor: string
  icon: React.ReactNode
  nodeCount: number
  nodes: TemplateNode[]
  edges: TemplateEdge[]
}

// ── Template Definitions ───────────────────────────────────────────────────

const TEMPLATES: FlowTemplate[] = [
  {
    id: 'welcome_menu',
    name: 'Bienvenida y Menu',
    description: 'Saluda al cliente y muestra un menu de 3 opciones con botones interactivos.',
    badge: 'Mas usado',
    badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: <MessageSquare size={20} className="text-blue-500" />,
    nodeCount: 4,
    nodes: [
      { type: 'trigger', label: 'Inicio', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['hola', 'buenas', 'inicio', 'menu', 'hi'], match_mode: 'contains' } },
      { type: 'message', label: 'Bienvenida', position_x: 400, position_y: 150, config: { text: 'Hola {{contact_name}}! Bienvenido/a. Estoy aqui para ayudarte. Elige una opcion:' } },
      { type: 'buttons', label: 'Menu principal', position_x: 400, position_y: 300, config: { text: 'Que te gustaria hacer hoy?', buttons: [{ id: 'btn_info', title: 'Informacion' }, { id: 'btn_precios', title: 'Ver Precios' }, { id: 'btn_soporte', title: 'Soporte' }] } },
      { type: 'wait_input', label: 'Esperar eleccion', position_x: 400, position_y: 450, config: { variable_name: 'menu_eleccion' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
    ],
  },
  {
    id: 'faq',
    name: 'FAQ Automatizado',
    description: 'Lista de preguntas frecuentes con respuestas automaticas segun la opcion elegida.',
    badge: 'Popular',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <HelpCircle size={20} className="text-emerald-500" />,
    nodeCount: 7,
    nodes: [
      { type: 'trigger', label: 'FAQ Trigger', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['faq', 'preguntas', 'dudas', 'ayuda'], match_mode: 'contains' } },
      { type: 'list', label: 'Lista de preguntas', position_x: 400, position_y: 150, config: { body: 'Estas son las preguntas mas frecuentes. Elige la que necesites:', button_text: 'Ver preguntas', rows: [{ id: 'faq_1', title: 'Horarios de atencion', description: 'Cuando estamos disponibles' }, { id: 'faq_2', title: 'Metodos de pago', description: 'Como puedes pagar' }, { id: 'faq_3', title: 'Tiempos de entrega', description: 'Cuanto tarda tu pedido' }] } },
      { type: 'wait_input', label: 'Esperar seleccion', position_x: 400, position_y: 300, config: { variable_name: 'faq_seleccion' } },
      { type: 'condition', label: 'Es horarios?', position_x: 400, position_y: 450, config: { condition_type: 'interactive_id', value: 'faq_1' } },
      { type: 'message', label: 'Resp. Horarios', position_x: 150, position_y: 600, config: { text: 'Nuestro horario de atencion es:\nLunes a Viernes: 9:00 AM - 6:00 PM\nSabados: 9:00 AM - 1:00 PM\nDomingos: Cerrado\n\nSi necesitas algo mas, escribe "menu".' } },
      { type: 'condition', label: 'Es pagos?', position_x: 650, position_y: 600, config: { condition_type: 'interactive_id', value: 'faq_2' } },
      { type: 'message', label: 'Resp. Pagos', position_x: 650, position_y: 750, config: { text: 'Aceptamos los siguientes metodos de pago:\n- Transferencia bancaria\n- QR (cualquier banco)\n- Tigo Money\n- Efectivo\n\nEscribe "menu" para volver al inicio.' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
      { sourceIndex: 3, targetIndex: 4, source_handle: 'true', label: 'Horarios' },
      { sourceIndex: 3, targetIndex: 5, source_handle: 'false', label: 'Otros' },
      { sourceIndex: 5, targetIndex: 6, source_handle: 'true', label: 'Pagos' },
    ],
  },
  {
    id: 'sales_ai',
    name: 'Ventas con IA',
    description: 'Presenta tus servicios y deja que la IA cierre la venta con informacion personalizada.',
    badge: 'Recomendado',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <ShoppingCart size={20} className="text-blue-500" />,
    nodeCount: 5,
    nodes: [
      { type: 'trigger', label: 'Interes en comprar', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['precio', 'cuanto', 'comprar', 'catalogo', 'servicios', 'cotizacion'], match_mode: 'contains' } },
      { type: 'message', label: 'Intro servicios', position_x: 400, position_y: 150, config: { text: 'Hola {{contact_name}}! Gracias por tu interes. Te cuento lo que tenemos disponible:' } },
      { type: 'buttons', label: 'Opciones', position_x: 400, position_y: 300, config: { text: 'Que tipo de servicio buscas?', buttons: [{ id: 'srv_digital', title: 'Servicio Digital' }, { id: 'srv_fisico', title: 'Producto Fisico' }, { id: 'srv_otro', title: 'Consultar otro' }] } },
      { type: 'wait_input', label: 'Eleccion del cliente', position_x: 400, position_y: 450, config: { variable_name: 'tipo_servicio' } },
      { type: 'ai_response', label: 'IA cierra venta', position_x: 400, position_y: 600, config: { system_prompt: 'El cliente esta interesado en comprar. Presenta los productos/servicios disponibles, da precios claros y guia al cliente hacia la compra. Se amable y profesional.' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
      { sourceIndex: 3, targetIndex: 4, source_handle: 'default', label: '' },
    ],
  },
  {
    id: 'lead_capture',
    name: 'Captura de Leads',
    description: 'Recoge nombre, email e interes del cliente automaticamente y lo etiqueta en el CRM.',
    badge: 'Marketing',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: <UserPlus size={20} className="text-purple-500" />,
    nodeCount: 8,
    nodes: [
      { type: 'trigger', label: 'Lead trigger', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['informacion', 'interesado', 'quiero saber', 'contacto'], match_mode: 'contains' } },
      { type: 'message', label: 'Saludo lead', position_x: 400, position_y: 150, config: { text: 'Genial que te interese! Para darte la mejor atencion, necesito unos datos rapidos (30 segundos):' } },
      { type: 'message', label: 'Pedir nombre', position_x: 400, position_y: 300, config: { text: 'Primero, cual es tu nombre completo?' } },
      { type: 'wait_input', label: 'Capturar nombre', position_x: 400, position_y: 450, config: { variable_name: 'lead_nombre' } },
      { type: 'message', label: 'Pedir email', position_x: 400, position_y: 600, config: { text: 'Perfecto {{lead_nombre}}! Ahora, cual es tu correo electronico?' } },
      { type: 'wait_input', label: 'Capturar email', position_x: 400, position_y: 750, config: { variable_name: 'lead_email' } },
      { type: 'action', label: 'Etiquetar lead', position_x: 400, position_y: 900, config: { action_type: 'add_tag', tag: 'lead-nuevo' } },
      { type: 'message', label: 'Confirmacion', position_x: 400, position_y: 1050, config: { text: 'Listo {{lead_nombre}}! Ya tenemos tus datos. Te contactaremos pronto al correo {{lead_email}}. Mientras, puedo ayudarte con algo mas?' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
      { sourceIndex: 3, targetIndex: 4, source_handle: 'default', label: '' },
      { sourceIndex: 4, targetIndex: 5, source_handle: 'default', label: '' },
      { sourceIndex: 5, targetIndex: 6, source_handle: 'default', label: '' },
      { sourceIndex: 6, targetIndex: 7, source_handle: 'default', label: '' },
    ],
  },
  {
    id: 'support_escalation',
    name: 'Soporte con Escalacion',
    description: 'Resuelve problemas comunes automaticamente o escala a un agente humano.',
    badge: 'Soporte',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: <ClipboardList size={20} className="text-orange-500" />,
    nodeCount: 6,
    nodes: [
      { type: 'trigger', label: 'Soporte trigger', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['soporte', 'problema', 'ayuda', 'no funciona', 'error', 'reclamo'], match_mode: 'contains' } },
      { type: 'buttons', label: 'Tipo de problema', position_x: 400, position_y: 150, config: { text: 'Lamento que tengas un problema. Para ayudarte mejor, selecciona:', buttons: [{ id: 'sup_tecnico', title: 'Problema tecnico' }, { id: 'sup_pago', title: 'Problema de pago' }, { id: 'sup_humano', title: 'Hablar con agente' }] } },
      { type: 'wait_input', label: 'Esperar tipo', position_x: 400, position_y: 300, config: { variable_name: 'tipo_soporte' } },
      { type: 'condition', label: 'Quiere agente?', position_x: 400, position_y: 450, config: { condition_type: 'interactive_id', value: 'sup_humano' } },
      { type: 'message', label: 'Escalar', position_x: 150, position_y: 600, config: { text: 'Entendido! Te voy a conectar con un agente humano. Por favor espera un momento, te atenderan pronto.' } },
      { type: 'ai_response', label: 'IA resuelve', position_x: 650, position_y: 600, config: { system_prompt: 'El cliente tiene un problema tecnico o de pago. Intenta resolverlo amablemente. Si no puedes, sugiere hablar con un agente escribiendo "agente".' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
      { sourceIndex: 3, targetIndex: 4, source_handle: 'true', label: 'Agente' },
      { sourceIndex: 3, targetIndex: 5, source_handle: 'false', label: 'Auto' },
    ],
  },
  {
    id: 'schedule_location',
    name: 'Horario y Ubicacion',
    description: 'Muestra automaticamente el horario de atencion y la ubicacion de tu negocio.',
    badge: 'Simple',
    badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <Clock size={20} className="text-slate-500" />,
    nodeCount: 3,
    nodes: [
      { type: 'trigger', label: 'Horario trigger', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['horario', 'hora', 'abierto', 'ubicacion', 'donde', 'direccion'], match_mode: 'contains' } },
      { type: 'message', label: 'Horario', position_x: 400, position_y: 150, config: { text: 'Nuestros horarios de atencion:\n\nLunes a Viernes: 9:00 - 18:00\nSabados: 9:00 - 13:00\nDomingos: Cerrado\n\nFeriados: Consultar' } },
      { type: 'message', label: 'Ubicacion', position_x: 400, position_y: 300, config: { text: 'Nos encontramos en:\n[Tu direccion aqui]\n\nReferencia: [Tu referencia aqui]\n\nTe esperamos!' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
    ],
  },
  {
    id: 'satisfaction_survey',
    name: 'Encuesta de Satisfaccion',
    description: 'Recoge la calificacion y comentarios del cliente despues de una compra o servicio.',
    badge: 'Fidelizacion',
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: <Star size={20} className="text-indigo-500" />,
    nodeCount: 6,
    nodes: [
      { type: 'trigger', label: 'Encuesta trigger', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['encuesta', 'calificar', 'opinion', 'feedback'], match_mode: 'contains' } },
      { type: 'message', label: 'Intro encuesta', position_x: 400, position_y: 150, config: { text: 'Hola {{contact_name}}! Nos gustaria saber tu opinion sobre nuestro servicio. Solo toma 1 minuto.' } },
      { type: 'buttons', label: 'Calificacion', position_x: 400, position_y: 300, config: { text: 'Del 1 al 5, como calificarias tu experiencia?', buttons: [{ id: 'rate_5', title: '5 - Excelente' }, { id: 'rate_3', title: '3 - Regular' }, { id: 'rate_1', title: '1 - Malo' }] } },
      { type: 'wait_input', label: 'Capturar rating', position_x: 400, position_y: 450, config: { variable_name: 'calificacion' } },
      { type: 'message', label: 'Pedir comentario', position_x: 400, position_y: 600, config: { text: 'Gracias! Tienes algun comentario adicional? (escribe "no" si prefieres no comentar)' } },
      { type: 'wait_input', label: 'Capturar comentario', position_x: 400, position_y: 750, config: { variable_name: 'comentario' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
      { sourceIndex: 3, targetIndex: 4, source_handle: 'default', label: '' },
      { sourceIndex: 4, targetIndex: 5, source_handle: 'default', label: '' },
    ],
  },
  {
    id: 'renewal_reminder',
    name: 'Recordatorio de Renovacion',
    description: 'Avisa al cliente que su suscripcion esta por vencer y facilita la renovacion.',
    badge: 'Suscripciones',
    badgeColor: 'bg-red-100 text-red-700 border-red-200',
    icon: <Bell size={20} className="text-red-500" />,
    nodeCount: 6,
    nodes: [
      { type: 'trigger', label: 'Renovar trigger', position_x: 400, position_y: 0, config: { trigger_type: 'keyword', keywords: ['renovar', 'renovacion', 'vence', 'vencimiento', 'extender'], match_mode: 'contains' } },
      { type: 'message', label: 'Aviso renovacion', position_x: 400, position_y: 150, config: { text: 'Hola {{contact_name}}! Tu suscripcion esta proxima a vencer. Para no perder el acceso, te recomendamos renovar ahora.' } },
      { type: 'buttons', label: 'Opciones renovacion', position_x: 400, position_y: 300, config: { text: 'Que te gustaria hacer?', buttons: [{ id: 'renew_now', title: 'Renovar ahora' }, { id: 'renew_info', title: 'Ver planes' }, { id: 'renew_later', title: 'Despues' }] } },
      { type: 'wait_input', label: 'Esperar decision', position_x: 400, position_y: 450, config: { variable_name: 'decision_renovacion' } },
      { type: 'condition', label: 'Quiere renovar?', position_x: 400, position_y: 600, config: { condition_type: 'interactive_id', value: 'renew_now' } },
      { type: 'ai_response', label: 'IA gestiona', position_x: 400, position_y: 750, config: { system_prompt: 'El cliente quiere renovar su suscripcion. Guialo por el proceso de pago, muestra los planes disponibles con precios y facilita la renovacion. Si eligio "despues", agradece y recuerdale que puede escribir cuando quiera.' } },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, source_handle: 'default', label: '' },
      { sourceIndex: 1, targetIndex: 2, source_handle: 'default', label: '' },
      { sourceIndex: 2, targetIndex: 3, source_handle: 'default', label: '' },
      { sourceIndex: 3, targetIndex: 4, source_handle: 'default', label: '' },
      { sourceIndex: 4, targetIndex: 5, source_handle: 'true', label: '' },
      { sourceIndex: 4, targetIndex: 5, source_handle: 'false', label: '' },
    ],
  },
]

// ── Component ──────────────────────────────────────────────────────────────

interface FlowTemplatesProps {
  assistantId: string
  onStartBlank: () => void
  onClose: () => void
}

export default function FlowTemplates({ assistantId, onStartBlank, onClose }: FlowTemplatesProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const handleSelectTemplate = (template: FlowTemplate) => {
    setLoadingId(template.id)
    startTransition(async () => {
      try {
        const flowId = await createFlowFromTemplate(
          template.name,
          template.description,
          template.nodes,
          template.edges,
        )
        if (flowId) {
          router.push(`/dashboard/assistants/${assistantId}/flows/${flowId}`)
        }
      } catch (error) {
        console.error(error)
        alert('Error al crear el flujo')
      } finally {
        setLoadingId(null)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-black/[0.08]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.07]">
          <div>
            <h2 className="font-bold text-[#0F172A] text-lg">Nuevo Flujo Conversacional</h2>
            <p className="text-xs text-slate-400 mt-1">Elige una plantilla o empieza desde cero</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F7F8FA] text-slate-400 hover:text-slate-600 transition-colors text-lg">
            x
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Start from scratch */}
          <button
            onClick={onStartBlank}
            className="w-full flex items-center gap-4 p-4 rounded-[14px] border-2 border-dashed border-black/[0.12] bg-white hover:border-cyan-400/60 hover:bg-cyan-50/30 transition-all group text-left"
          >
            <div className="h-10 w-10 rounded-full bg-[#F7F8FA] border border-black/[0.07] flex items-center justify-center group-hover:bg-cyan-100/50 transition-colors flex-shrink-0">
              <Wand2 size={20} className="text-slate-400 group-hover:text-cyan-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#0F172A] text-sm">Modo Guiado - Empezar desde cero</p>
              <p className="text-xs text-slate-400">Crea tu flujo paso a paso de forma visual y sencilla</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-cyan-500 transition-colors" />
          </button>

          {/* Templates label */}
          <h3 className="text-[11px] font-semibold text-[#0F172A]/40 uppercase tracking-wider pt-2">
            Plantillas predefinidas - Editables despues de crear
          </h3>

          {/* Templates grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                onMouseEnter={() => setHovered(template.id)}
                onMouseLeave={() => setHovered(null)}
                disabled={isPending}
                className={`text-left p-4 rounded-[14px] border transition-all group disabled:opacity-60 ${
                  hovered === template.id
                    ? 'border-cyan-400/50 bg-cyan-50/30 shadow-sm'
                    : 'border-black/[0.07] bg-white hover:border-cyan-300/30'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="h-9 w-9 rounded-lg bg-[#F7F8FA] border border-black/[0.06] flex items-center justify-center flex-shrink-0">
                    {loadingId === template.id ? <Loader2 size={18} className="animate-spin text-cyan-500" /> : template.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${template.badgeColor}`}>
                        {template.badge}
                      </span>
                      <span className="text-[10px] text-slate-300">{template.nodeCount} pasos</span>
                    </div>
                    <p className="font-semibold text-sm text-[#0F172A] leading-tight">{template.name}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{template.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
