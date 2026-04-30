'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    AUTOMATION_SEQUENCE_KEYS,
    AUTOMATION_SEQUENCE_PACKS,
    AUTOMATION_SEQUENCE_PRESETS,
    normalizeAutomationSequenceCustomPacks,
    normalizeAutomationSequenceProfileSettings,
    type AutomationSequenceCustomPackDefinition,
    type AutomationSequencePackKey,
    type AutomationSequenceSimulationContext,
    type AutomationSequenceKey,
    type AutomationSequenceSetting,
} from '@/lib/automation-sequence-config'
import { isBusinessType } from '@/lib/business-config'
import { getDefaultGoalsForBusinessType, normalizeBusinessGoalsForBusinessType } from '@/lib/business-goals'

export type Trigger = {
    id: string
    name: string
    type: 'logic' | 'flow' | 'time' | 'manual' | 'scheduled'
    description: string | null
    is_active: boolean
    created_at: string
    last_run_at: string | null
    trigger_actions: { count: number }[]
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }
type TriggerType = 'logic' | 'flow' | 'time' | 'manual' | 'scheduled'
type ConditionLogic = 'AND' | 'OR'

type TriggerListRow = Omit<Trigger, 'trigger_actions'> & {
    trigger_actions?: { count: number }[]
}

export type TriggerListItem = Omit<Trigger, 'trigger_actions'> & {
    action_count: number
}

export interface SequenceAutomationListItem extends AutomationSequenceSetting {
    key: AutomationSequenceKey
    title: string
    shortTitle: string
    description: string
    triggerLabel: string
    outcomeLabel: string
    helperText: string
    activeRuns: number
    metrics: {
        startedLast30Days: number
        completedLast30Days: number
        sentLast30Days: number
        repliedLast30Days: number
        advancedLast30Days: number
        cancelledByReplyLast30Days: number
        cancelledByConversionLast30Days: number
        reactivationRate: number
    }
    recentActivity: Array<{
        id: string
        summary: string
        detail: string
        statusLabel: string
        tone: 'emerald' | 'blue' | 'amber' | 'slate'
        timestamp: string
    }>
    simulationDefaults: AutomationSequenceSimulationContext
}

export interface SequenceAutomationPanelData {
    items: SequenceAutomationListItem[]
    customPacks: AutomationSequenceCustomPackDefinition[]
}

type SequenceRow = {
    id: string
    sequence_key?: string | null
    status?: string | null
    current_step?: number | null
    created_at?: string | null
    started_at?: string | null
    scheduled_for?: string | null
    last_executed_at?: string | null
    completed_at?: string | null
    cancelled_at?: string | null
    cancel_reason?: string | null
    chat_id?: string | null
    order_id?: string | null
}

type ChatSummaryRow = {
    id: string
    contact_name?: string | null
    phone_number?: string | null
}

type OrderSummaryRow = {
    id: string
    plan_name?: string | null
    customer_email?: string | null
    status?: string | null
}

type TriggerConditionRow = {
    id?: string
    trigger_id?: string
    type?: string
    condition_type?: string
    operator?: string
    value?: string
    payload?: JsonObject
    [key: string]: JsonValue | undefined
}

type TriggerActionRow = {
    id?: string
    trigger_id?: string
    type: string
    payload?: JsonObject
    action_order?: number
    delay_seconds?: number
    [key: string]: JsonValue | undefined
}

type TriggerConditionGroupRow = {
    id: string
    operator?: ConditionLogic
    conditions?: TriggerConditionRow[]
}

type TriggerDetailRow = {
    id: string
    name: string
    type: TriggerType
    description: string | null
    is_active?: boolean
    conditions_logic?: ConditionLogic
    time_minutes?: number | null
    schedule_config?: JsonObject | null
    trigger_actions?: TriggerActionRow[]
    trigger_conditions?: TriggerConditionRow[]
    trigger_condition_groups?: TriggerConditionGroupRow[]
}

type SaveTriggerPayload = {
    id?: string
    name: string
    type: TriggerType
    description: string
    cooldown_minutes?: number
    actions: { type: string, payload: Record<string, unknown>, action_order?: number, delay_seconds?: number }[]
    conditions?: { type: string, condition_type?: string, operator: string, value: string, payload?: Record<string, unknown> }[]
    conditionsLogic?: ConditionLogic
}

