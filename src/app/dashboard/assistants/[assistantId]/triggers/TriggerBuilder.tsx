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
    label: '💬 Texto del mensaje',
    items: [
      { value: 'text_contains', label: 'Contiene palabras' },
      { value: 'text_regex', label: 'Coincide con Regex' },
      { value: 'text_matches_intent', label: 'Intención detectada (IA)' },
    ]
  },
  {
    label: '💬 Chat',
    items: [
      { value: 'last_message_time', label: 'Tiempo sin respuesta (min)' },
      { value: 'message_count', label: 'Cantidad de mensajes' },
      { value: 'message_rate', label: 'Mensajes por hora' },
      { value: 'has_tag', label: 'Tiene etiqueta' },
      { value: 'not_tag', label: 'NO tiene etiqueta' },
      { value: 'chat_status', label: 'Estado del chat' },
      { value: 'custom_field', label: 'Campo personalizado' },
      { value: 'creation_date', label: 'Días desde creación' },
    ]
  },
  {
    label: '🕐 Tiempo',
    items: [
      { value: 'day_of_week', label: 'Día de la semana' },
      { value: 'hour_range', label: 'Rango de hora' },
    ]
  },
  {
    label: '💳 Suscripción',
    items: [
      { value: 'expiration_days', label: 'Días para vencer' },
      { value: 'subscription_status', label: 'Estado de suscripción' },
    ]
  },
]

const ACTION_CATEGORIES = [
  {
    label: '💬 Mensajes',
    items: [
      { value: 'send_text', label: 'Enviar texto' },
      { value: 'send_text_ai', label: 'Respuesta IA personalizada' },
      { value: 'send_media', label: 'Enviar imagen / archivo' },
      { value: 'send_template', label: 'Plantilla Meta (aprobada)' },
      { value: 'send_interactive', label: 'Botones / Lista interactiva' },
    ]
  },
  {
    label: '🏷️ Metadata del chat',
    items: [
      { value: 'add_tag', label: 'Agregar etiqueta' },
      { value: 'remove_tag', label: 'Quitar etiqueta' },
      { value: 'set_status', label: 'Cambiar estado' },
      { value: 'update_field', label: 'Actualizar campo personalizado' },
    ]
  },
  {
    label: '🔔 Notificaciones',
    items: [
      { value: 'notify_admin', label: 'Notificar al admin' },
      { value: 'notify_webhook', label: 'Webhook externo (CRM, Slack…)' },
    ]
  },
  {
    label: '⚙️ Control',
    items: [
      { value: 'start_flow', label: 'Iniciar flujo conversacional' },
      { value: 'pause', label: 'Pausa (delay entre acciones)' },
    ]
  },
]

const OPERATORS_NUMERIC: { value: string; label: string }[] = [
  { value: 'greater_than', label: 'Mayor que (>)' },
  { value: 'greater_equal', label: 'Mayor o igual (≥)' },
  { value: 'less_than', label: 'Menor que (<)' },
  { value: 'less_equal', label: 'Menor o igual (≤)' },
  { value: 'equals', label: 'Igual a (=)' },
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
  text_contains: 'Contiene palabras',
  text_regex: 'Regex',
  text_matches_intent: 'Intención IA',
  last_message_time: 'Sin respuesta (min)',
  message_count: 'Cantidad mensajes',
  message_rate: 'Mensajes/hora',
  has_tag: 'Tiene etiqueta',
  not_tag: 'No tiene etiqueta',
  chat_status: 'Estado del chat',
  custom_field: 'Campo custom',
  creation_date: 'Días creado',
  day_of_week: 'Día de semana',
  hour_range: 'Rango de hora',
  expiration_days: 'Días para vencer',
  subscription_status: 'Estado suscripción',
}

