'use server'

import { createClient } from '@/utils/supabase/server'
import { isBusinessType, type BusinessType } from '@/lib/business-config'
import { normalizeBusinessGoalsForBusinessType } from '@/lib/business-goals'
import {
    buildSuggestedTrainingForm,
    buildSuggestedTrainingPrompt,
    type TrainingProductInput,
} from '@/lib/business-training'

export async function getTrainingPrompt(assistantId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('whatsapp_credentials')
        .select('training_prompt, bot_name, welcome_message, service_name, service_description')
        .eq('id', assistantId)
        .eq('user_id', user.id)
        .single()

    if (error) {
        console.error('Error fetching training prompt:', error)
        return null
    }

    const [{ data: profile }, { data: products }] = await Promise.all([
        supabase
            .from('user_profiles')
            .select('business_name, business_type, business_profile')
            .eq('id', user.id)
            .maybeSingle(),
        supabase
            .from('products')
            .select('name, price, description')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(6),
    ])

    const businessType: BusinessType = isBusinessType(profile?.business_type)
        ? profile.business_type
        : 'subscriptions'

    const businessProfile =
        profile?.business_profile &&
            typeof profile.business_profile === 'object' &&
            !Array.isArray(profile.business_profile)
            ? profile.business_profile as { goals?: unknown }
            : {}

    const goals = normalizeBusinessGoalsForBusinessType(businessType, businessProfile.goals)
    const suggestedContext = {
        assistantName: data.bot_name,
        businessName: profile?.business_name ?? data.service_name,
        businessType,
        goals,
        welcomeMessage: data.welcome_message,
        serviceName: data.service_name,
        serviceDescription: data.service_description,
        products: (products ?? []) as TrainingProductInput[],
    }

    return {
        ...data,
        suggested_prompt: buildSuggestedTrainingPrompt(suggestedContext),
        suggested_form: buildSuggestedTrainingForm(suggestedContext),
    }
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
