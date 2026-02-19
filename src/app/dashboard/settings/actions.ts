'use server'

import { createClient } from '@/utils/supabase/server'

export async function checkWhatsAppStatus(phoneNumberId: string, accessToken: string) {
    if (!phoneNumberId || !accessToken) {
        return { success: false, error: 'Faltan credenciales' }
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,quality_rating,verified_name,code_verification_status,health_status,name_status`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        const data = await response.json()

        if (data.error) {
            return { success: false, error: data.error.message }
        }

        return {
            success: true,
            data: {
                display_phone_number: data.display_phone_number,
                quality_rating: data.quality_rating, // 'GREEN', 'YELLOW', 'RED', 'UNKNOWN'
                verified_name: data.verified_name,
                status: data.code_verification_status, // 'NOT_VERIFIED', 'VERIFIED'
                health_status: typeof data.health_status === 'object' ? (data.health_status?.entity || JSON.stringify(data.health_status)) : data.health_status,
                name_status: data.name_status
            }
        }
    } catch (error) {
        console.error('Error fetching WhatsApp status:', error)
        return { success: false, error: 'Error de conexión con Meta' }
    }
}

export async function requestWhatsAppCode(phoneNumberId: string, accessToken: string) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/request_code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code_method: 'SMS',
                language: 'es_LA'
            })
        })

        const data = await response.json()
        if (data.error) throw new Error(data.error.message)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function verifyWhatsAppCode(phoneNumberId: string, accessToken: string, code: string) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/verify_code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code
            })
        })

        const data = await response.json()
        if (data.error) throw new Error(data.error.message)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getSystemConfig() {
    return {
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'No configurado en .env',
        hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
        webhookUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook` : 'https://[TU-DOMINIO]/api/webhook'
    }
}
