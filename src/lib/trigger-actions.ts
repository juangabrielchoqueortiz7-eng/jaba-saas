/**
 * Trigger Actions Executor
 *
 * Sistema profesional de ejecución de acciones para disparadores.
 * Soporta 12+ tipos de acciones con patrón Factory para extensibilidad.
 *
 * Tipos de acciones:
 *  Mensaje:   send_text, send_text_ai, send_media, send_template, send_interactive
 *  Metadata:  add_tag, remove_tag, set_status, update_field
 *  Admin:     notify_admin, notify_webhook
 *  Flow:      start_flow
 *  Control:   pause
 */

import { createClient } from '@supabase/supabase-js'
import { resolveVariables, VariableContext } from './trigger-variables'

// ── Setup Supabase Admin ──────────────────────────────────────────────────

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ActionType =
  // Mensaje
  | 'send_text'             // Texto plano con variables
  | 'send_text_ai'          // Respuesta generada por IA
  | 'send_media'            // Imagen, video, documento
  | 'send_template'         // Plantilla Meta aprobada
  | 'send_interactive'      // Botones o listas interactivas
  // Metadata del chat
  | 'add_tag'               // Agregar etiqueta al chat
  | 'remove_tag'            // Remover etiqueta del chat
  | 'set_status'            // Cambiar estado (lead/customer/closed)
  | 'update_field'          // Actualizar campo personalizado
  // Admin
  | 'notify_admin'          // Notificar al administrador
  | 'notify_webhook'        // POST a webhook externo (CRM, Slack, etc.)
  // Flow / Control
  | 'start_flow'            // Iniciar flujo conversacional
  | 'pause'                 // Pausa entre acciones
  // Legacy (backward compat)
  | 'send_message'
  | 'send_meta_template'
  | 'toggle_bot'
  | 'update_status'

export interface ActionContext {
  // Identificadores
  chatId: string
  phoneNumber: string
  tenantUserId: string

  // Datos del contacto
  contactName: string
  chatStatus?: string
  chatTags?: string[]
  chatCustomFields?: Record<string, any>

  // Credenciales WhatsApp
  tenantToken: string
  tenantPhoneId: string
  tenantName?: string
  tenantServiceName?: string

  // Datos de la suscripción
  subscriptionService?: string
  subscriptionEmail?: string
  subscriptionExpiresAt?: Date | string
  subscriptionStatus?: string

  // Mensaje entrante
  messageText?: string
  messageTimestamp?: Date
}

export interface ActionResult {
  success: boolean
  actionType: ActionType
  message?: string
  error?: string
  executedAt: Date
  durationMs?: number
}

// ── Interface Base ────────────────────────────────────────────────────────

export interface ActionExecutor {
  readonly type: ActionType
  validate(payload: Record<string, any>): { valid: boolean; error?: string }
  execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult>
}

// ── Helper: Context → VariableContext ─────────────────────────────────────

function contextToVariableContext(context: ActionContext): VariableContext {
  return {
    contactName: context.contactName,
    phoneNumber: context.phoneNumber,
    chatId: context.chatId,
    chatStatus: context.chatStatus,
    chatTags: context.chatTags,
    chatCustomFields: context.chatCustomFields,
    subscriptionService: context.subscriptionService,
    subscriptionEmail: context.subscriptionEmail,
    subscriptionExpiresAt: context.subscriptionExpiresAt,
    subscriptionStatus: context.subscriptionStatus,
    messageText: context.messageText,
    messageTimestamp: context.messageTimestamp,
    tenantName: context.tenantName,
    tenantServiceName: context.tenantServiceName,
  }
}

// Helper para guardar mensaje en BD
async function saveMessageToDB(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  chatId: string,
  content: string,
  messageType = 'text'
) {
  try {
    await supabase.from('messages').insert({
      chat_id: chatId,
      is_from_me: true,
      content,
      message_type: messageType,
      status: 'delivered',
    })
    await supabase.from('chats').update({
      last_message: content.substring(0, 100),
      last_message_time: new Date().toISOString(),
    }).eq('id', chatId)
  } catch (err) {
    console.error('[TriggerActions] Error saving message to DB:', err)
  }
}