function omitTriggerIdentifiers<T extends { id?: string; trigger_id?: string }>(row: T): Omit<T, 'id' | 'trigger_id'> {
    const clone = { ...row }
    delete clone.id
    delete clone.trigger_id
    return clone
}

export async function getTriggers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    // We fetch triggers and also want to know how many actions they have.
    // Supabase generic count is easier if we just select the relation.
    const { data, error } = await supabase
        .from('triggers')
        .select(`
            id, name, type, description, is_active, created_at, last_run_at,
            trigger_actions (count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching triggers:', error)
        return []
    }

    // Transform data to include action count cleanly
    return (data as TriggerListRow[]).map((t): TriggerListItem => ({
        ...t,
        action_count: t.trigger_actions?.[0]?.count || 0
    }))
}

export async function toggleTrigger(id: string, currentState: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('triggers')
        .update({ is_active: !currentState })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/assistants')
}

export async function duplicateTrigger(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Fetch full trigger with conditions and actions
    const { data: source } = await supabase
        .from('triggers')
        .select('*, trigger_conditions(*), trigger_actions(*), trigger_condition_groups(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!source) throw new Error('Trigger not found')
    const sourceTrigger = source as TriggerDetailRow

    // Insert new trigger
    const { data: newTrigger } = await supabase
        .from('triggers')
        .insert({
            user_id: user.id,
            name: `Copia de ${sourceTrigger.name}`,
            type: sourceTrigger.type,
            description: sourceTrigger.description,
            is_active: false,
            conditions_logic: sourceTrigger.conditions_logic,
            time_minutes: sourceTrigger.time_minutes,
            schedule_config: sourceTrigger.schedule_config,
        })
        .select('id')
        .single()

    if (!newTrigger) throw new Error('Failed to duplicate trigger')

    // Copy conditions
    if (sourceTrigger.trigger_conditions?.length) {
        await supabase.from('trigger_conditions').insert(
            sourceTrigger.trigger_conditions.map(condition => ({
                ...omitTriggerIdentifiers(condition),
                trigger_id: newTrigger.id
            }))
        )
    }

    // Copy actions
    if (sourceTrigger.trigger_actions?.length) {
        await supabase.from('trigger_actions').insert(
            sourceTrigger.trigger_actions.map(action => ({
                ...omitTriggerIdentifiers(action),
                trigger_id: newTrigger.id
            }))
        )
    }

    revalidatePath('/dashboard/assistants')
    return newTrigger.id
}

export async function deleteTrigger(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('triggers')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/assistants')
}

export async function getTrigger(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('triggers')
        .select(`
            *,
            trigger_actions (*),
            trigger_conditions (*),
            trigger_condition_groups (id, operator, group_order, conditions:trigger_conditions(*))
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (error) {
        console.error('Error fetching trigger:', error)
        return null
    }

    // Sort actions by order
    const trigger = data as TriggerDetailRow

    if (trigger.trigger_actions) {
        trigger.trigger_actions.sort((a, b) => (a.action_order ?? 0) - (b.action_order ?? 0))
    }

    // If we have condition groups, flatten conditions from the first group and expose conditionsLogic
    if (trigger.trigger_condition_groups?.length) {
        const group = trigger.trigger_condition_groups[0]
        trigger.conditions_logic = group.operator || 'AND'
        // Prefer conditions from groups
        if ((group.conditions?.length ?? 0) > 0) {
            trigger.trigger_conditions = group.conditions
        }
    }

    return trigger
}

