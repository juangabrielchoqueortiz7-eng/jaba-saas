'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createAssistant(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Usuario no autenticado' }
    }

    try {
        const payload = {
            user_id: user.id,
            bot_name: formData.get('bot_name') as string,
            phone_number_display: formData.get('phone_number_display') as string,
            welcome_message: formData.get('welcome_message') as string,

            // AI Config
            ai_status: formData.get('ai_status') as string,
            response_delay_seconds: parseInt(formData.get('response_delay_seconds') as string) || 5,
            audio_probability: parseInt(formData.get('audio_probability') as string) || 0,
            message_delivery_mode: formData.get('message_delivery_mode') as string,
            use_emojis: formData.get('use_emojis') === 'true',
            use_text_styles: formData.get('use_text_styles') === 'true',
            audio_voice_id: formData.get('audio_voice_id') as string,
            max_audio_count: parseInt(formData.get('max_audio_count') as string) || 2,
            reply_audio_with_audio: formData.get('reply_audio_with_audio') === 'true',

            // Chat Credentials
            phone_number_id: formData.get('phone_number_id') as string,
            waba_id: formData.get('waba_id') as string,
            app_id: formData.get('app_id') as string,
            access_token: formData.get('access_token') as string,
        }

        const { error } = await supabase.from('whatsapp_credentials').insert(payload)

        if (error) {
            console.error('Error inserting assistant:', error)
            // Handle unique violation for phone_number_id
            if (error.code === '23505') {
                return { success: false, error: 'Este ID de teléfono ya está registrado' }
            }
            return { success: false, error: error.message }
        }

        revalidatePath('/dashboard/assistants')
        return { success: true }
    } catch (error: any) {
        console.error('Create assistant error:', error)
        return { success: false, error: error.message }
    }
}
