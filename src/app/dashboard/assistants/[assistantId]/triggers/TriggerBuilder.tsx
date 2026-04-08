'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus, Save, ArrowLeft, Trash2, Filter, AlertCircle, Calendar,
  Users, Clock, ChevronDown, ChevronUp, Zap, MessageSquare,
  Tag, Globe, Webhook, Pause, Play, Bot, RefreshCw, Info,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { saveTrigger, getTrigger } from './actions'
import { getFlows, type ConversationFlow } from '../flows/actions'
import { AVAILABLE_VARIABLES } from '@/lib/trigger-variables'
import type { TriggerTemplate } from './TriggerTemplates'

// ── Types ──────────────────────────────────────────────────────────────────────

type TriggerType = 'logic' | 'time' | 'flow' | 'scheduled'

type ConditionType =
  | 'text_contains' | 'text_regex' | 'text_matches_intent'
  | 'last_message_time' | 'message_count' | 'message_rate'
  | 'has_tag' | 'not_tag' | 'chat_status' | 'custom_field' | 'creation_date'
  | 'day_of_week' | 'hour_range'
  | 'expiration_days' | 'subscription_status'

type ActionType =
  | 'send_text' | 'send_text_ai' | 'send_media' | 'send_template' | 'send_interactive'
  | 'add_tag' | 'remove_tag' | 'set_status' | 'update_field'
  | 'notify_admin' | 'notify_webhook'
  | 'start_flow' | 'pause'

type ConditionOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'greater_than' | 'greater_equal' | 'less_than' | 'less_equal'
  | 'starts_with' | 'ends_with'

interface TriggerCondition {
  id?: string
  condition_type: ConditionType
  operator: ConditionOperator
  value: string
  payload?: Record<string, any>
}

interface TriggerAction {
  id?: string
  type: ActionType
  payload: Record<string, any>
  action_order?: number
  delay_seconds?: number
}

interface ScheduleConfig {
  send_days: 'expiration' | '1_day_before' | '3_days_before' | '7_days_before' | 'daily'
  audience_type: 'service' | 'tag' | 'all'
  audience_value: string
}

interface MetaTemplate {
  id: string
  name: string
  status: string
  language: string
  components: Array<{ type: string; text?: string; format?: string }>
}

