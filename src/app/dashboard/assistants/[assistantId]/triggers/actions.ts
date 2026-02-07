'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type Trigger = {
    id: string
    name: string
    type: 'logic' | 'flow' | 'time' | 'manual'
    description: string | null
    is_active: boolean
    created_at: string
    trigger_actions: { count: number }[] // Adjusted for common count patterns, or we fetch count separately
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
            *,
            trigger_actions (count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching triggers:', error)
        return []
    }

    // Transform data to include action count cleanly
    return data.map((t: any) => ({
        ...t,
        action_count: t.trigger_actions[0]?.count || 0
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
            trigger_conditions (*)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (error) {
        console.error('Error fetching trigger:', error)
        return null
    }

    // Sort actions by order
    if (data.trigger_actions) {
        data.trigger_actions.sort((a: any, b: any) => a.action_order - b.action_order)
    }
    return data
}

export async function saveTrigger(
    assistantId: string, // Not used in DB but useful for revalidation path if needed context
    triggerData: {
        id?: string,
        name: string,
        type: 'logic' | 'flow' | 'time' | 'manual',
        description: string,
        actions: { type: string, payload: any }[]
    }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    let triggerId = triggerData.id

    // 1. Upsert Trigger
    if (triggerId) {
        // Update
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
        // Insert
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
        if (error) throw error
        triggerId = data.id
    }

    if (!triggerId) throw new Error('Failed to save trigger')

    // 2. Manage Actions (Full replacement strategy for simplicity)
    // First delete existing actions if updating
    if (triggerData.id) {
        await supabase.from('trigger_actions').delete().eq('trigger_id', triggerId)
    }

    // Then insert new ones
    if (triggerData.actions.length > 0) {
        const actionsToInsert = triggerData.actions.map((action, index) => ({
            trigger_id: triggerId,
            type: action.type,
            payload: action.payload,
            action_order: index
        }))

        const { error: actionsError } = await supabase
            .from('trigger_actions')
            .insert(actionsToInsert)

        if (actionsError) throw actionsError
    }

    revalidatePath(`/dashboard/assistants/${assistantId}/triggers`)
    return triggerId
}
