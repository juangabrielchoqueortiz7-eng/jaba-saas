/**
 * Flow Engine — Ejecuta flujos conversacionales definidos desde el panel visual.
 * 
 * Lógica principal:
 * 1. ¿El chat tiene un flujo activo? → Continuar desde el nodo actual
 * 2. ¿El mensaje coincide con un trigger? → Iniciar flujo
 * 3. Sin coincidencia → retornar null (para que el webhook use la IA)
 */

import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
)

// ========================
// TYPES
// ========================

type FlowVariables = Record<string, string>
type FlowConfig = Record<string, unknown>

interface FlowNode {
    id: string
    flow_id: string
    type: string
    label: string
    config: FlowConfig
}

interface FlowState {
    id: string
    chat_id: string
    user_id: string
    flow_id: string
    current_node_id: string | null
    variables: FlowVariables
    status: string
}

type FlowAction =
    | { type: 'send_message'; payload: { text: string } }
    | { type: 'send_buttons'; payload: { text: string; buttons: Array<{ id: string; title: string }> } }
    | { type: 'send_list'; payload: { text: string; buttonText: string; sections: unknown[] } }
    | { type: 'send_image'; payload: { imageUrl: string; caption: string } }
    | { type: 'send_document'; payload: { documentUrl: string; caption: string; filename: string } }
    | { type: 'send_video'; payload: { videoUrl: string; caption: string } }
    | { type: 'send_audio'; payload: { audioUrl: string } }
    | { type: 'send_template'; payload: { templateName: string; language: string; components: Array<{ type: 'body'; parameters: Array<{ type: 'text'; text: string }> }> } }
    | { type: 'wait_input'; payload: Record<string, never> }
    | { type: 'ai_response'; payload: { systemPrompt: string | null; maxTokens: number } }
    | { type: 'system_action'; payload: { actionType: string; params: FlowConfig; tag: string | null; imageUrl: string | null } }

interface FlowResult {
    handled: boolean
    actions: FlowAction[]
}

interface MessageContext {
    chatId: string
    phoneNumber: string
    contactName: string
    messageText: string
    messageType: string
    interactiveData: { id: string; title: string } | null
    tenantUserId: string
    tenantToken: string
    phoneId: string
    mediaUrl?: string | null
    chatCustomFields?: Record<string, unknown>
}

// ========================
// TEMPLATE VARIABLES
// ========================

function getConfigString(config: FlowConfig, key: string): string {
    const value = config[key]
    return typeof value === 'string' ? value : ''
}

function getConfigNumber(config: FlowConfig, key: string, fallback = 0): number {
    const value = config[key]
    return typeof value === 'number' ? value : fallback
}

function getConfigArray(config: FlowConfig, key: string): unknown[] {
    const value = config[key]
    return Array.isArray(value) ? value : []
}

function getFlowValue(vars: FlowVariables, key: string): string {
    return vars[key] || ''
}

function asFlowConfig(value: unknown): FlowConfig {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as FlowConfig
        : {}
}