// ── Action Implementations ────────────────────────────────────────────────

// ─── send_text ─────────────────────────────────────────────────────────────
class SendTextAction implements ActionExecutor {
  readonly type: ActionType = 'send_text'

  validate(payload: Record<string, any>) {
    if (!payload.message && !payload.text) {
      return { valid: false, error: 'Se requiere el campo "message"' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const { sendWhatsAppMessage } = await import('@/lib/whatsapp')
      const supabase = getSupabaseAdmin()
      const vars = contextToVariableContext(context)

      const rawMessage = payload.message || payload.text || ''
      const message = resolveVariables(rawMessage, vars)

      await sendWhatsAppMessage(context.phoneNumber, message, context.tenantToken, context.tenantPhoneId)

      if (context.chatId) {
        await saveMessageToDB(supabase, context.chatId, message)
      }

      return { success: true, actionType: this.type, message: `Texto enviado: "${message.substring(0, 60)}"`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── send_text_ai ──────────────────────────────────────────────────────────
class SendTextAIAction implements ActionExecutor {
  readonly type: ActionType = 'send_text_ai'

  validate(payload: Record<string, any>) {
    if (!payload.instruction) {
      return { valid: false, error: 'Se requiere el campo "instruction" con la instrucción para la IA' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const { generateAIResponse } = await import('@/lib/ai')
      const { sendWhatsAppMessage } = await import('@/lib/whatsapp')
      const supabase = getSupabaseAdmin()
      const vars = contextToVariableContext(context)

      const instruction = resolveVariables(payload.instruction, vars)
      const extraContext = payload.context ? resolveVariables(payload.context, vars) : ''

      const systemPrompt = `${instruction}${extraContext ? `\n\nContexto adicional: ${extraContext}` : ''}`
      const userMessage = context.messageText || 'Hola'

      const aiResponse = await generateAIResponse(userMessage, systemPrompt)
      const finalMessage = resolveVariables(aiResponse, vars)

      await sendWhatsAppMessage(context.phoneNumber, finalMessage, context.tenantToken, context.tenantPhoneId)

      if (context.chatId) {
        await saveMessageToDB(supabase, context.chatId, finalMessage)
      }

      return { success: true, actionType: this.type, message: `IA respondió con: "${finalMessage.substring(0, 60)}"`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── send_media ────────────────────────────────────────────────────────────
class SendMediaAction implements ActionExecutor {
  readonly type: ActionType = 'send_media'

  validate(payload: Record<string, any>) {
    if (!payload.url) {
      return { valid: false, error: 'Se requiere el campo "url" con la URL del archivo' }
    }
    if (!payload.type || !['image', 'video', 'document', 'audio'].includes(payload.type)) {
      return { valid: false, error: 'El campo "type" debe ser: image, video, document o audio' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const { sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppMessage } = await import('@/lib/whatsapp')
      const supabase = getSupabaseAdmin()
      const vars = contextToVariableContext(context)

      const url = resolveVariables(payload.url, vars)
      const caption = payload.caption ? resolveVariables(payload.caption, vars) : undefined
      const mediaType = payload.type as 'image' | 'video' | 'document' | 'audio'

      if (mediaType === 'image') {
        await sendWhatsAppImage(context.phoneNumber, url, caption, context.tenantToken, context.tenantPhoneId)
      } else if (mediaType === 'video') {
        await sendWhatsAppVideo(context.phoneNumber, url, caption, context.tenantToken, context.tenantPhoneId)
      } else {
        // Fallback: send URL as text with caption
        const msg = caption ? `${caption}\n${url}` : url
        await sendWhatsAppMessage(context.phoneNumber, msg, context.tenantToken, context.tenantPhoneId)
      }

      if (context.chatId) {
        await saveMessageToDB(supabase, context.chatId, caption || `[${mediaType}]`, mediaType)
      }

      return { success: true, actionType: this.type, message: `Media (${mediaType}) enviado`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── send_template ─────────────────────────────────────────────────────────
class SendTemplateAction implements ActionExecutor {
  readonly type: ActionType = 'send_template'

  validate(payload: Record<string, any>) {
    if (!payload.template_name && !payload.templateName) {
      return { valid: false, error: 'Se requiere "template_name"' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')
      const vars = contextToVariableContext(context)

      const templateName = payload.template_name || payload.templateName
      const language = payload.language || 'es'
      const variables: string[] = (payload.variables || []).map((v: string) => resolveVariables(v, vars))

      const components: any[] = variables.length > 0 ? [{
        type: 'body',
        parameters: variables.map((v: string) => ({ type: 'text', text: v || ' ' }))
      }] : []

      await sendWhatsAppTemplate(context.phoneNumber, templateName, language, components, context.tenantToken, context.tenantPhoneId)

      return { success: true, actionType: this.type, message: `Template "${templateName}" enviado`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── send_interactive ──────────────────────────────────────────────────────
class SendInteractiveAction implements ActionExecutor {
  readonly type: ActionType = 'send_interactive'

  validate(payload: Record<string, any>) {
    if (!payload.body) {
      return { valid: false, error: 'Se requiere el campo "body" con el texto del mensaje' }
    }
    if (!payload.buttons && !payload.sections) {
      return { valid: false, error: 'Se requiere "buttons" (para botones) o "sections" (para lista)' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const { sendWhatsAppButtons, sendWhatsAppList } = await import('@/lib/whatsapp')
      const supabase = getSupabaseAdmin()
      const vars = contextToVariableContext(context)

      const body = resolveVariables(payload.body, vars)

      if (payload.buttons) {
        await sendWhatsAppButtons(context.phoneNumber, body, payload.buttons, context.tenantToken, context.tenantPhoneId)
        if (context.chatId) {
          await saveMessageToDB(supabase, context.chatId, body + '\n[Botones enviados]')
        }
      } else if (payload.sections) {
        const buttonText = payload.button_text || payload.buttonText || 'Ver opciones'
        await sendWhatsAppList(context.phoneNumber, body, buttonText, payload.sections, context.tenantToken, context.tenantPhoneId)
        if (context.chatId) {
          await saveMessageToDB(supabase, context.chatId, body + '\n[Lista interactiva enviada]')
        }
      }

      return { success: true, actionType: this.type, message: 'Mensaje interactivo enviado', executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── add_tag ───────────────────────────────────────────────────────────────
class AddTagAction implements ActionExecutor {
  readonly type: ActionType = 'add_tag'

  validate(payload: Record<string, any>) {
    if (!payload.tag) {
      return { valid: false, error: 'Se requiere el campo "tag"' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const supabase = getSupabaseAdmin()
      const tag = payload.tag.trim()

      const { data: chat } = await supabase.from('chats').select('id, tags').eq('id', context.chatId).maybeSingle()

      if (chat) {
        const currentTags: string[] = chat.tags || []
        if (!currentTags.includes(tag)) {
          await supabase.from('chats').update({ tags: [...currentTags, tag] }).eq('id', chat.id)
        }
      }

      return { success: true, actionType: this.type, message: `Tag "${tag}" agregado`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── remove_tag ────────────────────────────────────────────────────────────
class RemoveTagAction implements ActionExecutor {
  readonly type: ActionType = 'remove_tag'

  validate(payload: Record<string, any>) {
    if (!payload.tag) {
      return { valid: false, error: 'Se requiere el campo "tag"' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const supabase = getSupabaseAdmin()
      const tag = payload.tag.trim()

      const { data: chat } = await supabase.from('chats').select('id, tags').eq('id', context.chatId).maybeSingle()

      if (chat) {
        const currentTags: string[] = chat.tags || []
        const newTags = currentTags.filter(t => t !== tag)
        await supabase.from('chats').update({ tags: newTags }).eq('id', chat.id)
      }

      return { success: true, actionType: this.type, message: `Tag "${tag}" removido`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── set_status ────────────────────────────────────────────────────────────
class SetStatusAction implements ActionExecutor {
  readonly type: ActionType = 'set_status'

  validate(payload: Record<string, any>) {
    const validStatuses = ['lead', 'customer', 'closed', 'vip', 'pending', 'archived']
    if (!payload.status) {
      return { valid: false, error: 'Se requiere el campo "status"' }
    }
    if (!validStatuses.includes(payload.status)) {
      return { valid: true } // Permitir cualquier status (flexible)
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const supabase = getSupabaseAdmin()
      const status = payload.status

      await supabase.from('chats').update({ status }).eq('id', context.chatId)

      return { success: true, actionType: this.type, message: `Estado cambiado a "${status}"`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── update_field ──────────────────────────────────────────────────────────
class UpdateFieldAction implements ActionExecutor {
  readonly type: ActionType = 'update_field'

  validate(payload: Record<string, any>) {
    if (!payload.field_name) {
      return { valid: false, error: 'Se requiere el campo "field_name"' }
    }
    if (payload.value === undefined || payload.value === null) {
      return { valid: false, error: 'Se requiere el campo "value"' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const supabase = getSupabaseAdmin()
      const vars = contextToVariableContext(context)

      const fieldName = payload.field_name
      const value = resolveVariables(String(payload.value), vars)

      // Obtener custom_fields actuales y actualizar el campo específico
      const { data: chat } = await supabase.from('chats').select('custom_fields').eq('id', context.chatId).maybeSingle()
      const currentFields = chat?.custom_fields || {}
      const updatedFields = { ...currentFields, [fieldName]: value }

      await supabase.from('chats').update({ custom_fields: updatedFields }).eq('id', context.chatId)

      return { success: true, actionType: this.type, message: `Campo "${fieldName}" actualizado a "${value}"`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── notify_admin ──────────────────────────────────────────────────────────
class NotifyAdminAction implements ActionExecutor {
  readonly type: ActionType = 'notify_admin'

  validate(payload: Record<string, any>) {
    if (!payload.message) {
      return { valid: false, error: 'Se requiere el campo "message"' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const supabase = getSupabaseAdmin()
      const vars = contextToVariableContext(context)

      const title = payload.title ? resolveVariables(payload.title, vars) : 'Notificación de Disparador'
      const message = resolveVariables(payload.message, vars)
      const channel = payload.channel || 'log' // 'log', 'email', 'webhook'

      // Siempre loguear
      console.log(`[TriggerAction:notify_admin] 🔔 ${title}: ${message} — Chat: ${context.chatId} Phone: ${context.phoneNumber.slice(-4)}`)

      // Guardar notificación en tabla de notificaciones (si existe)
      try {
        await supabase.from('notifications').insert({
          user_id: context.tenantUserId,
          type: 'trigger_alert',
          title,
          message,
          chat_id: context.chatId,
          read: false,
        })
      } catch {
        // La tabla puede no existir, no bloquear
      }

      // Si hay email configurado, enviar (futuro: integración Resend/SendGrid)
      if (channel === 'email' && payload.email) {
        // TODO: Integrar Resend para emails reales
        console.log(`[TriggerAction:notify_admin] Email a ${payload.email}: ${title}`)
      }

      return { success: true, actionType: this.type, message: `Admin notificado: "${title}"`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── notify_webhook ────────────────────────────────────────────────────────
class NotifyWebhookAction implements ActionExecutor {
  readonly type: ActionType = 'notify_webhook'

  validate(payload: Record<string, any>) {
    if (!payload.url) {
      return { valid: false, error: 'Se requiere el campo "url" con la URL del webhook externo' }
    }
    try {
      new URL(payload.url)
    } catch {
      return { valid: false, error: 'La URL del webhook no es válida' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const vars = contextToVariableContext(context)

      const url = payload.url
      const method = (payload.method || 'POST').toUpperCase()

      // Construir payload del webhook con variables resueltas
      const webhookPayload = payload.body
        ? JSON.parse(resolveVariables(JSON.stringify(payload.body), vars))
        : {
          event: 'trigger_fired',
          chat_id: context.chatId,
          phone_number: context.phoneNumber,
          contact_name: context.contactName,
          chat_status: context.chatStatus,
          chat_tags: context.chatTags,
          message_text: context.messageText,
          timestamp: new Date().toISOString(),
        }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload.headers || {}),
        },
        body: method !== 'GET' ? JSON.stringify(webhookPayload) : undefined,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`Webhook respondió con status ${response.status}`)
      }

      return { success: true, actionType: this.type, message: `Webhook ${method} a ${url} — Status: ${response.status}`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── start_flow ────────────────────────────────────────────────────────────
class StartFlowAction implements ActionExecutor {
  readonly type: ActionType = 'start_flow'

  validate(payload: Record<string, any>) {
    if (!payload.flow_id && !payload.flowId) {
      return { valid: false, error: 'Se requiere el campo "flow_id"' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    try {
      const supabase = getSupabaseAdmin()
      const flowId = payload.flow_id || payload.flowId

      // Verificar que el flujo existe y pertenece al tenant
      const { data: flow } = await supabase
        .from('flows')
        .select('id, name, is_active')
        .eq('id', flowId)
        .eq('user_id', context.tenantUserId)
        .maybeSingle()

      if (!flow) {
        return { success: false, actionType: this.type, error: 'Flujo no encontrado', executedAt: new Date() }
      }

      if (!flow.is_active) {
        return { success: false, actionType: this.type, error: `El flujo "${flow.name}" está desactivado`, executedAt: new Date() }
      }

      // Insertar estado de flujo para que empiece en el próximo mensaje
      await supabase.from('chat_flow_state').upsert({
        chat_id: context.chatId,
        flow_id: flowId,
        current_node_id: null, // El motor buscará el nodo inicial
        state: {},
        started_at: new Date().toISOString(),
      }, { onConflict: 'chat_id' })

      return { success: true, actionType: this.type, message: `Flujo "${flow.name}" iniciado`, executedAt: new Date(), durationMs: Date.now() - start }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date(), durationMs: Date.now() - start }
    }
  }
}

// ─── pause ─────────────────────────────────────────────────────────────────
class PauseAction implements ActionExecutor {
  readonly type: ActionType = 'pause'

  validate(payload: Record<string, any>) {
    if (payload.seconds === undefined || isNaN(parseInt(payload.seconds))) {
      return { valid: false, error: 'Se requiere el campo "seconds" con los segundos de pausa' }
    }
    if (parseInt(payload.seconds) > 300) {
      return { valid: false, error: 'La pausa máxima es de 300 segundos (5 minutos)' }
    }
    return { valid: true }
  }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const start = Date.now()
    const seconds = Math.min(parseInt(payload.seconds) || 1, 300)
    await new Promise(resolve => setTimeout(resolve, seconds * 1000))
    return { success: true, actionType: this.type, message: `Pausa de ${seconds}s completada`, executedAt: new Date(), durationMs: Date.now() - start }
  }
}

// ─── Legacy Aliases ────────────────────────────────────────────────────────

class SendMessageLegacyAction extends SendTextAction {
  override readonly type: ActionType = 'send_message'
}

class SendMetaTemplateLegacyAction extends SendTemplateAction {
  override readonly type: ActionType = 'send_meta_template'

  override validate(payload: Record<string, any>) {
    if (!payload.templateName && !payload.template_name) {
      return { valid: false, error: 'Se requiere "templateName"' }
    }
    return { valid: true }
  }

  override async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    // Map legacy field names to new ones
    const normalizedPayload = {
      ...payload,
      template_name: payload.templateName || payload.template_name,
    }
    return super.execute(normalizedPayload, context)
  }
}

class UpdateStatusLegacyAction extends SetStatusAction {
  override readonly type: ActionType = 'update_status'
}

class ToggleBotAction implements ActionExecutor {
  readonly type: ActionType = 'toggle_bot'

  validate(_payload: Record<string, any>) { return { valid: true } }

  async execute(payload: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    try {
      const supabase = getSupabaseAdmin()
      // Toggle bot enabled/disabled for this chat
      const enable = payload.enable !== undefined ? Boolean(payload.enable) : true
      await supabase.from('chats').update({ bot_enabled: enable }).eq('id', context.chatId)
      return { success: true, actionType: this.type, message: `Bot ${enable ? 'activado' : 'desactivado'}`, executedAt: new Date() }
    } catch (err) {
      return { success: false, actionType: this.type, error: String(err), executedAt: new Date() }
    }
  }
}

// ── ActionFactory ─────────────────────────────────────────────────────────

const ACTION_EXECUTORS: Record<string, () => ActionExecutor> = {
  // Nuevos tipos
  'send_text': () => new SendTextAction(),
  'send_text_ai': () => new SendTextAIAction(),
  'send_media': () => new SendMediaAction(),
  'send_template': () => new SendTemplateAction(),
  'send_interactive': () => new SendInteractiveAction(),
  'add_tag': () => new AddTagAction(),
  'remove_tag': () => new RemoveTagAction(),
  'set_status': () => new SetStatusAction(),
  'update_field': () => new UpdateFieldAction(),
  'notify_admin': () => new NotifyAdminAction(),
  'notify_webhook': () => new NotifyWebhookAction(),
  'start_flow': () => new StartFlowAction(),
  'pause': () => new PauseAction(),
  // Legacy
  'send_message': () => new SendMessageLegacyAction(),
  'send_meta_template': () => new SendMetaTemplateLegacyAction(),
  'update_status': () => new UpdateStatusLegacyAction(),
  'toggle_bot': () => new ToggleBotAction(),
}

export class ActionFactory {
  /**
   * Obtiene el executor para un tipo de acción dado.
   * Retorna null si el tipo no está soportado.
   */
  static getExecutor(actionType: string): ActionExecutor | null {
    const factory = ACTION_EXECUTORS[actionType]
    if (!factory) {
      console.warn(`[ActionFactory] Tipo de acción no soportado: "${actionType}"`)
      return null
    }
    return factory()
  }

  /**
   * Lista todos los tipos de acciones soportados.
   */
  static getSupportedTypes(): string[] {
    return Object.keys(ACTION_EXECUTORS)
  }

  /**
   * Verifica si un tipo de acción está soportado.
   */
  static isSupported(actionType: string): boolean {
    return actionType in ACTION_EXECUTORS
  }
}

// ── Main Executor Function ────────────────────────────────────────────────

/**
 * Ejecuta una lista de acciones en secuencia para un contexto dado.
 * Soporta delays configurables y logging de cada acción.
 */
export async function executeActions(
  actions: Array<{ id?: string; type: string; payload?: Record<string, any>; action_order?: number; delay_seconds?: number }>,
  context: ActionContext,
  options: { logResults?: boolean } = {}
): Promise<{ results: ActionResult[]; allSucceeded: boolean; failedCount: number }> {
  const sortedActions = [...actions].sort((a, b) => (a.action_order || 0) - (b.action_order || 0))
  const results: ActionResult[] = []

  for (const action of sortedActions) {
    const executor = ActionFactory.getExecutor(action.type)

    if (!executor) {
      results.push({
        success: false,
        actionType: action.type as ActionType,
        error: `Tipo de acción "${action.type}" no soportado`,
        executedAt: new Date(),
      })
      continue
    }

    const payload = action.payload || {}
    const validation = executor.validate(payload)

    if (!validation.valid) {
      results.push({
        success: false,
        actionType: action.type as ActionType,
        error: `Payload inválido: ${validation.error}`,
        executedAt: new Date(),
      })
      continue
    }

    const result = await executor.execute(payload, context)
    results.push(result)

    if (options.logResults) {
      if (result.success) {
        console.log(`[TriggerActions] ✅ ${action.type}: ${result.message}`)
      } else {
        console.error(`[TriggerActions] ❌ ${action.type}: ${result.error}`)
      }
    }

    // Aplicar delay post-acción si está configurado
    const delayMs = (action.delay_seconds || 0) * 1000
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 300_000)))
    }
  }

  const failedCount = results.filter(r => !r.success).length
  return {
    results,
    allSucceeded: failedCount === 0,
    failedCount,
  }
}

export default ActionFactory