interface TriggerBuilderProps {
  assistantId: string
  triggerId?: string
  initialTemplate?: TriggerTemplate
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CONDITION_CATEGORIES = [
  {
    label: '💬 Cuando el cliente escribe...',
    items: [
      { value: 'text_contains', label: 'El mensaje contiene ciertas palabras' },
      { value: 'text_matches_intent', label: 'La IA detecta una intención (pregunta, queja, etc.)' },
      { value: 'text_regex', label: '⚙️ Avanzado: patrón de texto (regex)' },
    ]
  },
  {
    label: '👤 Según el estado del cliente...',
    items: [
      { value: 'last_message_time', label: 'Minutos sin responder' },
      { value: 'message_count', label: 'Cantidad de mensajes enviados' },
      { value: 'has_tag', label: 'El cliente tiene una etiqueta' },
      { value: 'not_tag', label: 'El cliente NO tiene una etiqueta' },
      { value: 'chat_status', label: 'Tipo de cliente (lead, cliente, VIP...)' },
      { value: 'creation_date', label: 'Días desde que se registró' },
      { value: 'message_rate', label: 'Frecuencia de mensajes (por hora)' },
      { value: 'custom_field', label: '⚙️ Avanzado: campo personalizado' },
    ]
  },
  {
    label: '🕐 Según el día u hora...',
    items: [
      { value: 'day_of_week', label: 'Solo ciertos días de la semana' },
      { value: 'hour_range', label: 'Solo en cierto horario' },
    ]
  },
  {
    label: '💳 Según la suscripción...',
    items: [
      { value: 'expiration_days', label: 'Días que faltan para que venza' },
      { value: 'subscription_status', label: 'Estado de la suscripción (activo, vencido...)' },
    ]
  },
]

const ACTION_CATEGORIES = [
  {
    label: '💬 Enviar un mensaje al cliente',
    items: [
      { value: 'send_text', label: 'Enviar un texto' },
      { value: 'send_text_ai', label: 'Que la IA responda automáticamente' },
      { value: 'send_media', label: 'Enviar imagen, video o archivo' },
      { value: 'send_template', label: 'Enviar plantilla de WhatsApp aprobada' },
      { value: 'send_interactive', label: 'Enviar botones o menú de opciones' },
    ]
  },
  {
    label: '🏷️ Organizar al cliente',
    items: [
      { value: 'add_tag', label: 'Ponerle una etiqueta' },
      { value: 'remove_tag', label: 'Quitarle una etiqueta' },
      { value: 'set_status', label: 'Cambiar su tipo (lead, cliente, VIP...)' },
      { value: 'update_field', label: '⚙️ Avanzado: actualizar campo personalizado' },
    ]
  },
  {
    label: '🔔 Avisarte a ti o a otro sistema',
    items: [
      { value: 'notify_admin', label: 'Enviarte una notificación' },
      { value: 'notify_webhook', label: 'Enviar datos a otra app (Zapier, Slack, CRM...)' },
    ]
  },
  {
    label: '⚙️ Control del bot',
    items: [
      { value: 'start_flow', label: 'Iniciar una conversación guiada (flujo)' },
      { value: 'pause', label: 'Esperar unos segundos antes del siguiente paso' },
    ]
  },
]

const OPERATORS_NUMERIC: { value: string; label: string }[] = [
  { value: 'greater_than', label: 'Más de' },
  { value: 'greater_equal', label: 'Más de o igual a' },
  { value: 'less_than', label: 'Menos de' },
  { value: 'less_equal', label: 'Menos de o igual a' },
  { value: 'equals', label: 'Exactamente' },
]

const OPERATORS_TEXT: { value: string; label: string }[] = [
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
  { value: 'equals', label: 'Es igual a' },
  { value: 'not_equals', label: 'No es igual a' },
  { value: 'starts_with', label: 'Empieza con' },
  { value: 'ends_with', label: 'Termina con' },
]

const CONDITION_LABELS: Record<ConditionType, string> = {
  text_contains: 'Mensaje contiene...',
  text_regex: 'Patrón avanzado (regex)',
  text_matches_intent: 'Intención del cliente (IA)',
  last_message_time: 'Minutos sin responder',
  message_count: 'Cantidad de mensajes',
  message_rate: 'Frecuencia de mensajes',
  has_tag: 'Tiene la etiqueta...',
  not_tag: 'NO tiene la etiqueta...',
  chat_status: 'Tipo de cliente',
  custom_field: 'Campo personalizado',
  creation_date: 'Días desde registro',
  day_of_week: 'Día de la semana',
  hour_range: 'Horario permitido',
  expiration_days: 'Días para vencer',
  subscription_status: 'Estado de suscripción',
}

const ACTION_LABELS: Record<ActionType, string> = {
  send_text: 'Enviar un texto',
  send_text_ai: 'Respuesta automática con IA',
  send_media: 'Enviar imagen/archivo',
  send_template: 'Plantilla de WhatsApp',
  send_interactive: 'Botones / menú de opciones',
  add_tag: 'Ponerle etiqueta',
  remove_tag: 'Quitarle etiqueta',
  set_status: 'Cambiar tipo de cliente',
  update_field: 'Actualizar campo',
  notify_admin: 'Notificarte',
  notify_webhook: 'Enviar a otra app',
  start_flow: 'Iniciar conversación guiada',
  pause: 'Esperar antes del siguiente paso',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectTemplateVars(components: MetaTemplate['components']): number {
  const body = components.find(c => c.type === 'BODY')
  if (!body?.text) return 0
  const matches = body.text.match(/\{\{(\d+)\}\}/g)
  return matches ? new Set(matches).size : 0
}

// Map legacy condition types to new ones when loading
function normalizeLegacyCondition(cond: any): TriggerCondition {
  const typeMap: Record<string, ConditionType> = {
    has_tag: 'has_tag',
    contains_words: 'text_contains',
    last_message: 'last_message_time',
    message_count: 'message_count',
    template_sent: 'text_contains',
    schedule: 'expiration_days',
  }
  return {
    id: cond.id,
    condition_type: (typeMap[cond.type] || cond.condition_type || cond.type) as ConditionType,
    operator: cond.operator || 'equals',
    value: cond.value || '',
    payload: cond.payload || {},
  }
}

function getDefaultConditionPayload(condType: ConditionType): { operator: ConditionOperator; value: string; payload?: any } {
  const defaults: Partial<Record<ConditionType, { operator: ConditionOperator; value: string; payload?: any }>> = {
    text_contains: { operator: 'contains', value: '' },
    text_regex: { operator: 'equals', value: '', payload: { flags: 'i' } },
    text_matches_intent: { operator: 'equals', value: 'pregunta' },
    last_message_time: { operator: 'greater_than', value: '30' },
    message_count: { operator: 'greater_than', value: '10' },
    message_rate: { operator: 'less_than', value: '1' },
    has_tag: { operator: 'equals', value: '' },
    not_tag: { operator: 'equals', value: '' },
    chat_status: { operator: 'equals', value: 'customer' },
    custom_field: { operator: 'equals', value: '', payload: { field_name: '' } },
    creation_date: { operator: 'greater_equal', value: '7' },
    day_of_week: { operator: 'equals', value: 'monday,tuesday,wednesday,thursday,friday' },
    hour_range: { operator: 'equals', value: '09:00-18:00' },
    expiration_days: { operator: 'less_than', value: '7' },
    subscription_status: { operator: 'equals', value: 'activo' },
  }
  return defaults[condType] || { operator: 'equals', value: '' }
}

function getDefaultActionPayload(actionType: ActionType): Record<string, any> {
  const defaults: Record<ActionType, Record<string, any>> = {
    send_text: { message: '' },
    send_text_ai: { instruction: '', context: '' },
    send_media: { url: '', type: 'image', caption: '' },
    send_template: { template_name: '', language: 'es', variables: [] },
    send_interactive: { body: '', buttons: [{ id: 'btn1', title: '' }] },
    add_tag: { tag: '' },
    remove_tag: { tag: '' },
    set_status: { status: 'customer' },
    update_field: { field_name: '', value: '' },
    notify_admin: { title: 'Alerta del disparador', message: '' },
    notify_webhook: { url: '', method: 'POST' },
    start_flow: { flow_id: '' },
    pause: { seconds: 5 },
  }
  return defaults[actionType] || {}
}

// ── CardPicker Modal ──────────────────────────────────────────────────────────

function CardPickerModal({
  title, categories, onSelect, onClose
}: {
  title: string
  categories: { label: string; items: { value: string; label: string }[] }[]
  onSelect: (value: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-black/[0.08]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-black/[0.06]">
          <h3 className="text-lg font-bold text-[#0F172A]">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-5">
          {categories.map(cat => (
            <div key={cat.label}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{cat.label}</p>
              <div className="grid grid-cols-1 gap-2">
                {cat.items.map(item => (
                  <button
                    key={item.value}
                    onClick={() => { onSelect(item.value); onClose() }}
                    className="text-left p-3 rounded-xl border border-black/[0.06] bg-[#F7F8FA] hover:bg-white hover:border-green-300 hover:shadow-sm transition-all group"
                  >
                    <p className="text-sm font-medium text-[#0F172A] group-hover:text-green-700">{item.label}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── VariablePicker ─────────────────────────────────────────────────────────────

function VariablePicker({ onInsert }: { onInsert: (variable: string) => void }) {
  const [open, setOpen] = useState(false)
  const groups = [
    {
      ns: 'Datos del cliente',
      vars: AVAILABLE_VARIABLES.contact,
    },
    {
      ns: 'Datos de la suscripción',
      vars: AVAILABLE_VARIABLES.subscription,
    },
    {
      ns: 'Fecha y hora',
      vars: AVAILABLE_VARIABLES.date,
    },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[10px] flex items-center gap-1 text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-2.5 py-1 rounded-full transition-colors font-semibold"
      >
        <Zap size={10} />
        + Insertar dato {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 bg-white border border-black/[0.08] rounded-xl shadow-xl p-4 w-80 max-h-72 overflow-y-auto">
          <p className="text-[10px] text-slate-400 mb-3 font-semibold">Haz clic en un dato para agregarlo al mensaje:</p>
          {groups.map(g => (
            <div key={g.ns} className="mb-3">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">{g.ns}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.vars.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    title={`Ejemplo: ${v.example}`}
                    className="flex items-center gap-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full transition-colors font-medium"
                    onClick={() => { onInsert(v.key); setOpen(false) }}
                  >
                    {v.label}
                    <span className="text-[9px] text-indigo-400 font-normal">ej: {v.example}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ConditionEditor ────────────────────────────────────────────────────────────

function ConditionEditor({
  condition, index, onUpdate, onRemove
}: {
  condition: TriggerCondition
  index: number
  onUpdate: (i: number, update: Partial<TriggerCondition>) => void
  onRemove: (i: number) => void
}) {
  const ct = condition.condition_type

  return (
    <Card className="bg-white border-black/[0.08] relative">
      <button
        onClick={() => onRemove(index)}
        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
      >
        <Trash2 size={15} />
      </button>

      <CardContent className="p-4 pt-8 space-y-3">
        {/* Label */}
        <div className="text-xs font-semibold text-red-500 uppercase tracking-wider">
          {CONDITION_LABELS[ct] || ct}
        </div>

        {/* ── text_contains ── */}
        {ct === 'text_contains' && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={condition.operator} onValueChange={v => onUpdate(index, { operator: v as ConditionOperator })}>
              <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS_TEXT.map(op => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs"
              placeholder="Ej: precio, ayuda, error"
              value={condition.value}
              onChange={e => onUpdate(index, { value: e.target.value })}
            />
          </div>
        )}

        {/* ── text_regex ── */}
        {ct === 'text_regex' && (
          <div className="space-y-2">
            <Input
              className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs font-mono"
              placeholder="Expresión regular — ej: \\d{3}-\\d{4}"
              value={condition.value}
              onChange={e => onUpdate(index, { value: e.target.value })}
            />
            <div className="flex gap-2 items-center">
              <Label className="text-xs text-slate-400 whitespace-nowrap">Flags:</Label>
              <Input
                className="h-7 w-24 bg-[#F7F8FA] border-black/[0.08] text-xs font-mono"
                placeholder="i, g, m"
                value={condition.payload?.flags || 'i'}
                onChange={e => onUpdate(index, { payload: { ...condition.payload, flags: e.target.value } })}
              />
              <span className="text-[10px] text-slate-400">i=case insensitive</span>
            </div>
          </div>
        )}

        {/* ── text_matches_intent ── */}
        {ct === 'text_matches_intent' && (
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">¿Qué tipo de mensaje quieres detectar?</Label>
            <Select value={condition.value} onValueChange={v => onUpdate(index, { value: v })}>
              <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pregunta">❓ Pregunta (solicita información)</SelectItem>
                <SelectItem value="queja">😤 Queja o reclamo</SelectItem>
                <SelectItem value="oferta">🛒 Interés en compra / oferta</SelectItem>
                <SelectItem value="otro">💬 Otro</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-amber-500/80 flex items-center gap-1 mt-1">
              <Info size={10} /> La IA analiza cada mensaje para detectar la intención del cliente
            </p>
          </div>
        )}

        {/* ── last_message_time, message_count, message_rate, creation_date, expiration_days ── */}
        {['last_message_time', 'message_count', 'message_rate', 'creation_date', 'expiration_days'].includes(ct) && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={condition.operator} onValueChange={v => onUpdate(index, { operator: v as ConditionOperator })}>
              <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS_NUMERIC.map(op => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs"
                placeholder="Número"
                value={condition.value}
                onChange={e => onUpdate(index, { value: e.target.value })}
              />
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                {ct === 'last_message_time' && 'min'}
                {ct === 'message_count' && 'msg'}
                {ct === 'message_rate' && 'msg/h'}
                {ct === 'creation_date' && 'días'}
                {ct === 'expiration_days' && 'días'}
              </span>
            </div>
          </div>
        )}

        {/* ── has_tag / not_tag ── */}
        {(ct === 'has_tag' || ct === 'not_tag') && (
          <Input
            className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs"
            placeholder="Nombre de la etiqueta — ej: vip, importante"
            value={condition.value}
            onChange={e => onUpdate(index, { value: e.target.value })}
          />
        )}

        {/* ── chat_status ── */}
        {ct === 'chat_status' && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={condition.operator} onValueChange={v => onUpdate(index, { operator: v as ConditionOperator })}>
              <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Es</SelectItem>
                <SelectItem value="not_equals">No es</SelectItem>
              </SelectContent>
            </Select>
            <Select value={condition.value} onValueChange={v => onUpdate(index, { value: v })}>
              <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="customer">Cliente</SelectItem>
                <SelectItem value="closed">Cerrado</SelectItem>
                <SelectItem value="support">Soporte</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── custom_field ── */}
        {ct === 'custom_field' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-slate-400">Nombre del campo</Label>
                <Input
                  className="h-8 bg-[#F7F8FA] border-black/[0.08] text-xs"
                  placeholder="ej: tier, region"
                  value={condition.payload?.field_name || ''}
                  onChange={e => onUpdate(index, { payload: { ...condition.payload, field_name: e.target.value } })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400">Valor esperado</Label>
                <Input
                  className="h-8 bg-[#F7F8FA] border-black/[0.08] text-xs"
                  placeholder="ej: premium"
                  value={condition.value}
                  onChange={e => onUpdate(index, { value: e.target.value })}
                />
              </div>
            </div>
            <Select value={condition.operator} onValueChange={v => onUpdate(index, { operator: v as ConditionOperator })}>
              <SelectTrigger className="h-8 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS_TEXT.map(op => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── day_of_week ── */}
        {ct === 'day_of_week' && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">¿Qué días de la semana? (selecciona uno o más)</Label>
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'monday', label: 'Lun' },
                { key: 'tuesday', label: 'Mar' },
                { key: 'wednesday', label: 'Mié' },
                { key: 'thursday', label: 'Jue' },
                { key: 'friday', label: 'Vie' },
                { key: 'saturday', label: 'Sáb' },
                { key: 'sunday', label: 'Dom' },
              ].map(day => {
                const selected = condition.value.toLowerCase().split(',').map(d => d.trim()).includes(day.key)
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => {
                      const days = condition.value.toLowerCase().split(',').map(d => d.trim()).filter(Boolean)
                      const next = selected ? days.filter(d => d !== day.key) : [...days, day.key]
                      onUpdate(index, { value: next.join(',') })
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-red-500 text-white'
                        : 'bg-[#F7F8FA] text-slate-500 hover:bg-slate-100 border border-black/[0.08]'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── hour_range ── */}
        {ct === 'hour_range' && (
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">¿En qué horario? (ej: 09:00 a 18:00)</Label>
            <Input
              className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs"
              placeholder="09:00-18:00"
              value={condition.value}
              onChange={e => onUpdate(index, { value: e.target.value })}
            />
            <p className="text-[10px] text-slate-400">Ej: 09:00-18:00 = horario laboral</p>
          </div>
        )}

        {/* ── subscription_status ── */}
        {ct === 'subscription_status' && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={condition.operator} onValueChange={v => onUpdate(index, { operator: v as ConditionOperator })}>
              <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Es</SelectItem>
                <SelectItem value="not_equals">No es</SelectItem>
              </SelectContent>
            </Select>
            <Select value={condition.value} onValueChange={v => onUpdate(index, { value: v })}>
              <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── ActionEditor ───────────────────────────────────────────────────────────────

function ActionEditor({
  action, index, flows, metaTemplates, onUpdate, onRemove
}: {
  action: TriggerAction
  index: number
  flows: ConversationFlow[]
  metaTemplates: MetaTemplate[]
  onUpdate: (i: number, update: Partial<TriggerAction>) => void
  onRemove: (i: number) => void
}) {
  const at = action.type

  const updatePayload = (key: string, value: any) => {
    onUpdate(index, { payload: { ...action.payload, [key]: value } })
  }

  const insertVariable = (key: string, field: string) => {
    const current = action.payload[field] || ''
    updatePayload(field, current + key)
  }

  return (
    <div className="bg-white border border-black/[0.08] rounded-xl p-4 relative">
      {/* Delete */}
      <button onClick={() => onRemove(index)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors">
        <Trash2 size={15} />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-semibold">
          Paso {index + 1}
        </span>
        <span className="text-sm font-medium text-green-600">{ACTION_LABELS[at] || at}</span>
      </div>

      {/* ── send_text ── */}
      {at === 'send_text' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-slate-400">Mensaje</Label>
            <VariablePicker onInsert={v => insertVariable(v, 'message')} />
          </div>
          <Textarea
            className="min-h-[80px] text-xs bg-[#F7F8FA] border-black/[0.08] resize-none"
            placeholder="Ej: Hola Juan, tu suscripción vence el 31/12/2025 📅  (usa + Insertar dato para personalizar)"
            value={action.payload.message || ''}
            onChange={e => updatePayload('message', e.target.value)}
          />
        </div>
      )}

      {/* ── send_text_ai ── */}
      {at === 'send_text_ai' && (
        <div className="space-y-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-500 flex gap-1 items-start">
            <Info size={10} className="mt-0.5 shrink-0" />
            La IA leerá el mensaje del cliente y generará una respuesta inteligente según las instrucciones que escribas abajo.
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-slate-400">¿Cómo debe responder la IA? *</Label>
              <VariablePicker onInsert={v => insertVariable(v, 'instruction')} />
            </div>
            <Textarea
              className="min-h-[70px] text-xs bg-[#F7F8FA] border-black/[0.08] resize-none"
              placeholder="Ej: Responde como agente de soporte técnico. Sé cordial y ofrece soluciones al cliente."
              value={action.payload.instruction || ''}
              onChange={e => updatePayload('instruction', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Contexto adicional (opcional)</Label>
            <Input
              className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
              placeholder="Ej: El cliente compró el plan premium hace 3 meses"
              value={action.payload.context || ''}
              onChange={e => updatePayload('context', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── send_media ── */}
      {at === 'send_media' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-slate-400">Tipo de archivo</Label>
              <Select value={action.payload.type || 'image'} onValueChange={v => updatePayload('type', v)}>
                <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">🖼️ Imagen</SelectItem>
                  <SelectItem value="video">🎬 Video</SelectItem>
                  <SelectItem value="document">📎 Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">URL pública *</Label>
              <Input
                className="h-9 text-xs bg-[#F7F8FA] border-black/[0.08] mt-1"
                placeholder="https://..."
                value={action.payload.url || ''}
                onChange={e => updatePayload('url', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-slate-400">Descripción / pie de imagen (opcional)</Label>
              <VariablePicker onInsert={v => insertVariable(v, 'caption')} />
            </div>
            <Input
              className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
              placeholder="Ej: Catálogo actualizado — (usa + Insertar dato para personalizar)"
              value={action.payload.caption || ''}
              onChange={e => updatePayload('caption', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── send_template ── */}
      {at === 'send_template' && (
        <div className="space-y-3">
          {metaTemplates.length === 0 ? (
            <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              No tienes plantillas aprobadas en WhatsApp. Ve a Ajustes, configura tu cuenta de WhatsApp Business, y luego crea una plantilla desde la sección Plantillas.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Plantilla aprobada *</Label>
                <Select
                  value={action.payload.template_name || action.payload.templateName || ''}
                  onValueChange={v => {
                    const tpl = metaTemplates.find(t => t.name === v)
                    const varCount = tpl ? detectTemplateVars(tpl.components) : 0
                    onUpdate(index, {
                      payload: {
                        ...action.payload,
                        template_name: v,
                        templateName: v,
                        language: tpl?.language || 'es',
                        variables: Array(varCount).fill(''),
                      }
                    })
                  }}
                >
                  <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-xs">
                    <SelectValue placeholder="Selecciona una plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {metaTemplates.map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.name}>
                        <span className="font-mono text-xs">{tpl.name}</span>
                        <span className="text-slate-500 text-xs ml-2">{tpl.language}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {action.payload.template_name && (() => {
                const tpl = metaTemplates.find(t => t.name === action.payload.template_name)
                const body = tpl?.components.find(c => c.type === 'BODY')
                if (!body?.text) return null
                return (
                  <div className="p-3 rounded-lg bg-[#F7F8FA] text-xs text-slate-500 font-mono whitespace-pre-wrap">
                    {body.text}
                  </div>
                )
              })()}

              {action.payload.template_name && detectTemplateVars(
                metaTemplates.find(t => t.name === action.payload.template_name)?.components || []
              ) > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Variables</p>
                    <VariablePicker onInsert={v => {
                      const vars = [...(action.payload.variables || [])]
                      // Insert into last focused variable or first empty
                      const emptyIdx = vars.findIndex((x: string) => !x)
                      const targetIdx = emptyIdx >= 0 ? emptyIdx : vars.length - 1
                      vars[targetIdx] = (vars[targetIdx] || '') + v
                      updatePayload('variables', vars)
                    }} />
                  </div>
                  {Array.from({ length: detectTemplateVars(
                    metaTemplates.find(t => t.name === action.payload.template_name)?.components || []
                  ) }).map((_, vi) => (
                    <div key={vi} className="flex items-center gap-2">
                      <span className="text-xs text-indigo-400 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">Variable {vi + 1}</span>
                      <Input
                        className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
                        placeholder={`Ej: Juan García, 31/12/2025...`}
                        value={(action.payload.variables || [])[vi] || ''}
                        onChange={e => {
                          const vars = [...(action.payload.variables || [])]
                          vars[vi] = e.target.value
                          updatePayload('variables', vars)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── send_interactive ── */}
      {at === 'send_interactive' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-slate-400">Cuerpo del mensaje *</Label>
              <VariablePicker onInsert={v => insertVariable(v, 'body')} />
            </div>
            <Textarea
              className="min-h-[60px] text-xs bg-[#F7F8FA] border-black/[0.08] resize-none"
              placeholder="¿En qué podemos ayudarte hoy?"
              value={action.payload.body || ''}
              onChange={e => updatePayload('body', e.target.value)}
            />
          </div>

          {/* Botones */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs text-slate-400">Botones (máx 3)</Label>
              {(action.payload.buttons?.length || 0) < 3 && (
                <button
                  type="button"
                  onClick={() => {
                    const btns = [...(action.payload.buttons || [])]
                    btns.push({ id: `btn${btns.length + 1}`, title: '' })
                    updatePayload('buttons', btns)
                  }}
                  className="text-[10px] text-green-500 hover:text-green-600 flex items-center gap-0.5"
                >
                  <Plus size={10} /> Agregar
                </button>
              )}
            </div>
            {(action.payload.buttons || []).map((btn: any, bi: number) => (
              <div key={bi} className="flex gap-2 items-center">
                <Input
                  className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
                  placeholder={`Texto del botón ${bi + 1}`}
                  value={btn.title}
                  onChange={e => {
                    const btns = [...(action.payload.buttons || [])]
                    btns[bi] = { ...btns[bi], title: e.target.value }
                    updatePayload('buttons', btns)
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const btns = action.payload.buttons.filter((_: any, i: number) => i !== bi)
                    updatePayload('buttons', btns)
                  }}
                  className="text-slate-400 hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── add_tag / remove_tag ── */}
      {(at === 'add_tag' || at === 'remove_tag') && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Nombre de la etiqueta</Label>
          <Input
            className="h-9 text-xs bg-[#F7F8FA] border-black/[0.08]"
            placeholder="Ej: vip, seguimiento, pagado"
            value={action.payload.tag || ''}
            onChange={e => updatePayload('tag', e.target.value)}
          />
        </div>
      )}

      {/* ── set_status ── */}
      {at === 'set_status' && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Nuevo estado del chat</Label>
          <Select value={action.payload.status || 'customer'} onValueChange={v => updatePayload('status', v)}>
            <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead (prospecto)</SelectItem>
              <SelectItem value="customer">Cliente activo</SelectItem>
              <SelectItem value="closed">Cerrado</SelectItem>
              <SelectItem value="support">Soporte</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── update_field ── */}
      {at === 'update_field' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-400">Nombre del campo</Label>
            <Input
              className="h-9 text-xs bg-[#F7F8FA] border-black/[0.08] mt-1"
              placeholder="ej: tier, region"
              value={action.payload.field_name || ''}
              onChange={e => updatePayload('field_name', e.target.value)}
            />
          </div>
          <div>
            <div className="flex justify-between">
              <Label className="text-xs text-slate-400">Valor</Label>
              <VariablePicker onInsert={v => insertVariable(v, 'value')} />
            </div>
            <Input
              className="h-9 text-xs bg-[#F7F8FA] border-black/[0.08] mt-1"
              placeholder="ej: premium, activo"
              value={action.payload.value || ''}
              onChange={e => updatePayload('value', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── notify_admin ── */}
      {at === 'notify_admin' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-slate-400">Título</Label>
              <VariablePicker onInsert={v => insertVariable(v, 'title')} />
            </div>
            <Input
              className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
              placeholder="Ej: Cliente necesita atención urgente"
              value={action.payload.title || ''}
              onChange={e => updatePayload('title', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-slate-400">Mensaje</Label>
              <VariablePicker onInsert={v => insertVariable(v, 'message')} />
            </div>
            <Textarea
              className="h-14 text-xs bg-[#F7F8FA] border-black/[0.08] resize-none"
              placeholder="Ej: El cliente tiene una consulta urgente. Usa + Insertar dato para personalizar."
              value={action.payload.message || ''}
              onChange={e => updatePayload('message', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── notify_webhook ── */}
      {at === 'notify_webhook' && (
        <div className="space-y-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 flex gap-1">
            <Webhook size={10} className="mt-0.5 shrink-0" />
            Envía los datos del cliente a otra aplicación como Zapier, Slack, Make o tu CRM.
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs text-slate-400">URL del webhook *</Label>
              <Input
                className="h-9 text-xs bg-[#F7F8FA] border-black/[0.08] mt-1"
                placeholder="https://hooks.zapier.com/..."
                value={action.payload.url || ''}
                onChange={e => updatePayload('url', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Método</Label>
              <Select value={action.payload.method || 'POST'} onValueChange={v => updatePayload('method', v)}>
                <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            El sistema envía automáticamente: nombre, teléfono, mensaje y etiquetas del cliente.
          </p>
        </div>
      )}

      {/* ── start_flow ── */}
      {at === 'start_flow' && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Flujo a iniciar</Label>
          <Select
            value={action.payload.flow_id || action.payload.flowId || ''}
            onValueChange={v => onUpdate(index, { payload: { ...action.payload, flow_id: v, flowId: v } })}
          >
            <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-xs mt-1">
              <SelectValue placeholder="Selecciona un flujo..." />
            </SelectTrigger>
            <SelectContent>
              {flows.length === 0 && <SelectItem value="_none">No hay flujos creados</SelectItem>}
              {flows.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.is_active ? '● ' : '○ '}{f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-slate-400 mt-1">El flujo se iniciará la próxima vez que el cliente escriba.</p>
        </div>
      )}

      {/* ── pause ── */}
      {at === 'pause' && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Segundos de pausa (máx 300)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={300}
              className="h-9 w-32 text-xs bg-[#F7F8FA] border-black/[0.08]"
              value={action.payload.seconds || 5}
              onChange={e => updatePayload('seconds', parseInt(e.target.value))}
            />
            <span className="text-xs text-slate-400">segundos</span>
            <span className="text-[10px] text-slate-500">
              ({Math.round((action.payload.seconds || 5) / 60 * 10) / 10} min)
            </span>
          </div>
          <p className="text-[10px] text-slate-400">El bot esperará este tiempo antes de ejecutar la siguiente acción.</p>
        </div>
      )}

      {/* ── Delay opcional para todas las acciones (excepto pause) ── */}
      {at !== 'pause' && (
        <div className="pt-3 mt-3 border-t border-black/[0.06] flex items-center gap-2">
          <Clock size={12} className="text-slate-400" />
          <Label className="text-[10px] text-slate-400 whitespace-nowrap">Esperar antes de este paso:</Label>
          <Input
            type="number"
            min={0}
            max={60}
            className="h-7 w-20 text-xs bg-[#F7F8FA] border-black/[0.06]"
            value={action.delay_seconds || 0}
            onChange={e => onUpdate(index, { delay_seconds: parseInt(e.target.value) || 0 })}
          />
          <span className="text-[10px] text-slate-400">seg</span>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TriggerBuilder({ assistantId, triggerId, initialTemplate }: TriggerBuilderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(!!triggerId && !initialTemplate)
  const [activeTab, setActiveTab] = useState<'conditions' | 'actions'>('conditions')
  const [showConditionPicker, setShowConditionPicker] = useState(false)
  const [showActionPicker, setShowActionPicker] = useState(false)

  // Trigger form
  const [name, setName] = useState('')
  const [type, setType] = useState<TriggerType>('logic')
  const [description, setDescription] = useState('')
  const [timeMinutes, setTimeMinutes] = useState('30')
  const [flows, setFlows] = useState<ConversationFlow[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState('')
  const [conditionsLogic, setConditionsLogic] = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<TriggerCondition[]>([])
  const [actions, setActions] = useState<TriggerAction[]>([])
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    send_days: 'expiration',
    audience_type: 'service',
    audience_value: '',
  })

  // Load flows + templates
  useEffect(() => {
    getFlows().then(setFlows)
    fetch('/api/meta-templates').then(r => r.json()).then(d => {
      if (d.templates) setMetaTemplates(d.templates.filter((t: MetaTemplate) => t.status === 'APPROVED'))
    }).catch(() => {})
  }, [])

  // Pre-fill from template (only when creating new, not editing)
  useEffect(() => {
    if (!triggerId && initialTemplate) {
      setName(initialTemplate.name)
      setType(initialTemplate.type)
      if (initialTemplate.type === 'time' && initialTemplate.timeMinutes) {
        setTimeMinutes(initialTemplate.timeMinutes)
      }
      if (initialTemplate.type === 'scheduled' && initialTemplate.scheduleConfig) {
        setScheduleConfig(initialTemplate.scheduleConfig as any)
      }
      if (initialTemplate.conditionsLogic) setConditionsLogic(initialTemplate.conditionsLogic)
      setConditions(
        (initialTemplate.conditions || []).map(c => ({
          condition_type: c.condition_type as ConditionType,
          operator: c.operator as any,
          value: c.value,
          payload: c.payload,
        }))
      )
      setActions(
        (initialTemplate.actions || []).map(a => ({
          type: a.type as ActionType,
          payload: a.payload,
          delay_seconds: a.delay_seconds ?? 0,
        }))
      )
      setIsLoading(false)
    }
  }, [initialTemplate, triggerId])

  // Load existing trigger
  useEffect(() => {
    if (triggerId) {
      getTrigger(triggerId).then(data => {
        if (data) {
          setName(data.name)
          setType(data.type as TriggerType)
          if (data.type === 'time') setTimeMinutes(data.description || '30')
          else if (data.type === 'flow') setSelectedFlowId(data.description || '')
          else if (data.type === 'scheduled') {
            try { setScheduleConfig(JSON.parse(data.description || '{}')) } catch {}
          } else setDescription(data.description || '')
          setActions((data.trigger_actions || []).map((a: any) => ({
            ...a,
            type: a.type as ActionType,
            payload: a.payload || {},
            delay_seconds: a.delay_seconds || 0,
          })))
          setConditions((data.trigger_conditions || []).map(normalizeLegacyCondition))
          if ((data as any).conditions_logic) setConditionsLogic((data as any).conditions_logic)
        }
        setIsLoading(false)
      })
    }
  }, [triggerId])

  // ── Handlers ──

  const addCondition = (condType: ConditionType) => {
    const defaults = getDefaultConditionPayload(condType)
    setConditions([...conditions, { condition_type: condType, ...defaults }])
  }

  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i))
  const updateCondition = (i: number, update: Partial<TriggerCondition>) => {
    const next = [...conditions]
    next[i] = { ...next[i], ...update }
    setConditions(next)
  }

  const addAction = (actionType: ActionType) => {
    setActions([...actions, { type: actionType, payload: getDefaultActionPayload(actionType), delay_seconds: 0 }])
  }
  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i))
  const updateAction = (i: number, update: Partial<TriggerAction>) => {
    const next = [...actions]
    next[i] = { ...next[i], ...update }
    setActions(next)
  }

  const handleSave = () => {
    if (!name.trim()) return alert('El nombre es obligatorio')
    if (type === 'logic' && !description.trim()) return alert('La descripción lógica es obligatoria')
    if (type === 'time' && (!timeMinutes || parseInt(timeMinutes) < 1)) return alert('Ingresa los minutos de espera')
    if (type === 'flow' && !selectedFlowId) return alert('Selecciona un flujo')
    if (type === 'scheduled' && scheduleConfig.audience_type !== 'all' && !scheduleConfig.audience_value) {
      return alert('Define el valor del filtro de audiencia')
    }

    const descriptionToSave =
      type === 'time' ? timeMinutes :
      type === 'flow' ? selectedFlowId :
      type === 'scheduled' ? JSON.stringify(scheduleConfig) :
      description

    startTransition(async () => {
      try {
        await saveTrigger(assistantId, {
          id: triggerId,
          name,
          type,
          description: descriptionToSave,
          actions: actions.map((a, i) => ({
            type: a.type,
            payload: a.payload,
            action_order: i,
            delay_seconds: a.delay_seconds || 0,
          })),
          conditions: conditions.map(c => ({
            type: c.condition_type,
            condition_type: c.condition_type,
            operator: c.operator,
            value: c.value,
            payload: c.payload,
          })),
          conditionsLogic,
        })
        router.push(`/dashboard/assistants/${assistantId}/triggers`)
      } catch (error: any) {
        console.error('[TriggerBuilder] Save error:', error)
        const msg = error?.message || error?.toString() || 'Error desconocido'
        alert(`Error al guardar la automatización:\n\n${msg}`)
      }
    })
  }

  // ── Loading skeleton ──

  if (isLoading) return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-black/[0.06] rounded-md" />
      <div className="space-y-4">
        <div className="h-12 bg-black/[0.06] rounded-lg" />
        <div className="h-32 bg-black/[0.06] rounded-lg" />
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto text-[#0F172A]">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button className="h-9 w-9 p-0 bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-700" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">
              {triggerId ? 'Editar Automatización' : 'Nueva Automatización'}
            </h1>
            <p className="text-slate-400 text-sm">Configura qué hace tu bot automáticamente</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <Save size={16} />
          {isPending ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      {/* ── Progress Stepper ── */}
      <div className="flex items-center gap-2 mb-6 bg-white rounded-xl border border-black/[0.08] p-3">
        {[
          { num: 1, label: 'Información básica', section: 'config' as const, active: true },
          { num: 2, label: `¿Cuándo se activa? (${conditions.length})`, section: 'conditions' as const, active: activeTab === 'conditions' },
          { num: 3, label: `¿Qué hace? (${actions.length})`, section: 'actions' as const, active: activeTab === 'actions' },
        ].map((step, i) => (
          <button
            key={step.num}
            onClick={() => { if (step.section !== 'config') setActiveTab(step.section) }}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-lg transition-all flex-1 ${
              step.section === 'config'
                ? 'bg-[#F7F8FA] cursor-default'
                : step.active
                  ? step.section === 'conditions'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-green-50 border border-green-200'
                  : 'hover:bg-[#F7F8FA] cursor-pointer'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step.section === 'config'
                ? (name.trim() ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500')
                : step.section === 'conditions'
                  ? (step.active ? 'bg-red-500 text-white' : conditions.length > 0 ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500')
                  : (step.active ? 'bg-green-600 text-white' : actions.length > 0 ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500')
            }`}>
              {step.section === 'config' && name.trim() ? '✓' :
               step.section === 'conditions' && !step.active && conditions.length > 0 ? '✓' :
               step.section === 'actions' && !step.active && actions.length > 0 ? '✓' :
               step.num}
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-semibold text-[#0F172A] truncate">{step.label}</p>
            </div>
            {i < 2 && <div className="w-6 h-px bg-slate-200 shrink-0 ml-auto" />}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT: Config ── */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-white border-black/[0.08]">
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Nombre</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Recordatorio de inactividad"
                  className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">¿Cómo se activa?</Label>
                <Select value={type} onValueChange={v => setType(v as TriggerType)}>
                  <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logic">🧠 Cuando el cliente escribe algo (palabras clave)</SelectItem>
                    <SelectItem value="time">⏰ Cuando pasa tiempo sin respuesta</SelectItem>
                    <SelectItem value="flow">🔄 Iniciar una conversación guiada</SelectItem>
                    <SelectItem value="scheduled">📅 En un día programado (ej: vencimiento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === 'logic' && (
                <div className="space-y-1 animate-in fade-in">
                  <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                    ¿Cuándo debe activarse?
                    <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-1 py-0.5 rounded">IA</span>
                  </Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe con tus palabras cuándo se activa. Ej: Cuando un cliente envía un comprobante de pago"
                    className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-24 resize-none text-sm"
                  />
                </div>
              )}

              {type === 'time' && (
                <div className="space-y-1 animate-in fade-in">
                  <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">¿Cuántos minutos sin respuesta?</Label>
                  <Input
                    type="number" min={1} max={10080}
                    value={timeMinutes}
                    onChange={e => setTimeMinutes(e.target.value)}
                    placeholder="30"
                    className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                  />
                  <p className="text-[10px] text-slate-400">
                    Activar si el cliente no responde en {timeMinutes || '?'} min
                    {parseInt(timeMinutes) >= 60 && ` (${Math.round(parseInt(timeMinutes) / 60 * 10) / 10}h)`}
                  </p>
                </div>
              )}

              {type === 'flow' && (
                <div className="space-y-1 animate-in fade-in">
                  <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">¿Qué conversación guiada iniciar?</Label>
                  <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
                    <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                      <SelectValue placeholder="Selecciona un flujo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {flows.length === 0 && <SelectItem value="_none">No hay flujos creados</SelectItem>}
                      {flows.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.is_active ? '● ' : '○ '}{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {type === 'scheduled' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex gap-2 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400">
                    <Calendar size={13} className="shrink-0 mt-0.5" />
                    <span>Se ejecuta automáticamente una vez al día. En la sección "¿Qué hace?" agrega una <strong>Plantilla de WhatsApp</strong>.</span>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 flex items-center gap-1"><Users size={12} /> Audiencia</Label>
                    <Select
                      value={scheduleConfig.audience_type}
                      onValueChange={v => setScheduleConfig(prev => ({
                        ...prev,
                        audience_type: v as ScheduleConfig['audience_type'],
                        audience_value: ''
                      }))}
                    >
                      <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service">Por servicio</SelectItem>
                        <SelectItem value="tag">Por etiqueta</SelectItem>
                        <SelectItem value="all">Todas las activas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {scheduleConfig.audience_type === 'service' && (
                    <Select
                      value={scheduleConfig.audience_value}
                      onValueChange={v => setScheduleConfig(prev => ({ ...prev, audience_value: v }))}
                    >
                      <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CANVA">Canva</SelectItem>
                        <SelectItem value="CHATGPT">ChatGPT</SelectItem>
                        <SelectItem value="GEMINI">Gemini</SelectItem>
                        <SelectItem value="NETFLIX">Netflix</SelectItem>
                        <SelectItem value="SPOTIFY">Spotify</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {scheduleConfig.audience_type === 'tag' && (
                    <Input
                      className="bg-[#F7F8FA] border-black/[0.08] text-sm"
                      placeholder="Ej: VIP, CLIENTE_ACTIVO"
                      value={scheduleConfig.audience_value}
                      onChange={e => setScheduleConfig(prev => ({ ...prev, audience_value: e.target.value }))}
                    />
                  )}
                  <div>
                    <Label className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> Cuándo enviar</Label>
                    <Select
                      value={scheduleConfig.send_days}
                      onValueChange={v => setScheduleConfig(prev => ({ ...prev, send_days: v as ScheduleConfig['send_days'] }))}
                    >
                      <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expiration">El día de vencimiento</SelectItem>
                        <SelectItem value="1_day_before">1 día antes</SelectItem>
                        <SelectItem value="3_days_before">3 días antes</SelectItem>
                        <SelectItem value="7_days_before">7 días antes</SelectItem>
                        <SelectItem value="daily">Todos los días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F7F8FA] text-xs text-slate-500">
                    <p className="font-semibold text-[#0F172A] mb-1">Resumen:</p>
                    <p>
                      {scheduleConfig.audience_type === 'service' && `Suscriptores de ${scheduleConfig.audience_value}`}
                      {scheduleConfig.audience_type === 'tag' && `Etiqueta: "${scheduleConfig.audience_value}"`}
                      {scheduleConfig.audience_type === 'all' && 'Todos los activos'}
                      {' · '}
                      {scheduleConfig.send_days === 'expiration' && 'día de vencimiento'}
                      {scheduleConfig.send_days === '1_day_before' && '1 día antes'}
                      {scheduleConfig.send_days === '3_days_before' && '3 días antes'}
                      {scheduleConfig.send_days === '7_days_before' && '7 días antes'}
                      {scheduleConfig.send_days === 'daily' && 'todos los días'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Variables quick reference ── */}
          <Card className="bg-white border-black/[0.08]">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                <Zap size={11} className="text-indigo-400" /> Datos que puedes usar en mensajes
              </p>
              <p className="text-[10px] text-slate-400 mb-3">Usa el botón "+ Insertar dato" en cualquier mensaje para agregarlos automáticamente.</p>
              <div className="space-y-3">
                {[
                  { label: '👤 Datos del cliente', items: [
                    { label: 'Nombre', example: 'Juan García' },
                    { label: 'Teléfono', example: '+59170000000' },
                    { label: 'Correo', example: 'juan@email.com' },
                  ]},
                  { label: '💳 Suscripción', items: [
                    { label: 'Servicio', example: 'Netflix' },
                    { label: 'Fecha de vencimiento', example: '31/12/2025' },
                    { label: 'Días restantes', example: '7' },
                  ]},
                  { label: '📅 Fecha', items: [
                    { label: 'Hoy', example: '02/04/2025' },
                  ]},
                ].map(group => (
                  <div key={group.label}>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">{group.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map(item => (
                        <span
                          key={item.label}
                          title={`Ejemplo: ${item.example}`}
                          className="text-[11px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Conditions + Actions ── */}
        <div className="lg:col-span-8">
          {/* Tabs */}
          <div className="flex border-b border-black/[0.08] mb-5">
            <button
              onClick={() => setActiveTab('conditions')}
              className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'conditions' ? 'border-red-500 text-red-500' : 'border-transparent text-slate-400 hover:text-[#0F172A]'
              }`}
            >
              ¿Cuándo se activa? {conditions.length > 0 && `(${conditions.length})`}
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'actions' ? 'border-green-500 text-green-500' : 'border-transparent text-slate-400 hover:text-[#0F172A]'
              }`}
            >
              ¿Qué hace? {actions.length > 0 && `(${actions.length})`}
            </button>
          </div>

          {/* ── CONDITIONS TAB ── */}
          {activeTab === 'conditions' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
              {/* Condition Picker Modal */}
              {showConditionPicker && (
                <CardPickerModal
                  title="¿Qué condición quieres agregar?"
                  categories={CONDITION_CATEGORIES}
                  onSelect={v => addCondition(v as ConditionType)}
                  onClose={() => setShowConditionPicker(false)}
                />
              )}

              {/* Header with logic toggle + add button */}
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-black/[0.08]">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-[#0F172A]">Reglas de activación</h3>
                  {conditions.length > 1 && (
                    <div className="flex items-center gap-1 bg-[#F7F8FA] rounded-lg p-0.5 border border-black/[0.06]">
                      <button
                        type="button"
                        onClick={() => setConditionsLogic('AND')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          conditionsLogic === 'AND'
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Todas deben cumplirse
                      </button>
                      <button
                        type="button"
                        onClick={() => setConditionsLogic('OR')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          conditionsLogic === 'OR'
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Al menos una
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={() => setShowConditionPicker(true)}
                  className="bg-red-600 hover:bg-red-700 text-white h-9 text-xs gap-1.5 rounded-lg"
                >
                  <Plus size={14} /> Agregar condición
                </Button>
              </div>

              {conditions.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-black/[0.06] rounded-xl">
                  <Filter className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Sin condiciones extra</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">La automatización se activará siempre según el tipo elegido. Agrega condiciones para ser más específico.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { type: 'text_contains' as ConditionType, label: '💬 Detectar palabras clave', desc: 'Ej: "precio", "ayuda"' },
                      { type: 'has_tag' as ConditionType, label: '🏷️ Si tiene etiqueta', desc: 'Ej: "VIP", "nuevo"' },
                      { type: 'message_count' as ConditionType, label: '📊 Por cantidad de mensajes', desc: 'Ej: más de 10' },
                    ].map(suggestion => (
                      <button
                        key={suggestion.type}
                        type="button"
                        onClick={() => addCondition(suggestion.type)}
                        className="text-left p-3 rounded-xl border border-black/[0.06] bg-white hover:border-red-300 hover:shadow-sm transition-all max-w-[200px]"
                      >
                        <p className="text-xs font-semibold text-[#0F172A]">{suggestion.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{suggestion.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((cond, index) => (
                    <div key={index}>
                      <ConditionEditor
                        condition={cond}
                        index={index}
                        onUpdate={updateCondition}
                        onRemove={removeCondition}
                      />
                      {index < conditions.length - 1 && (
                        <div className="flex items-center justify-center py-2">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                            conditionsLogic === 'AND'
                              ? 'bg-red-50 text-red-400 border-red-200'
                              : 'bg-orange-50 text-orange-400 border-orange-200'
                          }`}>
                            {conditionsLogic === 'AND' ? 'Y también...' : 'O si...'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ACTIONS TAB ── */}
          {activeTab === 'actions' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {/* Action Picker Modal */}
              {showActionPicker && (
                <CardPickerModal
                  title="¿Qué quieres que haga el bot?"
                  categories={ACTION_CATEGORIES}
                  onSelect={v => addAction(v as ActionType)}
                  onClose={() => setShowActionPicker(false)}
                />
              )}

              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-black/[0.08]">
                <div>
                  <h3 className="text-sm font-medium text-[#0F172A]">¿Qué hará el bot?</h3>
                  {actions.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">Se ejecutan en orden, de arriba hacia abajo</p>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => setShowActionPicker(true)}
                  className="bg-green-600 hover:bg-green-700 text-white h-9 text-xs gap-1.5 rounded-lg"
                >
                  <Plus size={14} /> Agregar acción
                </Button>
              </div>

              {actions.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-black/[0.06] rounded-xl">
                  <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Sin acciones configuradas</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Agrega al menos una acción para que la automatización haga algo.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { type: 'send_text' as ActionType, label: '💬 Enviar un mensaje', desc: 'Responde al cliente automáticamente' },
                      { type: 'add_tag' as ActionType, label: '🏷️ Poner etiqueta', desc: 'Organiza a tus clientes' },
                      { type: 'notify_admin' as ActionType, label: '🔔 Notificarte', desc: 'Recibe una alerta' },
                    ].map(suggestion => (
                      <button
                        key={suggestion.type}
                        type="button"
                        onClick={() => addAction(suggestion.type)}
                        className="text-left p-3 rounded-xl border border-black/[0.06] bg-white hover:border-green-300 hover:shadow-sm transition-all max-w-[200px]"
                      >
                        <p className="text-xs font-semibold text-[#0F172A]">{suggestion.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{suggestion.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action, index) => (
                    <ActionEditor
                      key={index}
                      action={action}
                      index={index}
                      flows={flows}
                      metaTemplates={metaTemplates}
                      onUpdate={updateAction}
                      onRemove={removeAction}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
