'use server'

import { createClient } from '@/utils/supabase/server'
import {
    getModulesForBusinessType,
    isBusinessType,
    normalizeBusinessModules,
    type BusinessModule,
} from '@/lib/business-config'
import {
    getDefaultGoalsForBusinessType,
    normalizeBusinessGoalsForBusinessType,
    type BusinessGoal,
} from '@/lib/business-goals'
import { seedStarterTemplatesForBusinessType } from '@/lib/business-starter-seed'

type MetaErrorPayload = {
    message?: string
    error_user_msg?: string
}

type MetaHealthEntity = {
    description?: string
}

type MetaHealthStatus =
    | string
    | {
        CAN_SEND_MESSAGE?: string
        entities?: MetaHealthEntity[]
    }

type MetaGraphResponse = {
    error?: MetaErrorPayload
    display_phone_number?: string
    quality_rating?: string
    verified_name?: string
    code_verification_status?: string
    health_status?: MetaHealthStatus
    name_status?: string
    messages?: Array<{ id?: string }>
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

function getMetaErrorMessage(data: MetaGraphResponse, fallback: string) {
    return data.error?.error_user_msg || data.error?.message || fallback
}

function getHealthStatusLabel(health: MetaHealthStatus | undefined) {
    if (!health || typeof health === 'string') {
        return health || 'Estado desconocido'
    }

    if (health.CAN_SEND_MESSAGE === 'BLOCKED') {
        return 'Bloqueado por Meta'
    }

    if (health.entities && health.entities.length > 0) {
        return health.entities[0]?.description || 'Problema de cuenta'
    }

    return 'Estado desconocido'
}

function requiresRegistration(health: MetaHealthStatus | undefined) {
    if (!health || typeof health === 'string') {
        return false
    }

    const isBlocked = health.CAN_SEND_MESSAGE === 'BLOCKED'
    const hasIssues = Boolean(health.entities && health.entities.length > 0)
    return isBlocked || hasIssues
}

type UpdateBusinessProfileInput = {
    businessType: string
    enabledModules: string[]
    goals?: string[]
}

export async function updateBusinessProfileSettings(input: UpdateBusinessProfileInput) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, error: 'No autorizado' }
    }

    if (!isBusinessType(input.businessType)) {
        return { success: false, error: 'Selecciona un tipo de negocio valido' }
    }

    const businessType = input.businessType
    const fallbackModules = getModulesForBusinessType(businessType)
    const enabledModules = normalizeBusinessModules(input.enabledModules, fallbackModules)
    const goals = normalizeBusinessGoalsForBusinessType(businessType, input.goals)

    const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('business_profile')
        .eq('id', user.id)
        .maybeSingle()

    const currentBusinessProfile =
        existingProfile?.business_profile &&
            typeof existingProfile.business_profile === 'object' &&
            !Array.isArray(existingProfile.business_profile)
            ? existingProfile.business_profile as Record<string, unknown>
            : {}

    const nextBusinessProfile = {
        ...currentBusinessProfile,
        goals,
        configured_from_settings: true,
        updated_from_settings_at: new Date().toISOString(),
    }

    const { error } = await supabase
        .from('user_profiles')
        .upsert({
            id: user.id,
            business_type: businessType,
            enabled_modules: enabledModules as BusinessModule[],
            onboarding_completed: true,
            business_profile: nextBusinessProfile,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        console.error('[Settings] Error updating business profile:', error)
        return { success: false, error: 'No se pudo actualizar la configuracion del negocio' }
    }

    return {
        success: true,
        businessType,
        modules: enabledModules,
        goals: goals as BusinessGoal[],
    }
}

export async function installRecommendedStarterTemplates() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, error: 'No autorizado' }
    }

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('business_type, business_profile')
        .eq('id', user.id)
        .maybeSingle()

    if (profileError) {
        return { success: false, error: 'No se pudo leer el perfil del negocio' }
    }

    if (!isBusinessType(profile?.business_type)) {
        return { success: false, error: 'Primero selecciona el tipo de negocio en el onboarding' }
    }

    try {
        const businessProfile =
            profile?.business_profile &&
                typeof profile.business_profile === 'object' &&
                !Array.isArray(profile.business_profile)
                ? profile.business_profile as Record<string, unknown>
                : {}

        const goals = normalizeBusinessGoalsForBusinessType(
            profile.business_type,
            businessProfile.goals,
            getDefaultGoalsForBusinessType(profile.business_type),
        )

        const result = await seedStarterTemplatesForBusinessType(supabase, user.id, profile.business_type, goals)
        return {
            success: true,
            flows: result.flows.length,
            triggers: result.triggers.length,
        }
    } catch (error) {
        console.error('[Settings] Error installing starter templates:', error)
        return {
            success: false,
            error: getErrorMessage(error, 'No se pudieron instalar las plantillas'),
        }
    }
}

