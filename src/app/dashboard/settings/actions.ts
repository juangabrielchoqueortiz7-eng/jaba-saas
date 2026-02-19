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
                quality_rating: data.quality_rating,
                verified_name: data.verified_name,
                status: data.code_verification_status,
                health_status: (() => {
                    const health = data.health_status;
                    if (typeof health === 'object') {
                        if (health.CAN_SEND_MESSAGE === 'BLOCKED') return 'Bloqueado por Meta';
                        if (health.entities && health.entities.length > 0) {
                            return health.entities[0].description || 'Problema de Cuenta';
                        }
                        return 'Estado Desconocido';
                    }
                    return health;
                })(),
                name_status: data.name_status,
                requires_registration: (() => {
                    const health = data.health_status;
                    if (typeof health === 'object') {
                        // Check for specific error 131030 or blocked status
                        const isBlocked = health.CAN_SEND_MESSAGE === 'BLOCKED';
                        const hasIssues = health.entities && health.entities.length > 0;
                        return isBlocked || hasIssues;
                    }
                    return false;
                })()
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
                messaging_product: 'whatsapp',
                code_method: 'SMS',
                language: 'es_LA'
            })
        })

        const data = await response.json()
        if (data.error) {
            console.error('Request Code Error:', JSON.stringify(data.error))
            // Return full error details to UI
            const errorMsg = data.error.error_user_msg || data.error.message || JSON.stringify(data.error)
            throw new Error(errorMsg)
        }
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

export async function registerWhatsAppNumber(phoneNumberId: string, accessToken: string, pin: string) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                pin: pin
            })
        })

        const data = await response.json()
        if (data.error) {
            console.error('Register WhatsApp Error:', JSON.stringify(data.error))
            const errorMsg = data.error.error_user_msg || data.error.message || JSON.stringify(data.error)
            throw new Error(errorMsg)
        }
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