export async function saveTrigger(
    assistantId: string,
    triggerData: SaveTriggerPayload
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    let triggerId = triggerData.id

    // 1. Upsert Trigger
    if (triggerId) {
        const { error } = await supabase
            .from('triggers')
            .update({
                name: triggerData.name,
                type: triggerData.type,
                description: triggerData.description,
                cooldown_minutes: triggerData.cooldown_minutes ?? 60,
                user_id: user.id
            })
            .eq('id', triggerId)
            .eq('user_id', user.id)
        if (error) throw error
    } else {
        const { data, error } = await supabase
            .from('triggers')
            .insert({
                user_id: user.id,
                name: triggerData.name,
                type: triggerData.type,
                description: triggerData.description,
                cooldown_minutes: triggerData.cooldown_minutes ?? 60,
            })
            .select()
            .single()
        if (error) throw new Error(`Error al crear disparador: ${error.message} (code: ${error.code})`)
        triggerId = data.id
    }

    if (!triggerId) throw new Error('No se pudo obtener el ID del disparador')

    // 2. Manage Actions (full replacement)
    await supabase.from('trigger_actions').delete().eq('trigger_id', triggerId)

    if (triggerData.actions.length > 0) {
        const actionsToInsert = triggerData.actions.map((action, index) => ({
            trigger_id: triggerId,
            type: action.type,
            payload: action.payload,
            action_order: action.action_order ?? index,
            delay_seconds: action.delay_seconds ?? 0,
        }))

        const { error: actionsError } = await supabase
            .from('trigger_actions')
            .insert(actionsToInsert)

        if (actionsError) throw new Error(`Error al guardar acciones: ${actionsError.message} (code: ${actionsError.code})`)
    }

    // 3. Manage Conditions (full replacement)
    // Delete legacy conditions
    await supabase.from('trigger_conditions').delete().eq('trigger_id', triggerId)

    // Delete existing condition groups (and their cascaded conditions)
    const { data: existingGroups } = await supabase
        .from('trigger_condition_groups')
        .select('id')
        .eq('trigger_id', triggerId)

    if (existingGroups?.length) {
        const groupIds = (existingGroups as { id: string }[]).map(g => g.id)
        // Delete conditions linked to these groups first
        await supabase.from('trigger_conditions').delete().in('group_id', groupIds)
        await supabase.from('trigger_condition_groups').delete().eq('trigger_id', triggerId)
    }

    if (triggerData.conditions && triggerData.conditions.length > 0) {
        const logic = triggerData.conditionsLogic || 'AND'

        // Try new group-based system first
        const { data: groupData, error: groupError } = await supabase
            .from('trigger_condition_groups')
            .insert({
                trigger_id: triggerId,
                operator: logic,
                group_order: 0,
            })
            .select()
            .single()

        if (!groupError && groupData) {
            // Insert conditions linked to group
            const conditionsToInsert = triggerData.conditions.map((cond) => ({
                trigger_id: triggerId,
                group_id: groupData.id,
                type: cond.condition_type || cond.type,
                condition_type: cond.condition_type || cond.type,
                operator: cond.operator,
                value: cond.value,
                payload: cond.payload || {},
            }))
            await supabase.from('trigger_conditions').insert(conditionsToInsert)
        } else {
            // Fallback: insert legacy conditions (no group)
            const conditionsToInsert = triggerData.conditions.map((cond) => ({
                trigger_id: triggerId,
                type: cond.condition_type || cond.type,
                condition_type: cond.condition_type || cond.type,
                operator: cond.operator,
                value: cond.value,
                payload: cond.payload || {},
            }))
            const { error: condErr } = await supabase.from('trigger_conditions').insert(conditionsToInsert)
            if (condErr) throw new Error(`Error al guardar condiciones: ${condErr.message}`)
        }
    }

    revalidatePath(`/dashboard/assistants/${assistantId}/triggers`)
    return triggerId
}

type SequenceProfileState = {
    businessProfile: Record<string, unknown>
    normalizedSettings: Record<AutomationSequenceKey, AutomationSequenceSetting>
    customPacks: AutomationSequenceCustomPackDefinition[]
}

async function getSequenceProfileState(userId: string): Promise<SequenceProfileState> {
    const supabase = await createClient()
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('business_profile')
        .eq('id', userId)
        .maybeSingle()

    const businessProfile =
        profile?.business_profile &&
        typeof profile.business_profile === 'object' &&
        !Array.isArray(profile.business_profile)
            ? profile.business_profile as Record<string, unknown>
            : {}

    return {
        businessProfile,
        normalizedSettings: normalizeAutomationSequenceProfileSettings(
            businessProfile.sequence_automation_settings,
        ),
        customPacks: normalizeAutomationSequenceCustomPacks(
            businessProfile.sequence_automation_custom_packs,
        ),
    }
}

