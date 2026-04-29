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
  Users, Clock, ChevronDown, ChevronUp, Zap,
  Webhook, Info, CheckCircle2,
} from 'lucide-react'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { TagAutocomplete } from '@/components/ui/tag-autocomplete'
import { useRouter } from 'next/navigation'
import { saveTrigger, getTrigger } from './actions'
import { getFlows, type ConversationFlow } from '../flows/actions'
import { AVAILABLE_VARIABLES, resolveVariables, type VariableContext } from '@/lib/trigger-variables'
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

type InteractiveButton = { id: string; title: string }

type ConditionPayload = {
  flags?: string
  field_name?: string
  words?: string
  tag?: string
  count?: number
  [key: string]: string | number | boolean | undefined
}

type TriggerActionPayloadValue = string | number | boolean | string[] | InteractiveButton[] | undefined

type TriggerActionPayload = {
  message?: string
  instruction?: string
  context?: string
  url?: string
  type?: string
  caption?: string
  template_name?: string
  templateName?: string
  language?: string
  variables?: string[]
  header?: string
  body?: string
  buttons?: InteractiveButton[]
  tag?: string
  status?: string
  field_name?: string
  value?: string
  title?: string
  method?: string
  flow_id?: string
  flowId?: string
  seconds?: number
  [key: string]: TriggerActionPayloadValue
}

type TriggerRecipe = {
  id: string
  title: string
  description: string
  result: string
  type: TriggerType
  name: string
  triggerDescription: string
  timeMinutes?: string
  conditions: TriggerCondition[]
  actions: TriggerAction[]
}

interface TriggerCondition {
  id?: string
  condition_type: ConditionType
  operator: ConditionOperator
  value: string
  payload?: ConditionPayload
}