export async function checkWhatsAppStatus(phoneNumberId: string, accessToken: string) {
    if (!phoneNumberId || !accessToken) {
        return { success: false, error: 'Faltan credenciales' }
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,quality_rating,verified_name,code_verification_status,health_status,name_status`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        const data = (await response.json()) as MetaGraphResponse

        if (data.error) {
            return { success: false, error: getMetaErrorMessage(data, 'No se pudo consultar el estado') }
        }

        return {
            success: true,
            data: {
                display_phone_number: data.display_phone_number,
                quality_rating: data.quality_rating,
                verified_name: data.verified_name,
                status: data.code_verification_status,
                health_status: getHealthStatusLabel(data.health_status),
                name_status: data.name_status,
                requires_registration: requiresRegistration(data.health_status),
            },
        }
    } catch (error) {
        console.error('Error fetching WhatsApp status:', error)
        return { success: false, error: 'Error de conexion con Meta' }
    }
}

export async function requestWhatsAppCode(phoneNumberId: string, accessToken: string) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/request_code`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                code_method: 'SMS',
                language: 'es_LA',
            }),
        })

        const data = (await response.json()) as MetaGraphResponse

        if (data.error) {
            console.error('Request Code Error:', JSON.stringify(data.error))
            throw new Error(getMetaErrorMessage(data, 'No se pudo solicitar el codigo'))
        }

        return { success: true }
    } catch (error) {
        return { success: false, error: getErrorMessage(error, 'No se pudo solicitar el codigo') }
    }
}

export async function verifyWhatsAppCode(phoneNumberId: string, accessToken: string, code: string) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/verify_code`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
        })

        const data = (await response.json()) as MetaGraphResponse

        if (data.error) {
            throw new Error(getMetaErrorMessage(data, 'No se pudo verificar el codigo'))
        }

        return { success: true }
    } catch (error) {
        return { success: false, error: getErrorMessage(error, 'No se pudo verificar el codigo') }
    }
}

export async function registerWhatsAppNumber(phoneNumberId: string, accessToken: string, pin: string) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                pin,
            }),
        })

        const data = (await response.json()) as MetaGraphResponse

        if (data.error) {
            console.error('Register WhatsApp Error:', JSON.stringify(data.error))
            throw new Error(getMetaErrorMessage(data, 'No se pudo registrar el numero'))
        }

        return { success: true }
    } catch (error) {
        return { success: false, error: getErrorMessage(error, 'No se pudo registrar el numero') }
    }
}

export async function getSystemConfig() {
    return {
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'No configurado en .env',
        hasGoogleApiKey: Boolean(process.env.GOOGLE_API_KEY),
        webhookUrl: process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`
            : 'https://jabachat.com/api/webhook',
    }
}

export async function testWebhook(webhookUrl: string, verifyToken: string) {
    try {
        const challenge = `jaba_test_${Date.now()}`
        const url = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`
        const response = await fetch(url, { cache: 'no-store' })
        const text = await response.text()

        if (text.trim() === challenge) {
            return { success: true }
        }

        return { success: false, error: `Respuesta inesperada: "${text.slice(0, 100)}"` }
    } catch (error) {
        return { success: false, error: getErrorMessage(error, 'Error de conexion') }
    }
}

export async function sendTestWhatsAppMessage(phoneNumberId: string, accessToken: string, toPhone: string) {
    if (!phoneNumberId || !accessToken || !toPhone) {
        return { success: false, error: 'Faltan datos' }
    }

    try {
        const clean = toPhone.replace(/\D/g, '')
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: clean,
                type: 'text',
                text: {
                    body: 'Hola. Este es un mensaje de prueba enviado desde *JABA*.\n\nTu conexion de WhatsApp esta funcionando correctamente.',
                },
            }),
        })

        const data = (await response.json()) as MetaGraphResponse

        if (data.error) {
            return { success: false, error: getMetaErrorMessage(data, 'No se pudo enviar el mensaje de prueba') }
        }

        return { success: true, messageId: data.messages?.[0]?.id }
    } catch (error) {
        return { success: false, error: getErrorMessage(error, 'Error de conexion con Meta') }
    }
}