async function applySequenceAutomationPackSettings(
    userId: string,
    businessProfile: Record<string, unknown>,
    nextSettings: Record<AutomationSequenceKey, AutomationSequenceSetting>,
) {
    const supabase = await createClient()

    const nextBusinessProfile = {
        ...businessProfile,
        sequence_automation_settings: nextSettings,
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({
            business_profile: nextBusinessProfile,
        })
        .eq('id', userId)

    if (error) {
        throw new Error(`No se pudo guardar el pack: ${error.message}`)
    }

    const { data: activeSequences } = await supabase
        .from('automation_sequences')
        .select('id, sequence_key, current_step, started_at, last_executed_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .in('sequence_key', AUTOMATION_SEQUENCE_KEYS)

    for (const sequence of activeSequences || []) {
        const sequenceKey = typeof sequence.sequence_key === 'string' ? sequence.sequence_key as AutomationSequenceKey : null
        if (!sequenceKey) continue

        const nextSetting = nextSettings[sequenceKey]
        if (!nextSetting.enabled) {
            await supabase
                .from('automation_sequences')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    cancel_reason: 'pack_installation_paused_sequence',
                })
                .eq('id', sequence.id)
            continue
        }

        const baseTimestamp =
            (sequence.current_step ?? 0) > 0
                ? sequence.last_executed_at || sequence.started_at
                : sequence.started_at

        if (!baseTimestamp) continue

        const baseDate = new Date(baseTimestamp)
        const delayMinutes = (sequence.current_step ?? 0) > 0
            ? nextSetting.secondDelayMinutes
            : nextSetting.firstDelayMinutes

        await supabase
            .from('automation_sequences')
            .update({
                scheduled_for: new Date(baseDate.getTime() + delayMinutes * 60_000).toISOString(),
            })
            .eq('id', sequence.id)
    }

    revalidatePath('/dashboard/assistants')
    revalidatePath('/dashboard/settings')
}