const ACTION_LABELS: Record<ActionType, string> = {
  send_text: 'Enviar texto',
  send_text_ai: 'Respuesta IA',
  send_media: 'Enviar archivo',
  send_template: 'Plantilla Meta',
  send_interactive: 'Botones / Lista',
  add_tag: 'Agregar etiqueta',
  remove_tag: 'Quitar etiqueta',
  set_status: 'Cambiar estado',
  update_field: 'Campo personalizado',
  notify_admin: 'Notificar admin',
  notify_webhook: 'Webhook externo',
  start_flow: 'Iniciar flujo',
  pause: 'Pausa',
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

// ── VariablePicker ─────────────────────────────────────────────────────────────

function VariablePicker({ onInsert }: { onInsert: (variable: string) => void }) {
  const [open, setOpen] = useState(false)
  const allVars = [
    ...AVAILABLE_VARIABLES.contact.map(v => ({ ...v, ns: 'Contacto' })),
    ...AVAILABLE_VARIABLES.subscription.map(v => ({ ...v, ns: 'Suscripción' })),
    ...AVAILABLE_VARIABLES.date.map(v => ({ ...v, ns: 'Fecha' })),
    ...AVAILABLE_VARIABLES.legacy.slice(0, 3).map(v => ({ ...v, ns: 'Legacy' })),
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[10px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors"
      >
        <Zap size={10} />
        Variables {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-black/[0.08] rounded-xl shadow-lg p-3 w-72 max-h-64 overflow-y-auto">
          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wider font-semibold">Clic para insertar</p>
          {['Contacto', 'Suscripción', 'Fecha', 'Legacy'].map(ns => {
            const vars = allVars.filter(v => v.ns === ns)
            if (!vars.length) return null
            return (
              <div key={ns} className="mb-2">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{ns}</p>
                <div className="flex flex-wrap gap-1">
                  {vars.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      title={`${v.label} — ej: ${v.example}`}
                      className="text-[10px] font-mono bg-[#F7F8FA] hover:bg-indigo-50 text-indigo-600 border border-indigo-200/60 px-1.5 py-0.5 rounded transition-colors"
                      onClick={() => { onInsert(v.key); setOpen(false) }}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
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
            <Label className="text-xs text-slate-400">La IA detectará la intención del mensaje:</Label>
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
              <Info size={10} /> Usa llamada a IA — solo para triggers lógicos
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
            <Label className="text-xs text-slate-400">Días activos (selecciona uno o más):</Label>
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
            <Label className="text-xs text-slate-400">Rango horario (formato HH:MM-HH:MM):</Label>
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
            placeholder="Ej: Hola {{contact.name}}, tu suscripción vence el {{subscription.expires_at}} 📅"
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
            La IA generará una respuesta según tu instrucción usando el contexto del mensaje recibido.
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-slate-400">Instrucción para la IA *</Label>
              <VariablePicker onInsert={v => insertVariable(v, 'instruction')} />
            </div>
            <Textarea
              className="min-h-[70px] text-xs bg-[#F7F8FA] border-black/[0.08] resize-none"
              placeholder="Ej: Responde como agente de soporte técnico. Sé cordial y ofrece soluciones. El cliente es {{contact.name}}."
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
              placeholder="Ej: Catálogo de {{contact.name}} actualizado al {{date.today}}"
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
              No hay plantillas aprobadas en Meta. Configura el WABA ID en Ajustes y crea una plantilla con estado APPROVED.
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
                      <span className="text-xs text-indigo-400 font-mono w-10 shrink-0">{`{{${vi + 1}}}`}</span>
                      <Input
                        className="h-8 text-xs bg-[#F7F8FA] border-black/[0.08]"
                        placeholder={`Valor p/ {{${vi + 1}}} — ej: {{contact.name}}`}
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
              placeholder="Ej: ¿En qué podemos ayudarte hoy, {{contact.name}}?"
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
              placeholder="ej: premium, {{contact.status}}"
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
              placeholder="Ej: Alerta — {{contact.name}} necesita atención"
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
              placeholder="Detalle de la alerta con variables {{contact.name}}, {{subscription.service}}..."
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
            Envía un POST a tu CRM, Slack, Make, Zapier u otro servicio externo.
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
            El payload incluye automáticamente: chat_id, phone_number, contact_name, message_text, tags y timestamp.
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
          <Label className="text-[10px] text-slate-400 whitespace-nowrap">Esperar antes:</Label>
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
    audience_value: 'CANVA',
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
        alert(`Error al guardar el disparador:\n\n${msg}`)
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
              {triggerId ? 'Editar Disparador' : 'Nuevo Disparador'}
            </h1>
            <p className="text-slate-400 text-sm">Automatización avanzada</p>
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
          { num: 2, label: `Condiciones (${conditions.length})`, section: 'conditions' as const, active: activeTab === 'conditions' },
          { num: 3, label: `Acciones (${actions.length})`, section: 'actions' as const, active: activeTab === 'actions' },
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
                <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tipo de disparador</Label>
                <Select value={type} onValueChange={v => setType(v as TriggerType)}>
                  <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logic">🧠 Lógica (palabras clave)</SelectItem>
                    <SelectItem value="time">⏰ Tiempo (sin respuesta)</SelectItem>
                    <SelectItem value="flow">🔄 Iniciar flujo</SelectItem>
                    <SelectItem value="scheduled">📅 Programado (suscripciones)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === 'logic' && (
                <div className="space-y-1 animate-in fade-in">
                  <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                    Descripción lógica
                    <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-1 py-0.5 rounded">IA</span>
                  </Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="¿Cuándo debe activarse? Ej: Cliente envía comprobante de pago"
                    className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-24 resize-none text-sm"
                  />
                </div>
              )}

              {type === 'time' && (
                <div className="space-y-1 animate-in fade-in">
                  <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Minutos sin respuesta</Label>
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
                  <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Flujo a ejecutar</Label>
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
                    <span>Se ejecuta automáticamente una vez al día. Activa <strong>Plantilla Meta</strong> en Acciones.</span>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 flex items-center gap-1"><Users size={12} /> Audiencia</Label>
                    <Select
                      value={scheduleConfig.audience_type}
                      onValueChange={v => setScheduleConfig(prev => ({
                        ...prev,
                        audience_type: v as ScheduleConfig['audience_type'],
                        audience_value: v === 'service' ? 'CANVA' : ''
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
                <Zap size={11} className="text-indigo-400" /> Variables disponibles
              </p>
              <div className="space-y-2">
                {[
                  { key: '{{contact.name}}', label: 'Nombre' },
                  { key: '{{subscription.service}}', label: 'Servicio' },
                  { key: '{{subscription.expires_at}}', label: 'Vencimiento' },
                  { key: '{{subscription.days_remaining}}', label: 'Días restantes' },
                  { key: '{{date.today}}', label: 'Hoy' },
                ].map(v => (
                  <div key={v.key} className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{v.label}</span>
                    <code className="text-[10px] font-mono bg-[#F7F8FA] text-indigo-500 px-1.5 py-0.5 rounded border border-indigo-100/60">
                      {v.key}
                    </code>
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
              Condiciones ({conditions.length})
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'actions' ? 'border-green-500 text-green-500' : 'border-transparent text-slate-400 hover:text-[#0F172A]'
              }`}
            >
              Acciones ({actions.length})
            </button>
          </div>

          {/* ── CONDITIONS TAB ── */}
          {activeTab === 'conditions' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
              {/* Header with AND/OR toggle + add button */}
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-black/[0.08]">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-[#0F172A]">Reglas de activación</h3>
                  {conditions.length > 1 && (
                    <div className="flex items-center gap-1 bg-[#F7F8FA] rounded-lg p-0.5 border border-black/[0.06]">
                      {(['AND', 'OR'] as const).map(op => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => setConditionsLogic(op)}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                            conditionsLogic === op
                              ? 'bg-red-500 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  )}
                  {conditions.length > 1 && (
                    <span className="text-[10px] text-slate-400">
                      {conditionsLogic === 'AND' ? 'Todas deben cumplirse' : 'Al menos una debe cumplirse'}
                    </span>
                  )}
                </div>

                {/* Grouped selector */}
                <Select onValueChange={v => addCondition(v as ConditionType)}>
                  <SelectTrigger className="w-[200px] bg-red-600 border-red-500 text-white h-9 text-xs">
                    <Plus size={13} className="mr-1" />
                    <SelectValue placeholder="Agregar condición" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_CATEGORIES.map(cat => (
                      <div key={cat.label}>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cat.label}</div>
                        {cat.items.map(item => (
                          <SelectItem key={item.value} value={item.value} className="pl-4">
                            {item.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {conditions.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-black/[0.06] rounded-xl">
                  <Filter className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Sin condiciones</p>
                  <p className="text-xs text-slate-400 mt-1">El disparador se ejecutará siempre que su tipo coincida.</p>
                  <p className="text-xs text-slate-400">Agrega condiciones para hacerlo más específico.</p>
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
                            {conditionsLogic}
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
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-black/[0.08]">
                <div>
                  <h3 className="text-sm font-medium text-[#0F172A]">Secuencia de ejecución</h3>
                  {actions.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">Se ejecutan en orden, de arriba hacia abajo</p>
                  )}
                </div>
                <Select onValueChange={v => addAction(v as ActionType)}>
                  <SelectTrigger className="w-[220px] bg-green-600 border-green-500 text-white h-9 text-xs">
                    <Plus size={13} className="mr-1" />
                    <SelectValue placeholder="Agregar acción" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_CATEGORIES.map(cat => (
                      <div key={cat.label}>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cat.label}</div>
                        {cat.items.map(item => (
                          <SelectItem key={item.value} value={item.value} className="pl-4">
                            {item.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {actions.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-black/[0.06] rounded-xl">
                  <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Sin acciones configuradas</p>
                  <p className="text-xs text-slate-400 mt-1">Agrega al menos una acción para que el disparador haga algo.</p>
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