function replaceVariables(text: string, vars: FlowVariables, ctx: MessageContext): string {
    return text
        .replace(/\{\{service_name\}\}/g, getFlowValue(vars, 'service_name'))
        .replace(/\{\{contact_name\}\}/g, ctx.contactName || '')
        .replace(/\{\{phone_number\}\}/g, ctx.phoneNumber || '')
        .replace(/\{\{message\}\}/g, ctx.messageText || '')
        .replace(/\{\{email\}\}/g, getFlowValue(vars, 'email'))
        .replace(/\{\{plan_name\}\}/g, getFlowValue(vars, 'plan_name'))
        .replace(/\{\{plan_price\}\}/g, getFlowValue(vars, 'plan_price'))
        .replace(/\{\{qr_image_url\}\}/g, getFlowValue(vars, 'qr_image_url'))
        .replace(/\{\{expiration\}\}/g, getFlowValue(vars, 'expiration'))
        // Custom fields ({{custom.FIELD_NAME}})
        .replace(/\{\{custom\.(\w+)\}\}/g, (_, field) => String(ctx.chatCustomFields?.[field] ?? ''))
        // Generic variable replacement
        .replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ========================
// MAIN ENGINE
// ========================

export async function processMessage(ctx: MessageContext): Promise<FlowResult | null> {
    try {
        // Step 1: Check for active flow state
        const activeState = await getActiveFlowState(ctx.chatId)

        if (activeState) {
            return await continueFlow(activeState, ctx)
        }

        // Step 2: Check for matching triggers
        const matchedFlow = await findMatchingTrigger(ctx)

        if (matchedFlow) {
            return await startFlow(matchedFlow.flowId, matchedFlow.triggerNode, ctx)
        }

        // Step 3: No flow matched → null means webhook should use AI
        return null

    } catch (err) {
        console.error('[FlowEngine] Error:', err)
        return null // Fallback to AI on errors
    }
}

// ========================
// FLOW STATE MANAGEMENT
// ========================

async function getActiveFlowState(chatId: string): Promise<FlowState | null> {
    const { data } = await supabaseAdmin
        .from('chat_flow_state')
        .select('*')
        .eq('chat_id', chatId)
        .eq('status', 'active')
        .maybeSingle()

    return data
}

async function saveFlowState(state: Partial<FlowState> & { chat_id: string; user_id: string; flow_id: string }): Promise<string> {
    const { data } = await supabaseAdmin
        .from('chat_flow_state')
        .upsert({
            ...state,
            updated_at: new Date().toISOString()
        }, { onConflict: 'chat_id' })
        .select('id')
        .single()

    return data?.id || ''
}

async function completeFlowState(chatId: string) {
    await supabaseAdmin
        .from('chat_flow_state')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .eq('status', 'active')

    // Clean up old completed states (older than 7 days) to prevent unbounded growth
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabaseAdmin
        .from('chat_flow_state')
        .delete()
        .eq('status', 'completed')
        .lt('updated_at', sevenDaysAgo)
}

// ========================
// TRIGGER MATCHING
// ========================

async function findMatchingTrigger(ctx: MessageContext): Promise<{ flowId: string; triggerNode: FlowNode } | null> {
    // Get all active flows for this tenant, ordered by priority
    const { data: flows } = await supabaseAdmin
        .from('conversation_flows')
        .select('id')
        .eq('user_id', ctx.tenantUserId)
        .eq('is_active', true)
        .order('priority', { ascending: false })

    if (!flows || flows.length === 0) return null

    const flowIds = flows.map(f => f.id)

    // Get all trigger nodes for active flows
    const { data: triggerNodes } = await supabaseAdmin
        .from('flow_nodes')
        .select('*')
        .in('flow_id', flowIds)
        .eq('type', 'trigger')

    if (!triggerNodes || triggerNodes.length === 0) return null

    for (const node of triggerNodes) {
        if (await matchesTrigger(node, ctx)) {
            return { flowId: node.flow_id, triggerNode: node }
        }
    }

    return null
}

async function matchesTrigger(node: FlowNode, ctx: MessageContext): Promise<boolean> {
    const config = node.config || {}

    switch (getConfigString(config, 'trigger_type')) {
        case 'keyword': {
            const keywords = getConfigArray(config, 'keywords').filter((keyword): keyword is string => typeof keyword === 'string')
            const mode = getConfigString(config, 'match_mode') || 'contains'
            const msg = ctx.messageText.toLowerCase()
            
            if (mode === 'exact') {
                return keywords.some(k => msg === k.toLowerCase())
            } else if (mode === 'starts_with') {
                return keywords.some(k => msg.startsWith(k.toLowerCase()))
            } else {
                // contains (default)
                return keywords.some(k => msg.includes(k.toLowerCase()))
            }
        }

        case 'button_id': {
            if (!ctx.interactiveData) return false
            const pattern = getConfigString(config, 'button_id')
            if (pattern.endsWith('*')) {
                return ctx.interactiveData.id.startsWith(pattern.slice(0, -1))
            }
            return ctx.interactiveData.id === pattern
        }

        case 'event': {
            if (getConfigString(config, 'event') === 'first_message') {
                // Verificar si no hay mensajes previos en este chat
                const { count } = await supabaseAdmin
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('chat_id', ctx.chatId)
                if (count === 0 || count === null) return true
                return false
            }
            if (getConfigString(config, 'event') === 'image_received') {
                return ctx.messageType === 'image'
            }
            return false
        }

        case 'message_type': {
            return ctx.messageType === getConfigString(config, 'value')
        }

        default:
            return false
    }
}

// ========================
// FLOW EXECUTION
// ========================

async function startFlow(flowId: string, triggerNode: FlowNode, ctx: MessageContext): Promise<FlowResult> {
    console.log(`[FlowEngine] Starting flow ${flowId} triggered by node ${triggerNode.id}`)

    // Create flow state
    await saveFlowState({
        chat_id: ctx.chatId,
        user_id: ctx.tenantUserId,
        flow_id: flowId,
        current_node_id: triggerNode.id,
        variables: {
            phone_number: ctx.phoneNumber,
            contact_name: ctx.contactName,
            trigger_message: ctx.messageText
        },
        status: 'active'
    })

    // Get the next node(s) after the trigger
    return await advanceFromNode(flowId, triggerNode.id, 'default', ctx)
}

async function continueFlow(state: FlowState, ctx: MessageContext): Promise<FlowResult> {
    if (!state.current_node_id) {
        await completeFlowState(ctx.chatId)
        return { handled: false, actions: [] }
    }

    // Get current node
    const { data: currentNode } = await supabaseAdmin
        .from('flow_nodes')
        .select('*')
        .eq('id', state.current_node_id)
        .single()

    if (!currentNode) {
        await completeFlowState(ctx.chatId)
        return { handled: false, actions: [] }
    }

    // If current node is wait_input, the user just responded — advance
    if (currentNode.type === 'wait_input') {
        // Store the user's response in a variable
        const variableName = getConfigString(currentNode.config, 'variable_name') || 'last_input'
        const updatedVars: FlowVariables = { ...state.variables, [variableName]: ctx.messageText }

        // If user sent interactive data, store that too
        if (ctx.interactiveData) {
            updatedVars[variableName] = ctx.interactiveData.title
            updatedVars[`${variableName}_id`] = ctx.interactiveData.id
        }

        // If user sent an image/media, store the URL so renew_subscription can use it
        if (ctx.mediaUrl) {
            updatedVars['last_media_url'] = ctx.mediaUrl
            updatedVars['last_media_type'] = ctx.messageType
        }

        await saveFlowState({
            chat_id: ctx.chatId,
            user_id: ctx.tenantUserId,
            flow_id: state.flow_id,
            current_node_id: state.current_node_id,
            variables: updatedVars,
            status: 'active'
        })

        // Determine which handle to follow based on conditions
        let handle = 'default'
        if (ctx.interactiveData) {
            handle = ctx.interactiveData.id
        }

        return await advanceFromNode(state.flow_id, state.current_node_id, handle, ctx, updatedVars)
    }

    // If current node is a condition, evaluate it
    if (currentNode.type === 'condition') {
        const handle = evaluateCondition(currentNode, ctx, state.variables)
        return await advanceFromNode(state.flow_id, state.current_node_id, handle, ctx, state.variables)
    }

    // Shouldn't reach here normally, but handle gracefully
    await completeFlowState(ctx.chatId)
    return { handled: false, actions: [] }
}

async function advanceFromNode(
    flowId: string,
    fromNodeId: string,
    handle: string,
    ctx: MessageContext,
    variables?: FlowVariables
): Promise<FlowResult> {
    const vars = variables || {}
    const actions: FlowAction[] = []

    // Get edges from this node
    const { data: edges } = await supabaseAdmin
        .from('flow_edges')
        .select('*')
        .eq('flow_id', flowId)
        .eq('source_node_id', fromNodeId)

    if (!edges || edges.length === 0) {
        // No more edges — flow is complete
        await completeFlowState(ctx.chatId)
        return { handled: actions.length > 0, actions }
    }

    // Find matching edge (by handle or default)
    let targetEdge = edges.find(e => e.source_handle === handle)
    if (!targetEdge) targetEdge = edges.find(e => e.source_handle === 'default')
    if (!targetEdge) targetEdge = edges[0] // Fallback to first edge

    // Get the target node
    const { data: nextNode } = await supabaseAdmin
        .from('flow_nodes')
        .select('*')
        .eq('id', targetEdge.target_node_id)
        .single()

    if (!nextNode) {
        await completeFlowState(ctx.chatId)
        return { handled: actions.length > 0, actions }
    }

    // Execute the node
    const nodeResult = await executeNode(nextNode, ctx, vars)
    actions.push(...nodeResult.actions)

    // Update state
    await saveFlowState({
        chat_id: ctx.chatId,
        user_id: ctx.tenantUserId,
        flow_id: flowId,
        current_node_id: nextNode.id,
        variables: vars,
        status: 'active'
    })

    // If the node is a "stopping" type (wait_input, ai_response), stop here
    if (nextNode.type === 'wait_input' || nextNode.type === 'ai_response') {
        return { handled: true, actions }
    }

    // If the node is a condition, evaluate immediately
    if (nextNode.type === 'condition') {
        const condHandle = evaluateCondition(nextNode, ctx, vars)
        const continueResult = await advanceFromNode(flowId, nextNode.id, condHandle, ctx, vars)
        actions.push(...continueResult.actions)
        return { handled: true, actions }
    }

    // For other node types (message, buttons, action, delay), continue to next node automatically
    if (nextNode.type !== 'wait_input') {
        const continueResult = await advanceFromNode(flowId, nextNode.id, 'default', ctx, vars)
        actions.push(...continueResult.actions)
    }

    return { handled: true, actions }
}

// ========================
// NODE EXECUTION
// ========================

async function executeNode(node: FlowNode, ctx: MessageContext, vars: FlowVariables): Promise<{ actions: FlowAction[] }> {
    const config = node.config || {}
    const actions: FlowAction[] = []

    switch (node.type) {
        case 'message': {
            const text = replaceVariables(getConfigString(config, 'text'), vars, ctx)
            actions.push({
                type: 'send_message',
                payload: { text }
            })
            break
        }

        case 'buttons': {
            const text = replaceVariables(getConfigString(config, 'text'), vars, ctx)
            const buttons = getConfigArray(config, 'buttons').flatMap(button => {
                const buttonConfig = asFlowConfig(button)
                const id = getConfigString(buttonConfig, 'id')
                const title = replaceVariables(getConfigString(buttonConfig, 'title'), vars, ctx)

                if (!id || !title) {
                    return []
                }

                return [{ id, title }]
            })
            actions.push({
                type: 'send_buttons',
                payload: { text, buttons }
            })
            break
        }

        case 'list': {
            const text = replaceVariables(getConfigString(config, 'text'), vars, ctx)
            const buttonText = getConfigString(config, 'button_text') || 'Ver opciones'
            actions.push({
                type: 'send_list',
                payload: {
                    text,
                    buttonText,
                    sections: getConfigArray(config, 'sections')
                }
            })
            break
        }

        case 'ai_response': {
            actions.push({
                type: 'ai_response',
                payload: {
                    systemPrompt: getConfigString(config, 'system_prompt') || null,
                    maxTokens: getConfigNumber(config, 'max_tokens', 500)
                }
            })
            break
        }

        case 'action': {
            const actionType = getConfigString(config, 'action_type')

            // Media actions emit their own typed FlowAction — no system_action needed
            if (actionType === 'send_image' && getConfigString(config, 'image_url')) {
                actions.push({
                    type: 'send_image',
                    payload: {
                        imageUrl: replaceVariables(getConfigString(config, 'image_url'), vars, ctx),
                        caption: getConfigString(config, 'caption') ? replaceVariables(getConfigString(config, 'caption'), vars, ctx) : ''
                    }
                })
                break
            }

            if (actionType === 'send_document' && getConfigString(config, 'document_url')) {
                actions.push({
                    type: 'send_document',
                    payload: {
                        documentUrl: replaceVariables(getConfigString(config, 'document_url'), vars, ctx),
                        caption: getConfigString(config, 'caption') ? replaceVariables(getConfigString(config, 'caption'), vars, ctx) : '',
                        filename: getConfigString(config, 'filename') || ''
                    }
                })
                break
            }

            if (actionType === 'send_video' && getConfigString(config, 'video_url')) {
                actions.push({
                    type: 'send_video',
                    payload: {
                        videoUrl: replaceVariables(getConfigString(config, 'video_url'), vars, ctx),
                        caption: getConfigString(config, 'caption') ? replaceVariables(getConfigString(config, 'caption'), vars, ctx) : ''
                    }
                })
                break
            }

            if (actionType === 'send_audio' && getConfigString(config, 'audio_url')) {
                actions.push({
                    type: 'send_audio',
                    payload: {
                        audioUrl: replaceVariables(getConfigString(config, 'audio_url'), vars, ctx)
                    }
                })
                break
            }

            // Renewal / payment actions — pass their config fields as params
            if (actionType === 'send_plans_list') {
                actions.push({
                    type: 'system_action',
                    payload: {
                        actionType,
                        params: {
                            title: replaceVariables(getConfigString(config, 'list_title') || '📋 Planes disponibles', vars, ctx),
                            button_text: getConfigString(config, 'button_text') || 'Ver planes',
                            variable_name: getConfigString(config, 'variable_name') || 'plan_id',
                        },
                        tag: null,
                        imageUrl: null
                    }
                })
                break
            }

            if (actionType === 'create_renewal_order') {
                actions.push({
                    type: 'system_action',
                    payload: {
                        actionType,
                        params: { plan_variable: getConfigString(config, 'plan_variable') || 'plan_id' },
                        tag: null,
                        imageUrl: null
                    }
                })
                break
            }

            if (actionType === 'send_qr_payment') {
                actions.push({
                    type: 'system_action',
                    payload: {
                        actionType,
                        params: { message: replaceVariables(getConfigString(config, 'qr_message'), vars, ctx) },
                        tag: null,
                        imageUrl: null
                    }
                })
                break
            }

            if (actionType === 'renew_subscription') {
                actions.push({
                    type: 'system_action',
                    payload: {
                        actionType,
                        params: {
                            duration_months: getConfigNumber(config, 'duration_months', 1),
                            message: replaceVariables(getConfigString(config, 'confirm_message'), vars, ctx),
                        },
                        tag: null,
                        imageUrl: null
                    }
                })
                break
            }

            // Tag / variable actions → system_action
            actions.push({
                type: 'system_action',
                payload: {
                    actionType,
                    params: asFlowConfig(config.params),
                    tag: getConfigString(config, 'tag') || null,
                    imageUrl: null
                }
            })
            break
        }

        case 'send_template': {
            const templateParams = getConfigArray(config, 'params').flatMap(param => {
                const templateParam = asFlowConfig(param)
                const value = getConfigString(templateParam, 'value')
                return value ? [{ label: getConfigString(templateParam, 'label'), value }] : []
            })
            const resolvedParams = templateParams.map(p => ({
                type: 'text' as const,
                text: replaceVariables(p.value, vars, ctx)
            }))
            actions.push({
                type: 'send_template',
                payload: {
                    templateName: getConfigString(config, 'template_name'),
                    language: getConfigString(config, 'language') || 'es',
                    components: resolvedParams.length > 0
                        ? [{ type: 'body' as const, parameters: resolvedParams }]
                        : []
                }
            })
            break
        }

        case 'delay': {
            // In practice we'd use a setTimeout, but for now we just add a small wait
            const seconds = getConfigNumber(config, 'seconds', 1)
            await new Promise(resolve => setTimeout(resolve, seconds * 1000))
            break
        }

        case 'wait_input': {
            // Nothing to do — the engine will stop here and wait for user input
            break
        }

        case 'trigger': {
            // Triggers don't produce actions
            break
        }

        default:
            console.warn(`[FlowEngine] Unknown node type: ${node.type}`)
    }

    return { actions }
}

// ========================
// CONDITION EVALUATION
// ========================

function evaluateCondition(node: FlowNode, ctx: MessageContext, vars: FlowVariables): string {
    const config = node.config || {}

    switch (getConfigString(config, 'condition_type')) {
        case 'contains': {
            const fieldName = getConfigString(config, 'field')
            const field = fieldName === 'message' ? ctx.messageText : getFlowValue(vars, fieldName)
            const value = getConfigString(config, 'value')
            return field.toLowerCase().includes(value.toLowerCase()) ? 'true' : 'false'
        }

        case 'equals': {
            const fieldName = getConfigString(config, 'field')
            const field = fieldName === 'message' ? ctx.messageText : getFlowValue(vars, fieldName)
            return field.toLowerCase() === getConfigString(config, 'value').toLowerCase() ? 'true' : 'false'
        }

        case 'message_type': {
            return ctx.messageType === getConfigString(config, 'value') ? 'true' : 'false'
        }

        case 'has_variable': {
            return getFlowValue(vars, getConfigString(config, 'variable')) ? 'true' : 'false'
        }

        case 'interactive_id': {
            if (!ctx.interactiveData) return 'false'
            const pattern = getConfigString(config, 'value')
            if (pattern.endsWith('*')) {
                return ctx.interactiveData.id.startsWith(pattern.slice(0, -1)) ? 'true' : 'false'
            }
            return ctx.interactiveData.id === pattern ? 'true' : 'false'
        }

        default:
            return 'false'
    }
}

// ========================
// ACTION EXECUTOR (called by webhook)
// ========================

export async function executeFlowActions(
    actions: FlowAction[],
    ctx: MessageContext
): Promise<void> {
    const { sendWhatsAppMessage, sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppImage, sendWhatsAppTemplate, sendWhatsAppDocument, sendWhatsAppVideo, sendWhatsAppAudio } = await import('@/lib/whatsapp')

    for (const action of actions) {
        switch (action.type) {
            case 'send_message': {
                await sendWhatsAppMessage(ctx.phoneNumber, action.payload.text, ctx.tenantToken, ctx.phoneId)
                // Save to messages table
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: action.payload.text,
                    status: 'delivered'
                })
                break
            }

            case 'send_buttons': {
                await sendWhatsAppButtons(ctx.phoneNumber, action.payload.text, action.payload.buttons, ctx.tenantToken, ctx.phoneId)
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: `${action.payload.text}\n[Botones enviados]`,
                    status: 'delivered'
                })
                break
            }

            case 'send_list': {
                await sendWhatsAppList(ctx.phoneNumber, action.payload.text, action.payload.buttonText, action.payload.sections, ctx.tenantToken, ctx.phoneId)
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: `${action.payload.text}\n[Lista interactiva enviada]`,
                    status: 'delivered'
                })
                break
            }

            case 'send_image': {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const imgUrl = action.payload.imageUrl.startsWith('http')
                    ? action.payload.imageUrl
                    : `${baseUrl}${action.payload.imageUrl}`
                await sendWhatsAppImage(ctx.phoneNumber, imgUrl, action.payload.caption || '', ctx.tenantToken, ctx.phoneId)
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: action.payload.caption || '📷 Imagen enviada',
                    media_url: imgUrl,
                    media_type: 'image',
                    status: 'delivered'
                })
                break
            }

            case 'send_document': {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const docUrl = action.payload.documentUrl.startsWith('http')
                    ? action.payload.documentUrl
                    : `${baseUrl}${action.payload.documentUrl}`
                await sendWhatsAppDocument(ctx.phoneNumber, docUrl, action.payload.caption || '', action.payload.filename || '', ctx.tenantToken, ctx.phoneId)
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: action.payload.caption || `📄 ${action.payload.filename || 'Documento enviado'}`,
                    media_url: docUrl,
                    media_type: 'document',
                    status: 'delivered'
                })
                break
            }

            case 'send_video': {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const vidUrl = action.payload.videoUrl.startsWith('http')
                    ? action.payload.videoUrl
                    : `${baseUrl}${action.payload.videoUrl}`
                await sendWhatsAppVideo(ctx.phoneNumber, vidUrl, action.payload.caption || '', ctx.tenantToken, ctx.phoneId)
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: action.payload.caption || '🎥 Video enviado',
                    media_url: vidUrl,
                    media_type: 'video',
                    status: 'delivered'
                })
                break
            }

            case 'send_audio': {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
                const audUrl = action.payload.audioUrl.startsWith('http')
                    ? action.payload.audioUrl
                    : `${baseUrl}${action.payload.audioUrl}`
                await sendWhatsAppAudio(ctx.phoneNumber, audUrl, ctx.tenantToken, ctx.phoneId)
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: '🎵 Audio enviado',
                    media_url: audUrl,
                    media_type: 'audio',
                    status: 'delivered'
                })
                break
            }

            case 'send_template': {
                await sendWhatsAppTemplate(
                    ctx.phoneNumber,
                    action.payload.templateName,
                    action.payload.language || 'es',
                    action.payload.components || [],
                    ctx.tenantToken,
                    ctx.phoneId
                )
                await supabaseAdmin.from('messages').insert({
                    chat_id: ctx.chatId,
                    is_from_me: true,
                    content: `📋 Plantilla enviada: ${action.payload.templateName}`,
                    status: 'delivered'
                })
                break
            }

            case 'system_action': {
                await executeSystemAction(action.payload, ctx)
                break
            }

            case 'ai_response': {
                // Signal to webhook to use AI for this turn
                // The webhook will handle this
                break
            }
        }

        // Small delay between actions to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
    }
}

