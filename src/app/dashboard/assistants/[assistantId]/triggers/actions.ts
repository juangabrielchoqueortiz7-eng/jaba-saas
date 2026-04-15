'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
                description: triggerData.description
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
