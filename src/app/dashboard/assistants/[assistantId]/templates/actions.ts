'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type Template = {
    id: string
    name: string
    content: string
    created_at: string
}

type SubscriptionSettingsInput = Record<string, unknown>

export async function getTemplates() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching templates:', error)
        return []
    }

    return data as Template[]
}

export async function createTemplate(name: string, content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('templates')
        .insert({
            user_id: user.id,
            name,
            content
        })

    if (error) throw error

    revalidatePath('/dashboard/assistants')
}

export async function updateTemplate(id: string, name: string, content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('templates')
        .update({ name, content })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/assistants')
}

export async function deleteTemplate(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id) // Security check

    if (error) throw error

    revalidatePath('/dashboard/assistants')
}

export async function getSubscriptionSettings() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data } = await supabase
        .from('subscription_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    return data
}

export async function updateSubscriptionSettings(settings: SubscriptionSettingsInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: existing } = await supabase
        .from('subscription_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (existing) {
        await supabase.from('subscription_settings').update(settings).eq('user_id', user.id)
    } else {
        await supabase.from('subscription_settings').insert({ user_id: user.id, ...settings })
    }
    revalidatePath('/dashboard/assistants')
}
