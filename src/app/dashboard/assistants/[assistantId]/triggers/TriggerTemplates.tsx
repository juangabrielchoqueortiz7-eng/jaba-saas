'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Zap, Clock, Calendar, Bell, Users, Workflow, Star, ChevronRight, Plus } from 'lucide-react'

// ── Types (mirrors TriggerBuilder) ───────────────────────────────────────────

export interface TemplateCondition {
  condition_type: string
  operator: string
  value: string
  payload?: Record<string, unknown>
}

export interface TemplateAction {
  type: string
  payload: Record<string, unknown>
  delay_seconds?: number
}

export interface TriggerTemplate {
  id: string
  name: string
  description: string
  badge: string
  badgeColor: string
  icon: ReactNode
  type: 'logic' | 'time' | 'scheduled' | 'flow'
  timeMinutes?: string
  conditionsLogic?: 'AND' | 'OR'
  conditions: TemplateCondition[]
  actions: TemplateAction[]
  scheduleConfig?: {
    send_days: 'expiration' | '1_day_before' | '3_days_before' | '7_days_before' | 'daily'
    audience_type: 'service' | 'tag' | 'all'
    audience_value: string
  }
}

// ── Template Definitions ───────────────────────────────────────────────────

const TEMPLATES: TriggerTemplate[] = [
  {
    id: 'price_inquiry',
    name: 'Respuesta automática a consulta de precio',
    description: 'Cuando un cliente escribe "precio", "cuánto cuesta" o "tarifa", responde automáticamente con tu catálogo.',
    badge: 'Más usado',
    badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: <Zap size={20} className="text-yellow-500" />,
    type: 'logic',
    conditionsLogic: 'OR',
    conditions: [
      { condition_type: 'text_contains', operator: 'contains', value: 'precio', payload: { words: 'precio,cuánto,costo,tarifa,vale' } },
    ],
    actions: [
      {
        type: 'send_text',
        payload: {
          message: '¡Hola {{contact.name}}! 😊 Aquí tienes nuestra lista de precios y servicios. ¿Te interesa alguno en particular?',
        },
      },
    ],
  },
  {
    id: 'inactivity_reminder',
    name: 'Recordatorio de inactividad',
    description: 'Si un cliente no ha respondido en 60 minutos, envía un recordatorio amigable para retomar la conversación.',
    badge: 'Recomendado',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <Clock size={20} className="text-blue-500" />,
    type: 'time',
    timeMinutes: '60',
    conditions: [],
    actions: [
      {
        type: 'send_text',
        payload: {
          message: '¡Hola {{contact.name}}! 👋 Vi que quedamos a medias. ¿Puedo ayudarte en algo más?',
        },
      },
    ],
  },
  {
    id: 'welcome_first_message',
    name: 'Bienvenida al primer mensaje',
    description: 'Detecta cuando es el primer mensaje de un contacto nuevo y envía un saludo personalizado.',
    badge: 'Popular',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <Users size={20} className="text-emerald-500" />,
    type: 'logic',
    conditionsLogic: 'AND',
    conditions: [
      { condition_type: 'message_count', operator: 'equals', value: '1', payload: { count: 1 } },
    ],
    actions: [
      {
        type: 'send_text',
        payload: {
          message: '¡Bienvenido/a {{contact.name}}! 🎉 Soy el asistente virtual. Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?',
        },
      },
      {
        type: 'add_tag',
        payload: { tag: 'nuevo-contacto' },
        delay_seconds: 2,
      },
    ],
  },
  {
    id: 'expiration_3days',
    name: 'Aviso de vencimiento en 3 días',
    description: 'Envía un mensaje automático a todos los clientes cuya suscripción vence en 3 días para recordarles renovar.',
    badge: 'Suscripciones',
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: <Calendar size={20} className="text-indigo-500" />,
    type: 'scheduled',
    conditions: [],
    actions: [
      {
        type: 'send_text',
        payload: {
          message: 'Hola {{contact.name}} 👋 Tu suscripción vence el {{subscription.expires_at}}. Para renovar y no perder el acceso, contáctanos hoy mismo.',
        },
      },
    ],
    scheduleConfig: { send_days: '3_days_before', audience_type: 'all', audience_value: '' },
  },
  {
    id: 'human_escalation',
    name: 'Escalar a agente humano',
    description: 'Cuando el cliente pide hablar con una persona, cambia el estado del chat y notifica al administrador.',
    badge: 'Soporte',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: <Bell size={20} className="text-orange-500" />,
    type: 'logic',
    conditionsLogic: 'OR',
    conditions: [
      { condition_type: 'text_contains', operator: 'contains', value: 'hablar con humano', payload: { words: 'hablar con humano,persona real,agente,operador,humano' } },
    ],
    actions: [
      {
        type: 'send_text',
        payload: {
          message: 'Entendido {{contact.name}} 🙏 Te voy a conectar con un agente ahora mismo. Por favor espera un momento.',
        },
      },
      {
        type: 'set_status',
        payload: { status: 'pendiente' },
        delay_seconds: 1,
      },
      {
        type: 'notify_admin',
        payload: {
          message: '🚨 {{contact.name}} ({{contact.phone}}) solicita hablar con un humano.',
          channel: 'whatsapp',
        },
        delay_seconds: 1,
      },
    ],
  },
  {
    id: 'vip_tag',
    name: 'Etiqueta VIP por fidelidad',
    description: 'Detecta clientes activos que han enviado más de 15 mensajes y les asigna automáticamente la etiqueta VIP.',
    badge: 'Fidelización',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: <Star size={20} className="text-purple-500" />,
    type: 'logic',
    conditionsLogic: 'AND',
    conditions: [
      { condition_type: 'message_count', operator: 'greater_equal', value: '15', payload: { count: 15 } },
      { condition_type: 'not_tag', operator: 'equals', value: 'VIP', payload: { tag: 'VIP' } },
    ],
    actions: [
      {
        type: 'add_tag',
        payload: { tag: 'VIP' },
      },
      {
        type: 'send_text',
        payload: {
          message: '¡{{contact.name}}, eres un cliente especial para nosotros! ⭐ Te hemos asignado el estado VIP con beneficios exclusivos.',
        },
        delay_seconds: 3,
      },
    ],
  },
  {
    id: 'expiration_day',
    name: 'Urgencia el día de vencimiento',
    description: 'El día en que vence una suscripción, envía un mensaje de urgencia para motivar la renovación inmediata.',
    badge: 'Urgente',
    badgeColor: 'bg-red-100 text-red-700 border-red-200',
    icon: <Bell size={20} className="text-red-500" />,
    type: 'scheduled',
    conditions: [],
    actions: [
      {
        type: 'send_text',
        payload: {
          message: '⚠️ {{contact.name}}, tu suscripción vence HOY. Para no perder el acceso, renueva ahora mismo. ¡Estamos aquí para ayudarte!',
        },
      },
    ],
    scheduleConfig: { send_days: 'expiration', audience_type: 'all', audience_value: '' },
  },
  {
    id: 'keyword_flow',
    name: 'Menú interactivo por palabra clave',
    description: 'Cuando un cliente escribe "menu", "inicio" o "hola", muestra un menú de opciones para guiar la conversación.',
    badge: 'Interactivo',
    badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
    icon: <Workflow size={20} className="text-teal-500" />,
    type: 'logic',
    conditionsLogic: 'OR',
    conditions: [
      { condition_type: 'text_contains', operator: 'contains', value: 'menu', payload: { words: 'menu,menú,inicio,hola,empezar,start' } },
    ],
    actions: [
      {
        type: 'send_interactive',
        payload: {
          header: 'Menú Principal',
          body: '¡Hola {{contact.name}}! ¿En qué puedo ayudarte hoy?',
          buttons: [
            { id: 'precios', title: '💰 Ver Precios' },
            { id: 'soporte', title: '🛟 Soporte' },
            { id: 'info', title: 'ℹ️ Más Info' },
          ],
        },
      },
    ],
  },
]

