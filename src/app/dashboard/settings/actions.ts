'use server'

import { createClient } from '@/utils/supabase/server'

export async function checkWhatsAppStatus(phoneNumberId: string, accessToken: string) {
    if (!phoneNumberId || !accessToken) {
        return { success: false, error: 'Faltan credenciales' }
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,quality_rating,verified_name,code_verification_status`, {
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
                status: data.code_verification_status // 'NOT_VERIFIED', 'VERIFIED'
            }
        }
    } catch (error) {
        console.error('Error fetching WhatsApp status:', error)
        return { success: false, error: 'Error de conexión con Meta' }
    }
}