// ========================
// SYSTEM ACTIONS
// ========================

async function executeSystemAction(payload: Extract<FlowAction, { type: 'system_action' }>['payload'], ctx: MessageContext): Promise<void> {
    switch (payload.actionType) {
        case 'add_tag': {
            const { data: chat } = await supabaseAdmin.from('chats').select('tags').eq('id', ctx.chatId).single()
            const tags: string[] = chat?.tags || []
            if (payload.tag && !tags.includes(payload.tag)) {
                tags.push(payload.tag)
                await supabaseAdmin.from('chats').update({ tags }).eq('id', ctx.chatId)
            }
            break
        }

        case 'remove_tag': {
            const { data: chat } = await supabaseAdmin.from('chats').select('tags').eq('id', ctx.chatId).single()
            let tags: string[] = chat?.tags || []
            tags = tags.filter(t => t !== payload.tag)
            await supabaseAdmin.from('chats').update({ tags }).eq('id', ctx.chatId)
            break
        }

        case 'set_variable': {
            // Variables are managed in the flow state, this is a no-op at the system level
            break
        }

        case 'send_plans_list': {
            // Fetch active products for this tenant and send as WhatsApp list
            const { sendWhatsAppList } = await import('@/lib/whatsapp')
            const { data: productRows } = await supabaseAdmin
                .from('products')
                .select('id, name, price, description')
                .eq('user_id', ctx.tenantUserId)
                .eq('is_active', true)
                .order('sort_order', { ascending: true })

            const products = productRows || []
            if (products.length === 0) {
                const { sendWhatsAppMessage } = await import('@/lib/whatsapp')
                await sendWhatsAppMessage(ctx.phoneNumber, 'No hay planes disponibles en este momento.', ctx.tenantToken, ctx.phoneId)
                break
            }

            const currencySymbol = (payload.params?.currency_symbol as string) || 'Bs'
            const title = (payload.params?.title as string) || '📋 Planes disponibles'
            const buttonText = (payload.params?.button_text as string) || 'Ver planes'

            const rows = products.map(p => ({
                id: `renew_plan_${p.id}`,
                title: String(p.name).substring(0, 24),
                description: `${currencySymbol} ${p.price}`
            }))

            await sendWhatsAppList(
                ctx.phoneNumber,
                title,
                buttonText,
                [{ title: 'Planes', rows }],
                ctx.tenantToken,
                ctx.phoneId
            )

            await supabaseAdmin.from('messages').insert({
                chat_id: ctx.chatId,
                is_from_me: true,
                content: `${title}\n[Lista de planes enviada]`,
                status: 'delivered'
            })
            break
        }

        case 'create_renewal_order': {
            // Look up the plan the user selected (stored as renew_plan_{id} in flow vars)
            const { data: flowState } = await supabaseAdmin
                .from('chat_flow_state')
                .select('variables')
                .eq('chat_id', ctx.chatId)
                .eq('status', 'active')
                .maybeSingle()

            const vars = flowState?.variables || {}
            const planVarName = (payload.params?.plan_variable as string) || 'plan_id'
            const rawPlanId = vars[planVarName] || vars[`${planVarName}_id`] || ''

            // Extract UUID from "renew_plan_{uuid}"
            const productId = rawPlanId.startsWith('renew_plan_')
                ? rawPlanId.replace('renew_plan_', '')
                : rawPlanId

            if (!productId) {
                console.warn('[FlowEngine] create_renewal_order: no productId found in vars', vars)
                break
            }

            const { data: product } = await supabaseAdmin
                .from('products')
                .select('id, name, price, qr_image_url')
                .eq('id', productId)
                .eq('user_id', ctx.tenantUserId)
                .maybeSingle()

            if (!product) break

            // Delete previous pending orders for this chat
            await supabaseAdmin
                .from('orders')
                .delete()
                .eq('chat_id', ctx.chatId)
                .eq('status', 'pending_payment')

            // Create new order
            await supabaseAdmin.from('orders').insert({
                user_id: ctx.tenantUserId,
                chat_id: ctx.chatId,
                phone_number: ctx.phoneNumber,
                contact_name: ctx.contactName,
                product: product.name,
                plan: product.id,
                plan_name: product.name,
                amount: product.price,
                status: 'pending_payment'
            })

            // Save plan info into flow variables
            await supabaseAdmin
                .from('chat_flow_state')
                .update({
                    variables: {
                        ...vars,
                        plan_name: product.name,
                        plan_price: String(product.price),
                        plan_id: product.id,
                        qr_image_url: product.qr_image_url || ''
                    }
                })
                .eq('chat_id', ctx.chatId)
                .eq('status', 'active')
            break
        }

        case 'send_qr_payment': {
            // Find the pending order and send its QR image
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('plan, plan_name, amount')
                .eq('chat_id', ctx.chatId)
                .eq('status', 'pending_payment')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (!order) {
                console.warn('[FlowEngine] send_qr_payment: no pending order for chat', ctx.chatId)
                break
            }

            const { data: product } = await supabaseAdmin
                .from('products')
                .select('name, price, qr_image_url')
                .eq('id', order.plan)
                .maybeSingle()

            if (!product?.qr_image_url) {
                console.warn('[FlowEngine] send_qr_payment: product has no qr_image_url', order.plan)
                break
            }

            const { sendWhatsAppImage } = await import('@/lib/whatsapp')
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jabachat.com'
            const qrUrl = product.qr_image_url.startsWith('http')
                ? product.qr_image_url
                : `${baseUrl}${product.qr_image_url}`

            const qrCaption = (payload.params?.message as string)
                || `Realiza tu pago por *${product.name}* y envía el comprobante aquí.`

            await sendWhatsAppImage(ctx.phoneNumber, qrUrl, qrCaption, ctx.tenantToken, ctx.phoneId)
            await supabaseAdmin.from('messages').insert({
                chat_id: ctx.chatId,
                is_from_me: true,
                content: qrCaption,
                media_url: qrUrl,
                media_type: 'image',
                status: 'delivered'
            })
            break
        }

        case 'renew_subscription': {
            // Find the pending order for this chat
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('id, plan, plan_name, amount')
                .eq('chat_id', ctx.chatId)
                .eq('status', 'pending_payment')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (!order) {
                console.warn('[FlowEngine] renew_subscription: no pending order for chat', ctx.chatId)
                break
            }

            // Find the active subscription for this phone number
            const { data: subscription } = await supabaseAdmin
                .from('subscriptions')
                .select('id, vencimiento, correo')
                .eq('user_id', ctx.tenantUserId)
                .ilike('numero', `%${ctx.phoneNumber.replace(/^\+/, '')}%`)
                .eq('estado', 'ACTIVO')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            // Calculate new expiration (+30 days from today or from current expiry)
            const durationMonths = Number(payload.params?.duration_months) || 1
            const now = new Date()
            let baseDate = now
            if (subscription?.vencimiento) {
                const parts = subscription.vencimiento.split('/')
                if (parts.length === 3) {
                    const parsed = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
                    if (!isNaN(parsed.getTime()) && parsed > now) baseDate = parsed
                }
            }
            baseDate.setMonth(baseDate.getMonth() + durationMonths)
            const dd = String(baseDate.getDate()).padStart(2, '0')
            const mm = String(baseDate.getMonth() + 1).padStart(2, '0')
            const yyyy = baseDate.getFullYear()
            const newExpiration = `${dd}/${mm}/${yyyy}`

            // Get flow state for media URL (payment receipt)
            const { data: flowState } = await supabaseAdmin
                .from('chat_flow_state')
                .select('variables')
                .eq('chat_id', ctx.chatId)
                .eq('status', 'active')
                .maybeSingle()
            const receiptUrl = flowState?.variables?.last_media_url || null

            // Update subscription
            if (subscription) {
                await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        vencimiento: newExpiration,
                        estado: 'ACTIVO',
                        notified: false,
                        notified_at: null,
                        followup_sent: false,
                        urgency_sent: false
                    })
                    .eq('id', subscription.id)
            }

            // Mark order as completed
            await supabaseAdmin
                .from('orders')
                .update({ status: 'completed' })
                .eq('id', order.id)

            // Record the renewal
            await supabaseAdmin.from('subscription_renewals').insert({
                user_id: ctx.tenantUserId,
                subscription_id: subscription?.id || null,
                order_id: order.id,
                chat_id: ctx.chatId,
                phone_number: ctx.phoneNumber,
                customer_email: subscription?.correo || '',
                plan_name: order.plan_name || '',
                amount: order.amount,
                old_expiration: subscription?.vencimiento || '',
                new_expiration: newExpiration,
                payment_proof_url: receiptUrl,
                status: 'auto_approved',
                triggered_by: 'flow',
                reviewed_at: new Date().toISOString()
            })

            // Send confirmation message
            const confirmMsg = (payload.params?.message as string)
                || `✅ ¡Renovación completada! Tu acceso ha sido renovado hasta el *${newExpiration}*.`
            const { sendWhatsAppMessage } = await import('@/lib/whatsapp')
            await sendWhatsAppMessage(ctx.phoneNumber, confirmMsg, ctx.tenantToken, ctx.phoneId)
            await supabaseAdmin.from('messages').insert({
                chat_id: ctx.chatId,
                is_from_me: true,
                content: confirmMsg,
                status: 'delivered'
            })
            break
        }

        default:
            console.warn(`[FlowEngine] Unknown system action: ${payload.actionType}`)
    }
}