export async function getSequenceAutomationPanelData(): Promise<SequenceAutomationPanelData> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { items: [], customPacks: [] }

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('business_name, business_type, business_profile')
        .eq('id', user.id)
        .maybeSingle()

    const { data: credentials } = await supabase
        .from('whatsapp_credentials')
        .select('service_name, payment_methods, currency_symbol')
        .eq('user_id', user.id)
        .maybeSingle()

    const businessProfile =
        profile?.business_profile &&
        typeof profile.business_profile === 'object' &&
        !Array.isArray(profile.business_profile)
            ? profile.business_profile as Record<string, unknown>
            : {}
    const businessType = isBusinessType(profile?.business_type) ? profile.business_type : 'subscriptions'
    const businessGoals = normalizeBusinessGoalsForBusinessType(
        businessType,
        businessProfile.goals,
        getDefaultGoalsForBusinessType(businessType),
    )
    const serviceName =
        typeof credentials?.service_name === 'string' && credentials.service_name.trim().length > 0
            ? credentials.service_name.trim()
            : typeof profile?.business_name === 'string' && profile.business_name.trim().length > 0
                ? profile.business_name.trim()
                : 'tu servicio'
    const paymentMethods =
        typeof credentials?.payment_methods === 'string' && credentials.payment_methods.trim().length > 0
            ? credentials.payment_methods.trim()
            : 'los medios de pago disponibles'
    const currencySymbol =
        typeof credentials?.currency_symbol === 'string' && credentials.currency_symbol.trim().length > 0
            ? credentials.currency_symbol.trim()
            : 'Bs'

    const normalizedSettings = normalizeAutomationSequenceProfileSettings(
        businessProfile.sequence_automation_settings,
    )
    const customPacks = normalizeAutomationSequenceCustomPacks(
        businessProfile.sequence_automation_custom_packs,
    )
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: activeSequenceRows } = await supabase
        .from('automation_sequences')
        .select('sequence_key, status')
        .eq('user_id', user.id)
        .eq('status', 'active')

    const activeCounts = (activeSequenceRows || []).reduce<Record<string, number>>((accumulator, row) => {
        const key = typeof row.sequence_key === 'string' ? row.sequence_key : ''
        if (!key) return accumulator
        accumulator[key] = (accumulator[key] || 0) + 1
        return accumulator
    }, {})

    const { data: recentSequenceRows } = await supabase
        .from('automation_sequences')
        .select('id, sequence_key, status, current_step, created_at, started_at, scheduled_for, last_executed_at, completed_at, cancelled_at, cancel_reason, chat_id, order_id')
        .eq('user_id', user.id)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })

    const recentRows = (recentSequenceRows || []) as SequenceRow[]
    const chatIds = Array.from(new Set(recentRows.map((row) => row.chat_id).filter((value): value is string => Boolean(value))))
    const orderIds = Array.from(new Set(recentRows.map((row) => row.order_id).filter((value): value is string => Boolean(value))))

    const [chatResult, orderResult] = await Promise.all([
        chatIds.length > 0
            ? supabase.from('chats').select('id, contact_name, phone_number').in('id', chatIds)
            : Promise.resolve({ data: [] as ChatSummaryRow[] }),
        orderIds.length > 0
            ? supabase.from('orders').select('id, plan_name, customer_email, status').in('id', orderIds)
            : Promise.resolve({ data: [] as OrderSummaryRow[] }),
    ])

    const chatsById = new Map((chatResult.data || []).map((chat) => [chat.id, chat]))
    const ordersById = new Map((orderResult.data || []).map((order) => [order.id, order]))

    function buildActivity(row: SequenceRow) {
        const chat = row.chat_id ? chatsById.get(row.chat_id) : null
        const order = row.order_id ? ordersById.get(row.order_id) : null
        const contactName = chat?.contact_name?.trim() || chat?.phone_number || 'Cliente sin nombre'
        const planName = order?.plan_name?.trim() || 'plan'
        const email = order?.customer_email?.trim()

        if (row.status === 'active') {
            const stepLabel = (row.current_step ?? 0) > 0 ? '2do seguimiento pendiente' : '1er seguimiento pendiente'
            return {
                id: row.id,
                summary: `${contactName} sigue en espera`,
                detail: `${stepLabel} para ${planName}${email ? ` · ${email}` : ''}`,
                statusLabel: 'En espera',
                tone: 'blue' as const,
                timestamp: row.scheduled_for || row.created_at || new Date().toISOString(),
            }
        }

        if (row.cancel_reason === 'customer_replied') {
            return {
                id: row.id,
                summary: `${contactName} respondio`,
                detail: `La secuencia se detuvo porque el cliente contesto${email ? ` · ${email}` : ''}`,
                statusLabel: 'Respondio',
                tone: 'emerald' as const,
                timestamp: row.cancelled_at || row.created_at || new Date().toISOString(),
            }
        }

        if (row.cancel_reason === 'order_completed') {
            return {
                id: row.id,
                summary: `${contactName} avanzo`,
                detail: `La conversacion paso a orden completada para ${planName}${email ? ` · ${email}` : ''}`,
                statusLabel: 'Avanzo',
                tone: 'emerald' as const,
                timestamp: row.cancelled_at || row.created_at || new Date().toISOString(),
            }
        }

        if (row.cancel_reason === 'payment_under_review') {
            return {
                id: row.id,
                summary: `${contactName} envio comprobante`,
                detail: `La conversacion paso a revision manual para ${planName}${email ? ` · ${email}` : ''}`,
                statusLabel: 'A revision',
                tone: 'amber' as const,
                timestamp: row.cancelled_at || row.created_at || new Date().toISOString(),
            }
        }

        if (row.cancel_reason === 'chat_already_advanced') {
            return {
                id: row.id,
                summary: `${contactName} ya avanzo`,
                detail: `La secuencia se detuvo porque el chat ya tenia una etiqueta de cierre o avance${email ? ` - ${email}` : ''}`,
                statusLabel: 'Avanzo',
                tone: 'emerald' as const,
                timestamp: row.cancelled_at || row.created_at || new Date().toISOString(),
            }
        }

        if (row.cancel_reason === 'template_required_outside_24h') {
            return {
                id: row.id,
                summary: `${contactName} quedo fuera de ventana`,
                detail: `No se envio el seguimiento porque ya pasaron 24h y no hay plantilla Meta configurada${email ? ` - ${email}` : ''}`,
                statusLabel: 'Requiere plantilla',
                tone: 'amber' as const,
                timestamp: row.cancelled_at || row.created_at || new Date().toISOString(),
            }
        }

        if (row.cancel_reason === 'template_send_failed') {
            return {
                id: row.id,
                summary: `${contactName} no recibio plantilla`,
                detail: `Meta rechazo o no proceso la plantilla configurada${email ? ` - ${email}` : ''}`,
                statusLabel: 'Plantilla fallo',
                tone: 'amber' as const,
                timestamp: row.cancelled_at || row.created_at || new Date().toISOString(),
            }
        }

        if (row.status === 'completed') {
            return {
                id: row.id,
                summary: `${contactName} no respondio a tiempo`,
                detail: `La secuencia termino despues de enviar todos los seguimientos para ${planName}${email ? ` · ${email}` : ''}`,
                statusLabel: 'Terminada',
                tone: 'slate' as const,
                timestamp: row.completed_at || row.created_at || new Date().toISOString(),
            }
        }

        return {
            id: row.id,
            summary: `${contactName} detuvo la secuencia`,
            detail: `Motivo: ${row.cancel_reason || 'sin detalle'}${email ? ` · ${email}` : ''}`,
            statusLabel: 'Detenida',
            tone: 'slate' as const,
            timestamp: row.cancelled_at || row.created_at || new Date().toISOString(),
        }
    }

    const conversionCancelReasons = ['order_completed', 'payment_under_review', 'chat_already_advanced']
    const items = Object.values(AUTOMATION_SEQUENCE_PRESETS).map((preset) => {
        const rowsForPreset = recentRows.filter((row) => row.sequence_key === preset.key)
        const startedLast30Days = rowsForPreset.length
        const repliedLast30Days = rowsForPreset.filter((row) => row.cancel_reason === 'customer_replied').length
        const advancedLast30Days = rowsForPreset.filter((row) => conversionCancelReasons.includes(row.cancel_reason || '')).length
        const meaningfulOutcomes = repliedLast30Days + advancedLast30Days

        return {
            key: preset.key,
            title: preset.title,
            shortTitle: preset.shortTitle,
            description: preset.description,
            triggerLabel: preset.triggerLabel,
            outcomeLabel: preset.outcomeLabel,
            helperText: preset.helperText,
            activeRuns: activeCounts[preset.key] || 0,
            metrics: {
                startedLast30Days,
                completedLast30Days: rowsForPreset.filter((row) => row.status === 'completed').length,
                sentLast30Days: rowsForPreset.reduce((total, row) => total + Math.max(row.current_step ?? 0, 0), 0),
                repliedLast30Days,
                advancedLast30Days,
                cancelledByReplyLast30Days: repliedLast30Days,
                cancelledByConversionLast30Days: advancedLast30Days,
                reactivationRate: startedLast30Days > 0 ? Math.round((meaningfulOutcomes / startedLast30Days) * 100) : 0,
            },
            recentActivity: rowsForPreset
                .slice(0, 4)
                .map(buildActivity),
            simulationDefaults: {
                planName: preset.key === 'renewal_pending_payment_followup'
                    ? 'Plan Renovacion Pro'
                    : preset.key === 'booking_confirmation_reminder'
                        ? 'Reserva de ejemplo'
                        : preset.key === 'support_escalation_sla'
                            ? 'Caso de soporte'
                            : 'Plan Premium',
                serviceName,
                paymentMethods,
                currencySymbol,
                amount: preset.key === 'sales_pending_email_followup' ? 69 : 99,
                customerEmail: 'cliente@ejemplo.com',
                contactName: 'Cliente',
                triggerText: preset.key === 'booking_confirmation_reminder'
                    ? 'Quiero agendar una cita'
                    : preset.key === 'support_escalation_sla'
                        ? 'Necesito ayuda con mi servicio'
                        : 'Quiero mas informacion',
                goals: businessGoals,
            },
            ...normalizedSettings[preset.key],
        }
    })

    return {
        items,
        customPacks,
    }
}

