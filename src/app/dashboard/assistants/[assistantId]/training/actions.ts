'use server'

import { createClient } from '@/utils/supabase/server'

export async function getTrainingPrompt(assistantId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('whatsapp_credentials')
        .select('training_prompt, bot_name')
        .eq('id', assistantId)
        .eq('user_id', user.id)
        .single()

    if (error) {
        console.error('Error fetching training prompt:', error)
        return null
    }

    return data
}

export async function saveTrainingPrompt(assistantId: string, prompt: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { error } = await supabase
        .from('whatsapp_credentials')
        .update({
            training_prompt: prompt,
            updated_at: new Date().toISOString()
        })
        .eq('id', assistantId)
        .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
}
