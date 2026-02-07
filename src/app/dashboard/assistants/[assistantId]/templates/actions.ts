'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type Template = {
    id: string
    name: string
    content: string
    created_at: string
}

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