export async function getSequenceAutomationConfigs(): Promise<SequenceAutomationListItem[]> {
    const panelData = await getSequenceAutomationPanelData()
    return panelData.items
}

export async function saveSequenceAutomationConfig(
    config: {
        key: AutomationSequenceKey
        enabled: boolean
        firstDelayMinutes: number
        secondDelayMinutes: number
        firstMessage: string
        secondMessage: string
        firstTemplateName?: string
        firstTemplateLanguage?: string
        firstTemplateVariables?: string[]
        secondTemplateName?: string
        secondTemplateLanguage?: string
        secondTemplateVariables?: string[]
    },
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('business_profile')
        .eq('id', user.id)
        .maybeSingle()

    const businessProfile =
        profile?.business_profile &&
        typeof profile.business_profile === 'object' &&
        !Array.isArray(profile.business_profile)
            ? profile.business_profile as Record<string, unknown>
            : {}

    const currentSettings =
        businessProfile.sequence_automation_settings &&
        typeof businessProfile.sequence_automation_settings === 'object' &&
        !Array.isArray(businessProfile.sequence_automation_settings)
            ? businessProfile.sequence_automation_settings as Record<string, unknown>
            : {}

    const nextBusinessProfile = {
        ...businessProfile,
        sequence_automation_settings: {
            ...currentSettings,
            [config.key]: {
                enabled: config.enabled,
                firstDelayMinutes: config.firstDelayMinutes,
                secondDelayMinutes: config.secondDelayMinutes,
                firstMessage: config.firstMessage,
                secondMessage: config.secondMessage,
                firstTemplateName: config.firstTemplateName || '',
                firstTemplateLanguage: config.firstTemplateLanguage || 'es',
                firstTemplateVariables: config.firstTemplateVariables || [],
                secondTemplateName: config.secondTemplateName || '',
                secondTemplateLanguage: config.secondTemplateLanguage || 'es',
                secondTemplateVariables: config.secondTemplateVariables || [],
            },
        },
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({
            business_profile: nextBusinessProfile,
        })
        .eq('id', user.id)

    if (error) {
        throw new Error(`No se pudo guardar la secuencia: ${error.message}`)
    }

    const { data: activeSequences } = await supabase
        .from('automation_sequences')
        .select('id, current_step, started_at, last_executed_at')
        .eq('user_id', user.id)
        .eq('sequence_key', config.key)
        .eq('status', 'active')

    if (!config.enabled) {
        for (const sequence of activeSequences || []) {
            await supabase
                .from('automation_sequences')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    cancel_reason: 'sequence_disabled_from_dashboard',
                })
                .eq('id', sequence.id)
        }

        revalidatePath('/dashboard/assistants')
        revalidatePath('/dashboard/settings')
        return
    }

    for (const sequence of activeSequences || []) {
        const baseTimestamp =
            (sequence.current_step ?? 0) > 0
                ? sequence.last_executed_at || sequence.started_at
                : sequence.started_at

        if (!baseTimestamp) continue

        const baseDate = new Date(baseTimestamp)
        const delayMinutes = (sequence.current_step ?? 0) > 0
            ? config.secondDelayMinutes
            : config.firstDelayMinutes

        await supabase
            .from('automation_sequences')
            .update({
                scheduled_for: new Date(baseDate.getTime() + delayMinutes * 60_000).toISOString(),
            })
            .eq('id', sequence.id)
    }

    revalidatePath('/dashboard/assistants')
    revalidatePath('/dashboard/settings')
}