// ── Component ──────────────────────────────────────────────────────────────

interface TriggerTemplatesProps {
  onSelectTemplate: (template: TriggerTemplate) => void
  onStartBlank: () => void
}

export default function TriggerTemplates({ onSelectTemplate, onStartBlank }: TriggerTemplatesProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="p-8 max-w-7xl mx-auto text-slate-700">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Nuevo Disparador</h1>
        <p className="text-[rgba(15,23,42,0.45)]">
          Elige una plantilla lista para usar, o crea una desde cero.
        </p>
      </div>

      {/* Start from scratch */}
      <button
        onClick={onStartBlank}
        className="w-full mb-6 flex items-center gap-4 p-4 rounded-[14px] border-2 border-dashed border-black/[0.12] bg-white hover:border-[#eab308]/60 hover:bg-[#fefce8]/50 transition-all group text-left"
      >
        <div className="h-10 w-10 rounded-full bg-[#F7F8FA] border border-black/[0.07] flex items-center justify-center group-hover:bg-[#eab308]/10 transition-colors flex-shrink-0">
          <Plus size={20} className="text-slate-400 group-hover:text-[#ca8a04]" />
        </div>
        <div>
          <p className="font-semibold text-[#0F172A] text-sm">Empezar desde cero</p>
          <p className="text-xs text-slate-400">Configura cada detalle manualmente</p>
        </div>
        <ChevronRight size={18} className="ml-auto text-slate-300 group-hover:text-[#ca8a04] transition-colors" />
      </button>

      {/* Templates */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[#0F172A]/50 uppercase tracking-wider mb-4">
          Plantillas predefinidas — Editables después
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
          {TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              onMouseEnter={() => setHovered(template.id)}
              onMouseLeave={() => setHovered(null)}
              className={`text-left p-5 rounded-[14px] border transition-all group ${
                hovered === template.id
                  ? 'border-[#eab308]/50 bg-[#fefce8]/60 shadow-sm scale-[1.01]'
                  : 'border-black/[0.07] bg-white hover:border-[#eab308]/30 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-[#F7F8FA] border border-black/[0.06] flex items-center justify-center flex-shrink-0">
                  {template.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${template.badgeColor}`}>
                      {template.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">{template.type}</span>
                  </div>
                  <p className="font-semibold text-sm text-[#0F172A] leading-tight">{template.name}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{template.description}</p>

              {/* Stats */}
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  {template.conditions.length} {template.conditions.length === 1 ? 'condición' : 'condiciones'}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {template.actions.length} {template.actions.length === 1 ? 'acción' : 'acciones'}
                </span>
                {template.conditionsLogic && template.conditions.length > 1 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                    Lógica {template.conditionsLogic}
                  </span>
                )}
              </div>

              <div className={`mt-3 flex items-center gap-1 text-xs font-medium transition-colors ${
                hovered === template.id ? 'text-[#ca8a04]' : 'text-slate-300'
              }`}>
                Usar esta plantilla
                <ArrowRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
