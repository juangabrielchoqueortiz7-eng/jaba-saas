'use server'

import { generateChatResponse } from "@/lib/ai"
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function simulateChatAction(
    history: { role: 'user' | 'assistant', content: string }[],
    systemPrompt: string
) {
    if (!history || history.length === 0) return ""

    const lastMessage = history[history.length - 1]
    if (lastMessage.role !== 'user') return "" // Should not happen if called correctly

    // Convert history format to Gemini format
    // Gemini expects { role: 'user' | 'model', parts: [{ text: string }] } or simple parts string for simple text
    // actually simple content is { role: string, parts: string } in some sdk versions or parts: [{text: ...}]
    // Using simple format: { role: 'user' | 'model', parts: string } for my helper function wrapper

    // We exclude the Last Message because sendMessage takes it separately
    let historyParams = history.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    })) as { role: 'user' | 'model', parts: { text: string }[] }[]

    // Gemini requires history to start with 'user'. Drop leading 'model' messages.
    while (historyParams.length > 0 && historyParams[0].role !== 'user') {
        historyParams.shift();
    }

    const response = await generateChatResponse(historyParams, lastMessage.content, systemPrompt)
    return response
}

export async function deleteAssistant(id: string) {
    const supabase = await createClient()

    // Verify user owns the assistant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Usuario no autenticado' }
    }

    try {
        const { error } = await supabase
            .from('whatsapp_credentials')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id) // Security check: must own the record

        if (error) {
            console.error('Error deleting assistant:', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/dashboard/assistants')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