interface TriggerAction {
  id?: string
  type: ActionType
  payload: TriggerActionPayload
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

interface LoadedTriggerAction {
  id?: string
  type: string
  payload?: TriggerActionPayload
  action_order?: number
  delay_seconds?: number
}

interface LoadedTriggerCondition {
  id?: string
  type?: string
  condition_type?: string
  operator?: ConditionOperator
  value?: string
  payload?: ConditionPayload
}

interface LoadedTrigger {
  name: string
  type: TriggerType
  description: string | null
  trigger_actions?: LoadedTriggerAction[]
  trigger_conditions?: LoadedTriggerCondition[]
  conditions_logic?: 'AND' | 'OR'
}

type ScheduledMessageGuide = {
  label: string
  summary: string
  templateSummary: string
  tone: string
  textPresets: Array<{ label: string; text: string }>
  suggestedVariables: string[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CONDITION_CATEGORIES = [
  {
    label: '💬 Cuando el cliente escribe...',
    items: [
      { value: 'text_contains', label: 'El mensaje contiene ciertas palabras', desc: 'Se activa cuando el cliente escribe una palabra o frase especifica' },
      { value: 'text_matches_intent', label: 'La IA detecta una intención', desc: 'La inteligencia artificial analiza si el cliente pregunta, se queja, pide un precio, etc.' },
    ]
  },
  {
    label: '👤 Según el estado del cliente...',
    items: [
      { value: 'last_message_time', label: 'Minutos sin responder', desc: 'Se activa si el cliente no ha escrito en cierto tiempo' },
      { value: 'message_count', label: 'Cantidad de mensajes enviados', desc: 'Se activa segun cuantos mensajes ha enviado el cliente en total' },
      { value: 'has_tag', label: 'El cliente tiene una etiqueta', desc: 'Se activa si el cliente tiene una etiqueta especifica como "vip" o "nuevo"' },
      { value: 'not_tag', label: 'El cliente NO tiene una etiqueta', desc: 'Se activa si el cliente NO tiene cierta etiqueta' },
      { value: 'chat_status', label: 'Tipo de cliente (lead, cliente, VIP...)', desc: 'Se activa segun la clasificacion del cliente' },
      { value: 'day_of_week', label: 'Solo ciertos dias de la semana', desc: 'Se activa solo en los dias que elijas (lunes, martes, etc.)' },
    ]
  },
]

const CONDITION_CATEGORIES_ADVANCED = [
  {
    label: '⚙️ Opciones avanzadas',
    items: [
      { value: 'text_regex', label: 'Patron avanzado de texto (regex)', desc: 'Usa expresiones regulares para detectar patrones complejos en el mensaje' },
      { value: 'message_rate', label: 'Velocidad de mensajes por hora', desc: 'Se activa segun la frecuencia con que el cliente escribe' },
      { value: 'creation_date', label: 'Dias desde que se registro', desc: 'Se activa segun cuanto tiempo lleva el cliente registrado' },
      { value: 'custom_field', label: 'Campo personalizado', desc: 'Se activa segun un campo que tu definiste en Ajustes' },
      { value: 'hour_range', label: 'Solo en cierto horario', desc: 'Se activa solo dentro de un rango de horas' },
      { value: 'expiration_days', label: 'Dias para que venza la suscripcion', desc: 'Se activa segun cuantos dias faltan para que venza' },
      { value: 'subscription_status', label: 'Estado de la suscripcion', desc: 'Se activa segun si la suscripcion esta activa, vencida, etc.' },
    ]
  },
]

const ACTION_CATEGORIES = [
  {
    label: '💬 Enviar un mensaje al cliente',
    items: [
      { value: 'send_text', label: 'Enviar un texto', desc: 'Envia un mensaje de texto al cliente' },
      { value: 'send_template', label: 'Enviar plantilla de WhatsApp', desc: 'Envia una plantilla aprobada por Meta (ideal para mensajes fuera de 24h)' },
      { value: 'send_interactive', label: 'Enviar botones o menu', desc: 'Envia opciones que el cliente puede tocar para responder rapidamente' },
    ]
  },
  {
    label: '🏷️ Organizar al cliente',
    items: [
      { value: 'add_tag', label: 'Ponerle una etiqueta', desc: 'Agrega una etiqueta al cliente para clasificarlo' },
      { value: 'remove_tag', label: 'Quitarle una etiqueta', desc: 'Remueve una etiqueta del cliente' },
      { value: 'set_status', label: 'Cambiar su tipo', desc: 'Cambia la clasificacion del cliente (lead, cliente, VIP, etc.)' },
    ]
  },
  {
    label: '⚙️ Control del bot',
    items: [
      { value: 'start_flow', label: 'Iniciar una conversacion guiada', desc: 'Inicia un flujo de conversacion paso a paso con el cliente' },
      { value: 'pause', label: 'Esperar unos segundos', desc: 'Hace una pausa antes del siguiente paso (parece mas natural)' },
    ]
  },
]

const SCHEDULED_MESSAGE_GUIDES: Record<ScheduleConfig['send_days'], ScheduledMessageGuide> = {
  expiration: {
    label: 'Vence hoy',
    summary: 'Aqui conviene un mensaje corto, claro y con salida rapida a la renovacion.',
    templateSummary: 'Usa una plantilla de aviso urgente suave: recuerda que vence hoy y abre la renovacion sin rodeos.',
    tone: 'Directo y accionable',
    textPresets: [
      {
        label: 'Urgencia suave',
        text: 'Hola {{contact.name}}. Hoy vence tu suscripcion a {{subscription.service}}. Si quieres mantenerla activa, te ayudo a renovarla ahora.'
      },
      {
        label: 'Recordatorio final',
        text: 'Hola {{contact.name}}. Te recuerdo que {{subscription.service}} vence hoy, {{subscription.expires_at}}. Si quieres seguir con el servicio, te ayudo con la renovacion en este momento.'
      },
    ],
    suggestedVariables: ['{{contact.name}}', '{{subscription.service}}', '{{subscription.expires_at}}'],
  },
  '1_day_before': {
    label: 'Vence manana',
    summary: 'Funciona mejor un recordatorio preventivo: amable, claro y con tiempo para resolver.',
    templateSummary: 'Usa una plantilla de pre-vencimiento: anticipa la fecha y ofrece renovacion sin meter presion.',
    tone: 'Preventivo y ordenado',
    textPresets: [
      {
        label: 'Recordatorio preventivo',
        text: 'Hola {{contact.name}}. Te recuerdo que tu suscripcion a {{subscription.service}} vence manana, {{subscription.expires_at}}. Si quieres renovarla con tiempo, te ayudo ahora.'
      },
      {
        label: 'Renovacion con tiempo',
        text: 'Hola {{contact.name}}. Queria avisarte con tiempo que {{subscription.service}} vence manana. Si ya quieres dejar tu renovacion lista, te acompano en este paso.'
      },
    ],
    suggestedVariables: ['{{contact.name}}', '{{subscription.service}}', '{{subscription.expires_at}}'],
  },
  '3_days_before': {
    label: 'Faltan 3 dias',
    summary: 'Aqui conviene un mensaje suave: recordar, dar contexto y dejar la renovacion abierta sin apuro.',
    templateSummary: 'Usa una plantilla de recordatorio anticipado: tono tranquilo, con foco en orden y continuidad.',
    tone: 'Suave y preventivo',
    textPresets: [
      {
        label: 'Recordatorio anticipado',
        text: 'Hola {{contact.name}}. Tu suscripcion a {{subscription.service}} vence en {{subscription.days_remaining}} dias. Te escribo con tiempo para que puedas renovarla sin apuro.'
      },
      {
        label: 'Continuidad del servicio',
        text: 'Hola {{contact.name}}. Te dejo este recordatorio porque {{subscription.service}} vence pronto, el {{subscription.expires_at}}. Si quieres dejarlo resuelto desde ahora, te ayudo.'
      },
    ],
    suggestedVariables: ['{{contact.name}}', '{{subscription.service}}', '{{subscription.days_remaining}}'],
  },
  '7_days_before': {
    label: 'Falta una semana',
    summary: 'Conviene una salida informativa y muy ligera. Sirve para ordenar renovaciones con tiempo.',
    templateSummary: 'Usa una plantilla de aviso temprano: tono tranquilo, recordatorio simple y opcion de renovar mas adelante.',
    tone: 'Ligero e informativo',
    textPresets: [
      {
        label: 'Aviso temprano',
        text: 'Hola {{contact.name}}. Te aviso con tiempo que tu suscripcion a {{subscription.service}} vence en una semana. Cuando quieras dejar lista la renovacion, te acompano.'
      },
      {
        label: 'Organizar renovacion',
        text: 'Hola {{contact.name}}. Solo paso a recordarte que {{subscription.service}} vence el {{subscription.expires_at}}. Asi puedes organizar la renovacion con calma.'
      },
    ],
    suggestedVariables: ['{{contact.name}}', '{{subscription.service}}', '{{subscription.expires_at}}'],
  },
  daily: {
    label: 'Seguimiento diario',
    summary: 'Aqui funciona mejor un seguimiento amable, breve y con salida facil para no sentirse insistente.',
    templateSummary: 'Usa una plantilla de seguimiento corto: retoma la renovacion sin repetir demasiado y deja salida clara.',
    tone: 'Amable y no invasivo',
    textPresets: [
      {
        label: 'Seguimiento amable',
        text: 'Hola {{contact.name}}. Te dejo este recordatorio sobre {{subscription.service}} por si todavia quieres renovarla. Si ya lo hiciste, puedes ignorar este mensaje.'
      },
      {
        label: 'Retomar renovacion',
        text: 'Hola {{contact.name}}. Retomo este mensaje por si aun quieres renovar {{subscription.service}}. Cuando quieras, te ayudo a dejarlo resuelto.'
      },
    ],
    suggestedVariables: ['{{contact.name}}', '{{subscription.service}}'],
  },
}

const SCHEDULED_TEMPLATE_KEYWORDS: Record<ScheduleConfig['send_days'], string[]> = {
  expiration: ['vence hoy', 'vencimiento', 'urgente', 'urgencia', 'renovar', 'renovacion', 'hoy'],
  '1_day_before': ['manana', '1 dia', 'pre vencimiento', 'recordatorio', 'renovar', 'renovacion'],
  '3_days_before': ['3 dias', 'vence pronto', 'recordatorio', 'anticipado', 'renovacion'],
  '7_days_before': ['7 dias', 'semana', 'aviso', 'recordatorio', 'renovacion'],
  daily: ['seguimiento', 'retomar', 'recordatorio', 'renovacion', 'pendiente'],
}

function getTemplateBodyText(template: MetaTemplate): string {
  return template.components
    .filter(component => component.type === 'BODY' && component.text)
    .map(component => component.text)
    .join(' ')
}

function getTemplateMatchScore(
  template: MetaTemplate,
  sendDays: ScheduleConfig['send_days']
): number {
  const keywords = SCHEDULED_TEMPLATE_KEYWORDS[sendDays]
  const haystack = `${template.name} ${getTemplateBodyText(template)}`.toLowerCase()

  return keywords.reduce((score, keyword) => (
    haystack.includes(keyword) ? score + 1 : score
  ), 0)
}

function rankTemplatesForSchedule(
  templates: MetaTemplate[],
  sendDays: ScheduleConfig['send_days']
): Array<MetaTemplate & { matchScore: number }> {
  return templates
    .map((template, index) => {
      const matchScore = getTemplateMatchScore(template, sendDays)

      return { ...template, matchScore, originalIndex: index }
    })
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
      return a.originalIndex - b.originalIndex
    })
}

const ACTION_CATEGORIES_ADVANCED = [
  {
    label: '⚙️ Acciones avanzadas',
    items: [
      { value: 'send_text_ai', label: 'Respuesta inteligente (IA)', desc: 'La inteligencia artificial genera una respuesta personalizada' },
      { value: 'send_media', label: 'Enviar imagen o archivo', desc: 'Envia una imagen, video o documento al cliente' },
      { value: 'update_field', label: 'Actualizar campo personalizado', desc: 'Cambia el valor de un campo que definiste en Ajustes' },
      { value: 'notify_admin', label: 'Enviarte una notificacion', desc: 'Te envia un aviso para que revises la conversacion' },
      { value: 'notify_webhook', label: 'Enviar datos a otra app', desc: 'Conecta con Zapier, Slack, CRM u otro servicio externo' },
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

const ADVANCED_CONDITION_TYPES: ConditionType[] = [
  'text_regex',
  'message_rate',
  'custom_field',
  'hour_range',
]

const ADVANCED_ACTION_TYPES: ActionType[] = [
  'send_text_ai',
  'send_media',
  'update_field',
  'notify_webhook',
]

function describeCondition(condition: TriggerCondition) {
  const value = condition.value || 'sin definir'

  switch (condition.condition_type) {
    case 'text_contains':
      return `Se activa cuando el mensaje ${condition.operator === 'not_contains' ? 'no contiene' : 'contiene'}: ${value}.`
    case 'text_matches_intent':
      return `Se activa cuando la IA detecta una intencion de tipo: ${value}.`
    case 'last_message_time':
      return `Se activa despues de ${value} minutos sin respuesta.`
    case 'message_count':
      return `Se activa segun la cantidad de mensajes del cliente: ${value}.`
    case 'has_tag':
      return `Se activa si el cliente tiene la etiqueta ${value}.`
    case 'not_tag':
      return `Se activa si el cliente no tiene la etiqueta ${value}.`
    case 'chat_status':
      return `Se activa segun el tipo de cliente: ${value}.`
    case 'day_of_week':
      return `Solo corre en los dias elegidos: ${value}.`
    case 'hour_range':
      return `Solo corre dentro del horario ${value}.`
    case 'expiration_days':
      return `Se activa cuando faltan ${value} dias para vencer.`
    case 'subscription_status':
      return `Se activa segun el estado de la suscripcion: ${value}.`
    case 'custom_field':
      return `Se fija en el campo ${condition.payload?.field_name || 'personalizado'} y espera el valor ${value}.`
    case 'text_regex':
      return 'Usa una regla avanzada de texto.'
    case 'message_rate':
      return `Se activa segun la frecuencia de mensajes: ${value}.`
    case 'creation_date':
      return `Se activa segun los dias desde registro: ${value}.`
    default:
      return 'Condicion configurada.'
  }
}

function describeAction(action: TriggerAction) {
  switch (action.type) {
    case 'send_text':
      return action.payload.message
        ? `El bot enviara este mensaje: "${String(action.payload.message).slice(0, 90)}${String(action.payload.message).length > 90 ? '...' : ''}".`
        : 'El bot enviara un mensaje de texto.'
    case 'send_template':
      return action.payload.template_name
        ? `El bot enviara la plantilla aprobada ${action.payload.template_name}.`
        : 'El bot enviara una plantilla de WhatsApp.'
    case 'send_interactive':
      return 'El bot mostrara opciones para que el cliente toque y responda mas facil.'
    case 'add_tag':
      return `El bot pondra la etiqueta ${action.payload.tag || 'sin definir'}.`
    case 'remove_tag':
      return `El bot quitara la etiqueta ${action.payload.tag || 'sin definir'}.`
    case 'set_status':
      return `El bot cambiara el tipo de cliente a ${action.payload.status || 'sin definir'}.`
    case 'start_flow':
      return 'El bot iniciara una conversacion guiada.'
    case 'notify_admin':
      return 'Te llegara una alerta para revisar esta conversacion.'
    case 'pause':
      return `El bot esperara ${action.payload.seconds || 5} segundos antes del siguiente paso.`
    case 'send_text_ai':
      return 'La IA respondera segun las instrucciones que le des.'
    case 'send_media':
      return 'El bot enviara un archivo o una imagen.'
    case 'update_field':
      return 'Se actualizara un campo personalizado.'
    case 'notify_webhook':
      return 'Se enviaran datos a otra aplicacion.'
    default:
      return 'Accion configurada.'
  }
}

function detectTemplateVars(components: MetaTemplate['components']): number {
  const body = components.find(c => c.type === 'BODY')
  if (!body?.text) return 0
  const matches = body.text.match(/\{\{(\d+)\}\}/g)
  return matches ? new Set(matches).size : 0
}

function getPreviewExpirationDate(sendDays: ScheduleConfig['send_days']): Date {
  const date = new Date()
  const dayOffsets: Record<ScheduleConfig['send_days'], number> = {
    expiration: 0,
    '1_day_before': 1,
    '3_days_before': 3,
    '7_days_before': 7,
    daily: 2,
  }

  date.setDate(date.getDate() + dayOffsets[sendDays])
  return date
}

function getScheduledPreviewContext(sendDays: ScheduleConfig['send_days']): VariableContext {
  return {
    contactName: 'Maria Fernanda',
    phoneNumber: '+59170000000',
    subscriptionService: 'Netflix Premium',
    subscriptionEmail: 'maria@email.com',
    subscriptionExpiresAt: getPreviewExpirationDate(sendDays),
    subscriptionStatus: sendDays === 'expiration' ? 'por vencer hoy' : 'activa',
    tenantName: 'Jaba',
    tenantServiceName: 'Renovaciones',
  }
}

function resolvePreviewVariable(variable: string, context: VariableContext): string {
  return resolveVariables(variable, context) || variable
}

function renderTemplatePreview(body: string, values: string[]): string {
  if (!body) return ''

  return body.replace(/\{\{(\d+)\}\}/g, (_, rawIndex: string) => {
    const value = values[Number(rawIndex) - 1]
    return value || `Dato ${rawIndex}`
  })
}

// Map legacy condition types to new ones when loading
function normalizeLegacyCondition(cond: LoadedTriggerCondition): TriggerCondition {
  const typeMap: Record<string, ConditionType> = {
    has_tag: 'has_tag',
    contains_words: 'text_contains',
    last_message: 'last_message_time',
    message_count: 'message_count',
    template_sent: 'text_contains',
    schedule: 'expiration_days',
  }
  const rawType = cond.type || cond.condition_type || ''
  return {
    id: cond.id,
    condition_type: (typeMap[rawType] || cond.condition_type || rawType) as ConditionType,
    operator: cond.operator || 'equals',
    value: cond.value || '',
    payload: cond.payload || {},
  }
}

function getDefaultConditionPayload(condType: ConditionType): { operator: ConditionOperator; value: string; payload?: ConditionPayload } {
  const defaults: Partial<Record<ConditionType, { operator: ConditionOperator; value: string; payload?: ConditionPayload }>> = {
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

function getDefaultActionPayload(actionType: ActionType): TriggerActionPayload {
  const defaults: Record<ActionType, TriggerActionPayload> = {
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

function getInitialScheduleConfig(triggerId?: string, initialTemplate?: TriggerTemplate): ScheduleConfig {
  if (!triggerId && initialTemplate?.type === 'scheduled' && initialTemplate.scheduleConfig) {
    return initialTemplate.scheduleConfig
  }
  return {
    send_days: 'expiration',
    audience_type: 'service',
    audience_value: '',
  }
}

function getInitialConditions(triggerId?: string, initialTemplate?: TriggerTemplate): TriggerCondition[] {
  if (triggerId || !initialTemplate) return []
  return (initialTemplate.conditions || []).map(c => ({
    condition_type: c.condition_type as ConditionType,
    operator: c.operator as ConditionOperator,
    value: c.value,
    payload: c.payload as ConditionPayload | undefined,
  }))
}

function getInitialActions(triggerId?: string, initialTemplate?: TriggerTemplate): TriggerAction[] {
  if (triggerId || !initialTemplate) return []
  return (initialTemplate.actions || []).map(a => ({
    type: a.type as ActionType,
    payload: a.payload as TriggerActionPayload,
    delay_seconds: a.delay_seconds ?? 0,
  }))
}

// ── CardPicker Modal ──────────────────────────────────────────────────────────

const TRIGGER_RECIPES: TriggerRecipe[] = [
  {
    id: 'price',
    title: 'Responder precios',
    description: 'Cuando preguntan por precio, plan o costo.',
    result: 'Envia informacion y marca al cliente como interesado.',
    type: 'logic',
    name: 'Consulta de precios',
    triggerDescription: 'Cuando el cliente pregunta por precio, costo, planes o promociones.',
    conditions: [{ condition_type: 'text_contains', operator: 'contains', value: 'precio, costo, plan, promo' }],
    actions: [
      { type: 'send_text', payload: { message: 'Hola. Te comparto la informacion para que elijas la mejor opcion. Si quieres, tambien puedo ayudarte a decidir.' }, delay_seconds: 0 },
      { type: 'add_tag', payload: { tag: 'interesado' }, delay_seconds: 0 },
    ],
  },
  {
    id: 'no_reply',
    title: 'Recordar si no responde',
    description: 'Cuando el cliente queda en silencio.',
    result: 'Espera 30 minutos y envia un recordatorio corto.',
    type: 'time',
    name: 'Recordatorio por inactividad',
    triggerDescription: 'Cliente sin respuesta durante varios minutos.',
    timeMinutes: '30',
    conditions: [],
    actions: [
      { type: 'send_text', payload: { message: 'Hola. Te escribo para saber si todavia quieres que te ayude con esto. Estoy pendiente por aqui.' }, delay_seconds: 0 },
    ],
  },
  {
    id: 'support',
    title: 'Avisar soporte',
    description: 'Cuando piden ayuda o reportan un problema.',
    result: 'Responde al cliente y te deja una alerta interna.',
    type: 'logic',
    name: 'Solicitud de soporte',
    triggerDescription: 'Cuando el cliente pide ayuda, soporte, tiene un problema o reporta un error.',
    conditions: [{ condition_type: 'text_matches_intent', operator: 'equals', value: 'soporte' }],
    actions: [
      { type: 'send_text', payload: { message: 'Gracias por avisarnos. Ya tengo tu caso en revision. Para ayudarte mejor, enviame el detalle o una captura si aplica.' }, delay_seconds: 0 },
      { type: 'notify_admin', payload: { title: 'Cliente necesita soporte', message: 'Revisa esta conversacion porque el cliente pidio ayuda.' }, delay_seconds: 0 },
    ],
  },
  {
    id: 'tag_lead',
    title: 'Guardar lead',
    description: 'Cuando el cliente muestra interes.',
    result: 'Etiqueta el chat y pide el siguiente dato.',
    type: 'logic',
    name: 'Lead interesado',
    triggerDescription: 'Cuando el cliente dice que le interesa, quiere informacion o desea avanzar.',
    conditions: [{ condition_type: 'text_contains', operator: 'contains', value: 'me interesa, quiero, informacion, comprar' }],
    actions: [
      { type: 'add_tag', payload: { tag: 'lead_interesado' }, delay_seconds: 0 },
      { type: 'send_text', payload: { message: 'Perfecto. Para ayudarte con el siguiente paso, dime tu nombre y que opcion te interesa.' }, delay_seconds: 0 },
    ],
  },
]

function CardPickerModal({
  title, categories, advancedCategories, onSelect, onClose
}: {
  title: string
  categories: { label: string; items: { value: string; label: string; desc?: string }[] }[]
  advancedCategories?: { label: string; items: { value: string; label: string; desc?: string }[] }[]
  onSelect: (value: string) => void
  onClose: () => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

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
                    {item.desc && <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {advancedCategories && advancedCategories.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors w-full"
              >
                <div className="flex-1 h-px bg-slate-200" />
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAdvanced ? 'Ocultar avanzadas' : 'Mostrar opciones avanzadas'}
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                <div className="flex-1 h-px bg-slate-200" />
              </button>
              {showAdvanced && advancedCategories.map(cat => (
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
                        {item.desc && <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
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
  condition, index, customFieldDefs, onUpdate, onRemove
}: {
  condition: TriggerCondition
  index: number
  customFieldDefs: { field_name: string; description: string | null }[]
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
        {(() => {
          const allItems = [...CONDITION_CATEGORIES, ...CONDITION_CATEGORIES_ADVANCED].flatMap(c => c.items)
          const found = allItems.find(i => i.value === ct)
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">{CONDITION_LABELS[ct] || ct}</span>
              {found?.desc && <HelpTooltip text={found.desc} size={12} />}
              {ADVANCED_CONDITION_TYPES.includes(ct) && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Avanzada
                </span>
              )}
            </div>
          )
        })()}

        {/* ── text_contains ── */}
        <div className="rounded-xl border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">En simple</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{describeCondition(condition)}</p>
        </div>

        {ct === 'text_contains' && (
          <div className="space-y-2">
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
            <div className="flex flex-wrap gap-2">
              {['precio, costo, plan', 'ayuda, soporte, problema', 'renovar, vencimiento, pago'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdate(index, { value: preset })}
                  className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                >
                  {preset}
                </button>
              ))}
            </div>
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
          <div className="space-y-2">
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
            {ct === 'last_message_time' && (
              <div className="flex flex-wrap gap-2">
                {['15', '30', '60', '120'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdate(index, { value: preset })}
                    className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                  >
                    {preset} min
                  </button>
                ))}
              </div>
            )}
            {ct === 'message_count' && (
              <div className="flex flex-wrap gap-2">
                {['1', '3', '5', '10'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdate(index, { value: preset })}
                    className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                  >
                    {preset} msg
                  </button>
                ))}
              </div>
            )}
            {ct === 'expiration_days' && (
              <div className="flex flex-wrap gap-2">
                {['1', '3', '7', '15'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdate(index, { value: preset })}
                    className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                  >
                    faltan {preset} dias
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── has_tag / not_tag ── */}
        {(ct === 'has_tag' || ct === 'not_tag') && (
          <TagAutocomplete
            value={condition.value ? [condition.value] : []}
            onChange={tags => onUpdate(index, { value: tags[tags.length - 1] || '' })}
            placeholder="Ej: vip, nuevo-cliente"
            singleValue
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
                <Label className="text-[10px] text-slate-400">Campo</Label>
                {customFieldDefs.length > 0 ? (
                  <Select
                    value={condition.payload?.field_name || ''}
                    onValueChange={v => onUpdate(index, { payload: { ...condition.payload, field_name: v } })}
                  >
                    <SelectTrigger className="h-8 bg-[#F7F8FA] border-black/[0.08] text-xs">
                      <SelectValue placeholder="Seleccionar campo" />
                    </SelectTrigger>
                    <SelectContent>
                      {customFieldDefs.map(f => (
                        <SelectItem key={f.field_name} value={f.field_name}>
                          {f.description || f.field_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 bg-[#F7F8FA] border-black/[0.08] text-xs"
                    placeholder="ej: tier, region"
                    value={condition.payload?.field_name || ''}
                    onChange={e => onUpdate(index, { payload: { ...condition.payload, field_name: e.target.value } })}
                  />
                )}
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
  action, index, flows, metaTemplates, customFieldDefs, triggerType, scheduleConfig, onUpdate, onRemove
}: {
  action: TriggerAction
  index: number
  flows: ConversationFlow[]
  metaTemplates: MetaTemplate[]
  customFieldDefs: { field_name: string; description: string | null }[]
  triggerType: TriggerType
  scheduleConfig?: ScheduleConfig
  onUpdate: (i: number, update: Partial<TriggerAction>) => void
  onRemove: (i: number) => void
}) {
  const at = action.type
  const [showTimingOptions, setShowTimingOptions] = useState(Boolean(action.delay_seconds))
  const scheduledGuide = triggerType === 'scheduled'
    ? SCHEDULED_MESSAGE_GUIDES[scheduleConfig?.send_days || 'expiration']
    : null
  const previewContext = triggerType === 'scheduled'
    ? getScheduledPreviewContext(scheduleConfig?.send_days || 'expiration')
    : getScheduledPreviewContext('3_days_before')
  const rankedTemplates = triggerType === 'scheduled' && scheduleConfig
    ? rankTemplatesForSchedule(metaTemplates, scheduleConfig.send_days)
    : metaTemplates.map(template => ({ ...template, matchScore: 0 }))
  const recommendedTemplates = rankedTemplates.filter(template => template.matchScore > 0).slice(0, 3)
  const selectedTemplateName = action.payload.template_name || action.payload.templateName || ''
  const selectedTemplate = selectedTemplateName
    ? metaTemplates.find(template => template.name === selectedTemplateName)
    : undefined
  const selectedTemplateBody = selectedTemplate?.components.find(component => component.type === 'BODY')?.text || ''
  const selectedTemplateVarCount = selectedTemplate ? detectTemplateVars(selectedTemplate.components) : 0
  const templatePreviewValues = Array.from({ length: selectedTemplateVarCount }, (_, valueIndex) => {
    const typedValue = (action.payload.variables || [])[valueIndex]
    if (typedValue) return typedValue

    const suggestedVariable = scheduledGuide?.suggestedVariables[valueIndex]
    if (suggestedVariable) return resolvePreviewVariable(suggestedVariable, previewContext)

    const fallbackValues = ['Maria Fernanda', 'Netflix Premium', '24/04/2026', '3']
    return fallbackValues[valueIndex] || `Dato ${valueIndex + 1}`
  })
  const resolvedTextPreview = at === 'send_text' && action.payload.message
    ? resolveVariables(action.payload.message, previewContext)
    : ''
  const renderedTemplatePreview = selectedTemplateBody
    ? renderTemplatePreview(selectedTemplateBody, templatePreviewValues)
    : ''

  const updatePayload = (key: string, value: TriggerActionPayloadValue) => {
    onUpdate(index, { payload: { ...action.payload, [key]: value } })
  }

  const insertVariable = (key: string, field: string) => {
    const current = action.payload[field] || ''
    updatePayload(field, current + key)
  }

  const applyTemplateSelection = (templateName: string) => {
    const template = metaTemplates.find(item => item.name === templateName)
    const varCount = template ? detectTemplateVars(template.components) : 0

    onUpdate(index, {
      payload: {
        ...action.payload,
        template_name: templateName,
        templateName: templateName,
        language: template?.language || 'es',
        variables: Array(varCount).fill(''),
      }
    })
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
        {(() => {
          const allItems = [...ACTION_CATEGORIES, ...ACTION_CATEGORIES_ADVANCED].flatMap(c => c.items)
          const found = allItems.find(i => i.value === at)
          return found?.desc ? <HelpTooltip text={found.desc} size={12} /> : null
        })()}
        {ADVANCED_ACTION_TYPES.includes(at) && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Avanzada
          </span>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">En simple</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{describeAction(action)}</p>
      </div>

      {/* ── send_text ── */}
      {at === 'send_text' && (
        <div className="space-y-2">
          {scheduledGuide && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                Salida recomendada para {scheduledGuide.label.toLowerCase()}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{scheduledGuide.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-200 bg-white px-2 py-1 text-[10px] font-medium text-sky-700">
                  Tono: {scheduledGuide.tone}
                </span>
                {scheduledGuide.suggestedVariables.map(variable => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable, 'message')}
                    className="rounded-full border border-sky-200 bg-white px-2 py-1 text-[10px] font-medium text-sky-700"
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          <div className="flex flex-wrap gap-2">
            {scheduledGuide?.textPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => updatePayload('message', preset.text)}
                className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[10px] font-medium text-sky-700"
              >
                {preset.label}
              </button>
            ))}
            {[
              'Hola. Estoy aqui para ayudarte con esto.',
              'Perfecto. Te comparto la informacion y si quieres te guio con el siguiente paso.',
              'Gracias por escribirnos. En un momento seguimos contigo.',
            ].map((preset, presetIndex) => (
              <button
                key={`${preset}-${presetIndex}`}
                type="button"
                onClick={() => updatePayload('message', preset)}
                className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
              >
                Texto sugerido
              </button>
            ))}
          </div>
          {scheduledGuide && resolvedTextPreview && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Asi sonaria con datos reales</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Vista previa para una clienta de ejemplo antes de activar la automatizacion.
              </p>
              <div className="mt-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm leading-relaxed text-[#0F172A]">
                {resolvedTextPreview}
              </div>
            </div>
          )}
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
          {scheduledGuide && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Que plantilla conviene aqui</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">{scheduledGuide.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{scheduledGuide.templateSummary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[10px] font-medium text-violet-700">
                  Busca una plantilla breve y facil de identificar
                </span>
                {scheduledGuide.suggestedVariables.map(variable => (
                  <span
                    key={variable}
                    className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[10px] font-medium text-violet-700"
                  >
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          )}
          {metaTemplates.length === 0 ? (
            <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              No tienes plantillas aprobadas en WhatsApp. Ve a Ajustes, configura tu cuenta de WhatsApp Business, y luego crea una plantilla desde la sección Plantillas.
            </p>
          ) : (
            <>
              {scheduledGuide && (
                <div className="rounded-xl border border-violet-100 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plantillas que encajan mejor</p>
                  {recommendedTemplates.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recommendedTemplates.map(template => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplateSelection(template.name)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                            (action.payload.template_name || action.payload.templateName) === template.name
                              ? 'border-violet-300 bg-violet-100 text-violet-700'
                              : 'border-violet-200 bg-violet-50 text-violet-700'
                          }`}
                        >
                          {template.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Aun no veo una plantilla claramente orientada a {scheduledGuide.label.toLowerCase()}. Puedes elegir cualquiera abajo, pero te conviene una que mencione renovacion, recordatorio o vencimiento.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Plantilla aprobada *</Label>
                <Select
                  value={action.payload.template_name || action.payload.templateName || ''}
                  onValueChange={applyTemplateSelection}
                >
                  <SelectTrigger className="bg-[#F7F8FA] border-black/[0.08] text-xs">
                    <SelectValue placeholder="Selecciona una plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rankedTemplates.map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.name}>
                        <span className="font-mono text-xs">{tpl.name}</span>
                        <span className="text-slate-500 text-xs ml-2">{tpl.language}</span>
                        {tpl.matchScore > 0 && (
                          <span className="ml-2 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                            Recomendado
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplateBody && (
                <div className="p-3 rounded-lg bg-[#F7F8FA] text-xs text-slate-500 font-mono whitespace-pre-wrap">
                  {selectedTemplateBody}
                </div>
              )}

              {scheduledGuide && renderedTemplatePreview && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Vista previa con datos de ejemplo</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Asi veria esta salida una clienta con renovacion pendiente antes de enviar la plantilla real.
                  </p>
                  <div className="mt-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm leading-relaxed text-[#0F172A]">
                    {renderedTemplatePreview}
                  </div>
                </div>
              )}

              {selectedTemplateVarCount > 0 && (
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
                  {Array.from({ length: selectedTemplateVarCount }).map((_, vi) => (
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
            <div className="flex flex-wrap gap-2">
              {[
                'Elige la opcion que mejor describe lo que necesitas.',
                'Estoy aqui para ayudarte. Toca una opcion para seguir.',
                'Para avanzar mas rapido, elige una de estas opciones.',
              ].map((preset, presetIndex) => (
                <button
                  key={`${preset}-${presetIndex}`}
                  type="button"
                  onClick={() => updatePayload('body', preset)}
                  className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                >
                  Texto sugerido
                </button>
              ))}
            </div>
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
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: 'Precio / Horarios / Soporte',
                  buttons: [
                    { id: 'btn1', title: 'Precio' },
                    { id: 'btn2', title: 'Horarios' },
                    { id: 'btn3', title: 'Soporte' },
                  ],
                },
                {
                  label: 'Renovar / Pagar / Asesor',
                  buttons: [
                    { id: 'btn1', title: 'Renovar' },
                    { id: 'btn2', title: 'Pagar' },
                    { id: 'btn3', title: 'Hablar con asesor' },
                  ],
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updatePayload('buttons', preset.buttons)}
                  className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {(action.payload.buttons || []).map((btn, bi) => (
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
                    const btns = (action.payload.buttons || []).filter((_, i) => i !== bi)
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
          <Label className="text-xs text-slate-400">Etiqueta</Label>
          <TagAutocomplete
            value={action.payload.tag ? [action.payload.tag] : []}
            onChange={tags => updatePayload('tag', tags[tags.length - 1] || '')}
            placeholder="Ej: vip, pagado, seguimiento"
            singleValue
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
            <Label className="text-xs text-slate-400">Campo</Label>
            {customFieldDefs.length > 0 ? (
              <Select
                value={action.payload.field_name || ''}
                onValueChange={v => updatePayload('field_name', v)}
              >
                <SelectTrigger className="h-9 bg-[#F7F8FA] border-black/[0.08] text-xs mt-1">
                  <SelectValue placeholder="Seleccionar campo" />
                </SelectTrigger>
                <SelectContent>
                  {customFieldDefs.map(f => (
                    <SelectItem key={f.field_name} value={f.field_name}>
                      {f.description || f.field_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-9 text-xs bg-[#F7F8FA] border-black/[0.08] mt-1"
                placeholder="ej: tier, region"
                value={action.payload.field_name || ''}
                onChange={e => updatePayload('field_name', e.target.value)}
              />
            )}
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
            <div className="flex flex-wrap gap-2">
              {['Cliente necesita soporte', 'Seguimiento pendiente', 'Pago reportado'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updatePayload('title', preset)}
                  className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                >
                  {preset}
                </button>
              ))}
            </div>
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
            <div className="flex flex-wrap gap-2">
              {[
                'Revisa esta conversacion porque el cliente pidio ayuda.',
                'El cliente respondio y necesita seguimiento manual.',
                'Se detecto una oportunidad para cerrar venta.',
              ].map((preset, presetIndex) => (
                <button
                  key={`${preset}-${presetIndex}`}
                  type="button"
                  onClick={() => updatePayload('message', preset)}
                  className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                >
                  Mensaje sugerido
                </button>
              ))}
            </div>
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
        <div className="pt-3 mt-3 border-t border-black/[0.06]">
          <button
            type="button"
            onClick={() => setShowTimingOptions(!showTimingOptions)}
            className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"
          >
            <Clock size={12} className="text-slate-400" />
            Ajustes de tiempo
            {showTimingOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showTimingOptions && (
            <div className="mt-2 flex items-center gap-2">
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
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TriggerBuilder({ assistantId, triggerId, initialTemplate }: TriggerBuilderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(!!triggerId && !initialTemplate)
  const [showConditionsSection, setShowConditionsSection] = useState(false)
  const [showConditionPicker, setShowConditionPicker] = useState(false)
  const [showActionPicker, setShowActionPicker] = useState(false)

  // Trigger form
  const [name, setName] = useState(!triggerId && initialTemplate ? initialTemplate.name : '')
  const [type, setType] = useState<TriggerType>(!triggerId && initialTemplate ? initialTemplate.type : 'logic')
  const [description, setDescription] = useState(!triggerId && initialTemplate ? initialTemplate.description : '')
  const [timeMinutes, setTimeMinutes] = useState(!triggerId && initialTemplate?.type === 'time' && initialTemplate.timeMinutes ? initialTemplate.timeMinutes : '30')
  const [flows, setFlows] = useState<ConversationFlow[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState('')
  const conditionsLogic = 'AND' as const
  const [conditions, setConditions] = useState<TriggerCondition[]>(() => getInitialConditions(triggerId, initialTemplate))
  const [actions, setActions] = useState<TriggerAction[]>(() => getInitialActions(triggerId, initialTemplate))
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(() => getInitialScheduleConfig(triggerId, initialTemplate))

  const [customFieldDefs, setCustomFieldDefs] = useState<{ field_name: string; description: string | null }[]>([])
  const triggerTypeCopy: Record<TriggerType, string> = {
    logic: 'Se activa por una situacion o mensaje del cliente',
    time: 'Se activa despues de un tiempo sin respuesta',
    flow: 'Se activa para iniciar una conversacion guiada',
    scheduled: 'Se activa en una fecha o recordatorio programado',
  }

  const applyRecipe = (recipe: TriggerRecipe) => {
    setName(recipe.name)
    setType(recipe.type)
    setDescription(recipe.triggerDescription)
    if (recipe.timeMinutes) setTimeMinutes(recipe.timeMinutes)
    setConditions(recipe.conditions)
    setActions(recipe.actions)
  }

  // Load flows + templates + custom fields
  useEffect(() => {
    getFlows().then(setFlows)
    fetch('/api/meta-templates').then(r => r.json()).then(d => {
      if (d.templates) setMetaTemplates(d.templates.filter((t: MetaTemplate) => t.status === 'APPROVED'))
    }).catch(() => {})
    fetch('/api/custom-fields').then(r => r.json()).then(d => setCustomFieldDefs(d.fields || [])).catch(() => {})
  }, [])

  // Load existing trigger
  useEffect(() => {
    if (triggerId) {
      getTrigger(triggerId).then(rawData => {
        const data = rawData as LoadedTrigger | null
        if (data) {
          setName(data.name)
          setType(data.type as TriggerType)
          if (data.type === 'time') setTimeMinutes(data.description || '30')
          else if (data.type === 'flow') setSelectedFlowId(data.description || '')
          else if (data.type === 'scheduled') {
            try { setScheduleConfig(JSON.parse(data.description || '{}')) } catch {}
          } else setDescription(data.description || '')
          setActions((data.trigger_actions || []).map(a => ({
            ...a,
            type: a.type as ActionType,
            payload: a.payload || {},
            delay_seconds: a.delay_seconds || 0,
          })))
          setConditions((data.trigger_conditions || []).map(normalizeLegacyCondition))
        }
        setIsLoading(false)
      })
    }
  }, [triggerId])

  // Auto-open conditions section when conditions are loaded or added
  useEffect(() => {
    if (conditions.length > 0) setShowConditionsSection(true)
  }, [conditions.length])

  // Smart defaults: pre-populate an action when trigger type is selected
  useEffect(() => {
    if (triggerId || actions.length > 0) return
    if (type === 'time') {
      setActions([{ type: 'send_text', payload: { message: '' }, delay_seconds: 0 }])
    } else if (type === 'scheduled') {
      setActions([{ type: 'send_template', payload: { template_name: '', language: 'es', variables: [] }, delay_seconds: 0 }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

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
      } catch (error: unknown) {
        console.error('[TriggerBuilder] Save error:', error)
        const msg = error instanceof Error ? error.message : String(error || 'Error desconocido')
        alert(`Error al guardar la automatización:\n\n${msg}`)
      }
    })
  }

  // ── Loading skeleton ──

  const basicReady = name.trim().length > 0
  const activationReady = (
    (type === 'logic' && description.trim().length > 0) ||
    (type === 'time' && Boolean(timeMinutes) && parseInt(timeMinutes) > 0) ||
    (type === 'flow' && Boolean(selectedFlowId)) ||
    (type === 'scheduled' && (scheduleConfig.audience_type === 'all' || Boolean(scheduleConfig.audience_value)))
  )
  const actionsReady = actions.length > 0
  const scheduledHasTemplateAction = actions.some(action => action.type === 'send_template')
  const responseActionIndex = actions.findIndex(action =>
    ['send_text', 'send_template', 'send_interactive', 'send_text_ai', 'start_flow'].includes(action.type)
  )
  const responseAction = responseActionIndex >= 0 ? actions[responseActionIndex] : null
  const followupActions = actions.filter((_, index) => index !== responseActionIndex)
  const responseReady = responseActionIndex >= 0
  const followupReady = followupActions.length > 0
  const reviewReady = basicReady && activationReady && actionsReady
  const reviewScheduledGuide = type === 'scheduled' ? SCHEDULED_MESSAGE_GUIDES[scheduleConfig.send_days] : null
  const reviewPreviewContext = type === 'scheduled' ? getScheduledPreviewContext(scheduleConfig.send_days) : null
  const reviewTemplateAction = actions.find(action => action.type === 'send_template') || null
  const reviewTemplate = reviewTemplateAction
    ? metaTemplates.find(template => template.name === (reviewTemplateAction.payload.template_name || reviewTemplateAction.payload.templateName || ''))
    : null
  const reviewTemplateVarCount = reviewTemplate ? detectTemplateVars(reviewTemplate.components) : 0
  const reviewTemplatePreviewValues = Array.from({ length: reviewTemplateVarCount }, (_, valueIndex) => {
    const typedValue = (reviewTemplateAction?.payload.variables || [])[valueIndex]
    if (typedValue) return typedValue

    const suggestedVariable = reviewScheduledGuide?.suggestedVariables[valueIndex]
    if (suggestedVariable && reviewPreviewContext) {
      return resolvePreviewVariable(suggestedVariable, reviewPreviewContext)
    }

    const fallbackValues = ['Maria Fernanda', 'Netflix Premium', '24/04/2026', '3']
    return fallbackValues[valueIndex] || `Dato ${valueIndex + 1}`
  })
  const responseTextSource =
    responseAction?.type === 'send_text'
      ? String(responseAction.payload.message || '')
      : responseAction?.type === 'send_interactive'
        ? String(responseAction.payload.body || '')
        : responseAction?.type === 'send_template'
          ? (reviewTemplate?.components.find(component => component.type === 'BODY')?.text || '')
          : ''
  const responsePreviewText = responseAction?.type === 'send_template'
    ? renderTemplatePreview(responseTextSource, reviewTemplatePreviewValues)
    : reviewPreviewContext
      ? resolveVariables(responseTextSource, reviewPreviewContext)
      : responseTextSource
  const responsePreviewLower = responsePreviewText.toLowerCase()
  const responseHasClearCTA = /renov|ayud|continu|respond|escrib|elige|toca|confirm|paga|pago|retoma/i.test(responsePreviewText)
  const responseSoundsUrgent = /urgente|ultimo|ultima|hoy|ahora mismo|final/i.test(responsePreviewLower)
  const responseWordCount = responsePreviewText.trim().split(/\s+/).filter(Boolean).length
  const stateChangeActionsCount = actions.filter(action =>
    ['add_tag', 'remove_tag', 'set_status', 'update_field'].includes(action.type)
  ).length
  const stopSignalsConfigured = conditions.some(condition =>
    ['not_tag', 'subscription_status', 'expiration_days'].includes(condition.condition_type)
  ) || stateChangeActionsCount > 0
  const toneMatchesMoment = type !== 'scheduled'
    ? true
    : scheduleConfig.send_days === 'expiration'
      ? /vence|hoy|renov|continu/i.test(responsePreviewText)
      : scheduleConfig.send_days === 'daily'
        ? !responseSoundsUrgent
        : true
  const templateFitsMoment = type !== 'scheduled'
    ? true
    : !reviewTemplate || getTemplateMatchScore(reviewTemplate, scheduleConfig.send_days) > 0
  const repetitionFeelsControlled = type !== 'scheduled'
    ? true
    : scheduleConfig.send_days !== 'daily' || stopSignalsConfigured
  const firstCondition = conditions[0]
  const firstAction = actions[0]
  const nextStepMessage = !basicReady
    ? 'Ponle un nombre facil de reconocer.'
    : !activationReady
      ? 'Ahora define claramente cuando debe activarse.'
      : !actionsReady
        ? 'El siguiente paso es decirle al bot que debe hacer.'
        : 'Ya tienes la base. Revisa el mensaje principal y guarda.'
  const triggerSummary = [
    {
      title: 'Nombre interno',
      value: basicReady ? name : 'Todavia sin nombre',
      tone: basicReady ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-[#F7F8FA] border-black/[0.06]',
    },
    {
      title: 'Como se activa',
      value: triggerTypeCopy[type],
      tone: activationReady ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      title: 'Primera regla',
      value: firstCondition ? CONDITION_LABELS[firstCondition.condition_type] : 'Sin regla extra. Se guiara solo por el tipo de activacion.',
      tone: firstCondition ? 'text-cyan-700 bg-cyan-50 border-cyan-200' : 'text-slate-500 bg-[#F7F8FA] border-black/[0.06]',
    },
    {
      title: 'Primera accion',
      value: firstAction ? ACTION_LABELS[firstAction.type] : 'Todavia no definiste que hara el bot.',
      tone: actionsReady ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
    },
  ]
  const activationChecklist = [
    { label: 'Nombre claro', ok: basicReady },
    { label: 'Activacion definida', ok: activationReady },
    { label: 'Accion configurada', ok: actionsReady },
  ]
  const automationFlowSummary = [
    {
      title: '1. Que la activa',
      value: activationReady
        ? (type === 'logic'
          ? description
          : type === 'time'
            ? `Despues de ${timeMinutes || '?'} minutos sin respuesta.`
            : type === 'flow'
              ? 'Cuando deba iniciar una conversacion guiada.'
              : 'En una fecha o recordatorio programado.')
        : 'Todavia falta definir claramente el disparador.',
      tone: activationReady ? 'text-red-700 bg-red-50 border-red-200' : 'text-slate-500 bg-[#F7F8FA] border-black/[0.06]',
    },
    {
      title: '2. Que responde primero',
      value: responseAction
        ? describeAction(responseAction)
        : 'Todavia no definiste la respuesta principal del bot.',
      tone: responseReady ? 'text-green-700 bg-green-50 border-green-200' : 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      title: '3. Que hace despues',
      value: followupReady
        ? `${followupActions.length} paso(s) extra para seguimiento, clasificacion o pausa.`
        : 'No hay pasos extra. Puede bastar si solo quieres una respuesta simple.',
      tone: followupReady ? 'text-cyan-700 bg-cyan-50 border-cyan-200' : 'text-slate-500 bg-[#F7F8FA] border-black/[0.06]',
    },
    {
      title: '4. Antes de activar',
      value: reviewReady
        ? 'Ya puedes revisar el resultado final y guardar.'
        : 'Completa los bloques principales antes de activarla.',
      tone: reviewReady ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
    },
  ]
  const reviewChecklist = [
    { label: 'Tiene una razon clara para activarse', ok: activationReady },
    { label: 'Tiene una respuesta principal', ok: responseReady },
    { label: 'Tiene seguimiento o cierre', ok: followupReady || actionsReady },
    ...(type === 'scheduled' ? [{ label: 'Usa plantilla aprobada para salir de 24h', ok: scheduledHasTemplateAction }] : []),
    { label: 'Lista para revisar y guardar', ok: reviewReady },
  ]
  const reviewScenarios = [
    activationReady
      ? `Escenario 1: ${type === 'logic' ? 'el cliente escribe algo parecido a tu descripcion' : type === 'time' ? `pasan ${timeMinutes || '?'} minutos sin respuesta` : type === 'scheduled' ? 'llega el dia programado' : 'se inicia el flujo elegido'}.`
      : 'Escenario 1: todavia falta definir con claridad cuando se activa.',
    responseReady
      ? 'Escenario 2: revisa si la primera respuesta suena natural y va directo al punto.'
      : 'Escenario 2: agrega primero un mensaje, plantilla, botones o flujo de respuesta.',
    followupReady
      ? 'Escenario 3: confirma que los pasos extra no insistan de mas y realmente ayuden.'
      : 'Escenario 3: si quieres mas control, agrega una etiqueta, aviso interno o pausa.',
  ]
  const humanChecks = [
    {
      title: 'La salida se entiende facil',
      ok: responseReady && responseHasClearCTA && responseWordCount <= 40,
      detail: !responseReady
        ? 'Aun falta una respuesta principal clara.'
        : !responseHasClearCTA
          ? 'El mensaje suena correcto, pero aun no deja una salida clara para renovar, responder o continuar.'
          : responseWordCount > 40
            ? 'El mensaje ya se entiende, pero esta algo largo para una automatizacion.'
            : 'La salida es clara y deja al cliente saber que puede hacer despues.',
    },
    ...(type === 'scheduled' ? [
      {
        title: 'El tono coincide con el momento',
        ok: toneMatchesMoment,
        detail: toneMatchesMoment
          ? `El mensaje suena alineado con ${reviewScheduledGuide?.label.toLowerCase()}.`
          : scheduleConfig.send_days === 'expiration'
            ? 'Para un vencimiento de hoy conviene ser un poco mas directo con la renovacion.'
            : 'Para un seguimiento diario conviene bajar la urgencia para no sentirse insistente.',
      },
      {
        title: 'La plantilla coincide con el caso',
        ok: templateFitsMoment,
        detail: !reviewTemplate
          ? 'No hay plantilla seleccionada todavia para revisar esta parte.'
          : templateFitsMoment
            ? 'La plantilla elegida parece coherente con este momento de la renovacion.'
            : 'La plantilla elegida no se ve tan alineada con este escenario. Te conviene una que hable de recordatorio, renovacion o vencimiento.',
      },
      {
        title: 'No parece insistente de mas',
        ok: repetitionFeelsControlled,
        detail: repetitionFeelsControlled
          ? 'La automatizacion ya tiene alguna senal para no repetir siempre igual.'
          : 'Si esto corre a diario, te conviene agregar una etiqueta, cambio de estado o condicion de corte para no insistir de mas.',
      },
    ] : []),
  ]

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
            <p className="text-slate-400 text-sm">Configura qué hace tu bot automáticamente</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <Save size={16} />
          {isPending ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      {/* ── Progress Stepper ── */}
      {!triggerId && (
        <div className="mb-6 rounded-lg border border-black/[0.08] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Crear rapido</p>
              <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Elige una receta y ajusta solo lo necesario</h2>
              <p className="mt-1 text-sm text-slate-500">
                Esto arma el nombre, la activacion y las acciones base. Luego puedes editar el texto antes de guardar.
              </p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-[#F7F8FA] px-3 py-2 text-xs font-semibold text-slate-500">
              Ideal para usuarios no tecnicos
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TRIGGER_RECIPES.map(recipe => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => applyRecipe(recipe)}
                className="rounded-lg border border-black/[0.07] bg-[#F7F8FA] p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-md bg-white p-1.5 text-emerald-700">
                    {recipe.type === 'time' ? <Clock size={14} /> : recipe.id === 'support' ? <AlertCircle size={14} /> : <Zap size={14} />}
                  </span>
                  <p className="text-sm font-bold text-[#0F172A]">{recipe.title}</p>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">{recipe.description}</p>
                <p className="mt-3 text-[11px] font-semibold text-emerald-700">{recipe.result}</p>
              </button>
            ))}
          </div>
        </div>
      )}

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
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      'Cuando un cliente pregunta por precio o planes',
                      'Cuando un cliente pide ayuda o reporta un problema',
                      'Cuando un cliente envia un comprobante de pago',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDescription(preset)}
                        className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                      >
                        Texto sugerido
                      </button>
                    ))}
                  </div>
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
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['15', '30', '60', '120', '1440'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTimeMinutes(preset)}
                        className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                      >
                        {preset === '1440' ? '1 dia' : `${preset} min`}
                      </button>
                    ))}
                  </div>
                </div>
              )}


              {type === 'scheduled' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex gap-2 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400">
                    <Calendar size={13} className="shrink-0 mt-0.5" />
                    <span>Se ejecuta automáticamente una vez al día. En la sección &quot;¿Qué hace?&quot; agrega una <strong>Plantilla de WhatsApp</strong>.</span>
                  </div>
                  <div className="rounded-lg border border-black/[0.06] bg-[#F7F8FA] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Programaciones comunes</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { label: 'El mismo dia', config: { send_days: 'expiration', audience_type: 'all', audience_value: '' } },
                        { label: '1 dia antes', config: { send_days: '1_day_before', audience_type: 'all', audience_value: '' } },
                        { label: '3 dias antes', config: { send_days: '3_days_before', audience_type: 'all', audience_value: '' } },
                        { label: 'Todos los dias', config: { send_days: 'daily', audience_type: 'all', audience_value: '' } },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setScheduleConfig(prev => ({ ...prev, ...preset.config } as ScheduleConfig))}
                          className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduleConfig(prev => ({ ...prev, audience_type: 'all', audience_value: '' }))}
                        className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleConfig(prev => ({ ...prev, audience_type: 'service', audience_value: prev.audience_value || 'NETFLIX' }))}
                        className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                      >
                        Por servicio
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleConfig(prev => ({ ...prev, audience_type: 'tag', audience_value: prev.audience_value || 'VIP' }))}
                        className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                      >
                        Por etiqueta
                      </button>
                    </div>
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
                    <div className="space-y-2">
                      <Input
                        className="bg-[#F7F8FA] border-black/[0.08] text-sm"
                        placeholder="Ej: VIP, CLIENTE_ACTIVO"
                        value={scheduleConfig.audience_value}
                        onChange={e => setScheduleConfig(prev => ({ ...prev, audience_value: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        {['VIP', 'CLIENTE_ACTIVO', 'RENOVACION_PENDIENTE'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setScheduleConfig(prev => ({ ...prev, audience_value: preset }))}
                            className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { label: 'Vence hoy', value: 'expiration' },
                        { label: '1 dia antes', value: '1_day_before' },
                        { label: '3 dias antes', value: '3_days_before' },
                        { label: '7 dias antes', value: '7_days_before' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setScheduleConfig(prev => ({ ...prev, send_days: preset.value as ScheduleConfig['send_days'] }))}
                          className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
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
              <p className="text-[10px] text-slate-400 mb-3">Usa el botón &quot;+ Insertar dato&quot; en cualquier mensaje para agregarlos automáticamente.</p>
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

        {/* ── RIGHT: Conditions (collapsible) + Actions ── */}
        <div className="lg:col-span-8 space-y-4">

          {/* ── COLLAPSIBLE CONDITIONS SECTION ── */}
          <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowConditionsSection(prev => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F7F8FA] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <span className="text-sm font-medium text-[#0F172A]">Filtros opcionales</span>
                {conditions.length > 0 && (
                  <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{conditions.length}</span>
                )}
                <span className="text-xs text-slate-400 hidden sm:inline">— solo si necesitas más precisión</span>
              </div>
              {showConditionsSection ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showConditionsSection && (
              <div className="px-5 pb-5 pt-4 space-y-4 border-t border-black/[0.06] animate-in fade-in slide-in-from-top-2">
                <p className="text-xs text-slate-500 leading-relaxed">
                  El tipo de activación ya define cuándo corre. Agrega filtros solo si quieres ser más específico: por ejemplo, que solo corra para clientes con cierta etiqueta o en ciertos días.
                </p>

                {showConditionPicker && (
                  <CardPickerModal
                    title="¿Qué condición quieres agregar?"
                    categories={CONDITION_CATEGORIES}
                    advancedCategories={CONDITION_CATEGORIES_ADVANCED}
                    onSelect={v => addCondition(v as ConditionType)}
                    onClose={() => setShowConditionPicker(false)}
                  />
                )}

                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-[#0F172A]">Filtros activos</h3>
                  <Button
                    type="button"
                    onClick={() => setShowConditionPicker(true)}
                    className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs gap-1.5 rounded-lg"
                  >
                    <Plus size={13} /> Agregar filtro
                  </Button>
                </div>

                {conditions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-black/[0.06] rounded-xl">
                    <Filter className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-slate-500 font-medium text-sm">Sin filtros — y está bien así</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">La automatización ya funciona con el tipo elegido.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        { type: 'text_contains' as ConditionType, label: '💬 Detectar palabras clave' },
                        { type: 'has_tag' as ConditionType, label: '🏷️ Si tiene etiqueta' },
                        { type: 'day_of_week' as ConditionType, label: '📅 Solo ciertos días' },
                      ].map(s => (
                        <button
                          key={s.type}
                          type="button"
                          onClick={() => addCondition(s.type)}
                          className="px-3 py-1.5 rounded-full border border-black/[0.06] bg-[#F7F8FA] text-xs font-medium text-slate-600 hover:border-red-300 transition-colors"
                        >
                          {s.label}
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
                          customFieldDefs={customFieldDefs}
                          onUpdate={updateCondition}
                          onRemove={removeCondition}
                        />
                        {index < conditions.length - 1 && (
                          <div className="flex items-center justify-center py-2">
                            <span className="text-[10px] font-bold px-3 py-1 rounded-full border bg-red-50 text-red-400 border-red-200">
                              Y también...
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── ACTIONS SECTION ── */}
          <div className="space-y-4">
            <div className="rounded-xl border border-green-100 bg-green-50/60 px-4 py-3">
              <p className="text-sm font-semibold text-[#0F172A]">Define primero la respuesta principal</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Lo mas amigable suele ser responder con un mensaje corto o iniciar un flujo. Las etiquetas y acciones extra vienen despues.
              </p>
            </div>

            {type === 'scheduled' && (
              <div className={`rounded-xl border px-4 py-3 ${
                scheduledHasTemplateAction ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'
              }`}>
                <p className="text-sm font-semibold text-[#0F172A]">En programadas, la salida ideal es una plantilla aprobada</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Asi evitas problemas con la ventana de 24 horas en recordatorios, renovaciones y avisos de vencimiento.
                </p>
                {!scheduledHasTemplateAction && (
                  <button
                    type="button"
                    onClick={() => addAction('send_template')}
                    className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] font-semibold text-amber-700"
                  >
                    Agregar plantilla aprobada
                  </button>
                )}
              </div>
            )}

            {/* Action Picker Modal */}
            {showActionPicker && (
              <CardPickerModal
                title="¿Qué quieres que haga el bot?"
                categories={ACTION_CATEGORIES}
                advancedCategories={ACTION_CATEGORIES_ADVANCED}
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
                    customFieldDefs={customFieldDefs}
                    triggerType={type}
                    scheduleConfig={type === 'scheduled' ? scheduleConfig : undefined}
                    onUpdate={updateAction}
                    onRemove={removeAction}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