export async function installSequenceAutomationPack(packKey: AutomationSequencePackKey) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const pack = AUTOMATION_SEQUENCE_PACKS[packKey]
    if (!pack) {
        throw new Error('El pack solicitado no existe.')
    }

    const { businessProfile, normalizedSettings } = await getSequenceProfileState(user.id)

    const nextSettings = AUTOMATION_SEQUENCE_KEYS.reduce<Record<AutomationSequenceKey, AutomationSequenceSetting>>((accumulator, key) => {
        accumulator[key] = {
            ...normalizedSettings[key],
            enabled: pack.sequenceKeys.includes(key),
        }
        return accumulator
    }, {} as Record<AutomationSequenceKey, AutomationSequenceSetting>)

    await applySequenceAutomationPackSettings(user.id, businessProfile, nextSettings)
}

export async function saveCustomSequenceAutomationPack(input: {
    key?: string
    title: string
    sequenceKeys: AutomationSequenceKey[]
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = input.title.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (title.length < 3) {
        throw new Error('Ponle un nombre corto pero claro al pack para que luego sea facil reconocerlo.')
    }

    const uniqueSequenceKeys = Array.from(new Set(
        input.sequenceKeys.filter((key) => AUTOMATION_SEQUENCE_KEYS.includes(key)),
    )) as AutomationSequenceKey[]

    if (uniqueSequenceKeys.length === 0) {
        throw new Error('Elige al menos una secuencia para guardar el pack.')
    }

    const { businessProfile, customPacks } = await getSequenceProfileState(user.id)
    const existingPack = input.key
        ? customPacks.find((pack) => pack.key === input.key)
        : null

    if (!existingPack && customPacks.length >= 12) {
        throw new Error('Por ahora puedes guardar hasta 12 packs propios para que el panel siga siendo facil de usar.')
    }

    const now = new Date().toISOString()
    const nextPack: AutomationSequenceCustomPackDefinition = {
        key: existingPack?.key || `custom_pack_${Date.now()}`,
        title,
        sequenceKeys: uniqueSequenceKeys,
        createdAt: existingPack?.createdAt || now,
        updatedAt: now,
    }

    const nextCustomPacks = [
        nextPack,
        ...customPacks.filter((pack) => pack.key !== nextPack.key),
    ]

    const { error } = await supabase
        .from('user_profiles')
        .update({
            business_profile: {
                ...businessProfile,
                sequence_automation_custom_packs: nextCustomPacks,
            },
        })
        .eq('id', user.id)

    if (error) {
        throw new Error(`No se pudo guardar el pack propio: ${error.message}`)
    }

    revalidatePath('/dashboard/assistants')
    revalidatePath('/dashboard/settings')
}

export async function deleteCustomSequenceAutomationPack(packKey: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { businessProfile, customPacks } = await getSequenceProfileState(user.id)
    const nextCustomPacks = customPacks.filter((pack) => pack.key !== packKey)

    if (nextCustomPacks.length === customPacks.length) {
        throw new Error('Ese pack ya no existe o fue eliminado.')
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({
            business_profile: {
                ...businessProfile,
                sequence_automation_custom_packs: nextCustomPacks,
            },
        })
        .eq('id', user.id)

    if (error) {
        throw new Error(`No se pudo borrar el pack propio: ${error.message}`)
    }

    revalidatePath('/dashboard/assistants')
    revalidatePath('/dashboard/settings')
}

export async function installCustomSequenceAutomationPack(packKey: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { businessProfile, normalizedSettings, customPacks } = await getSequenceProfileState(user.id)
    const pack = customPacks.find((entry) => entry.key === packKey)

    if (!pack) {
        throw new Error('Ese pack propio ya no existe o no esta disponible.')
    }

    const nextSettings = AUTOMATION_SEQUENCE_KEYS.reduce<Record<AutomationSequenceKey, AutomationSequenceSetting>>((accumulator, key) => {
        accumulator[key] = {
            ...normalizedSettings[key],
            enabled: pack.sequenceKeys.includes(key),
        }
        return accumulator
    }, {} as Record<AutomationSequenceKey, AutomationSequenceSetting>)

    await applySequenceAutomationPackSettings(user.id, businessProfile, nextSettings)
}

// ── Pausa global de automatizaciones ──────────────────────────────────────────

export async function pauseAllTriggers(): Promise<{ paused: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('triggers')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .select('id')

    if (error) throw error
    revalidatePath('/dashboard/assistants/[assistantId]/triggers', 'page')
    return { paused: data?.length ?? 0 }
}

export async function resumeAllTriggers(): Promise<{ resumed: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('triggers')
        .update({ is_active: true })
        .eq('user_id', user.id)
        .eq('is_active', false)
        .select('id')

    if (error) throw error
    revalidatePath('/dashboard/assistants/[assistantId]/triggers', 'page')
    return { resumed: data?.length ?? 0 }
}

export async function getGlobalPauseState(): Promise<{ allPaused: boolean; total: number; active: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { allPaused: false, total: 0, active: 0 }

    const { data } = await supabase
        .from('triggers')
        .select('is_active')
        .eq('user_id', user.id)

    if (!data || data.length === 0) return { allPaused: false, total: 0, active: 0 }
    const active = data.filter((t: { is_active: boolean }) => t.is_active).length
    return { allPaused: active === 0, total: data.length, active }
}
