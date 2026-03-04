import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppList } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST: Reenviar la lista de planes a un chat específico
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const token = authHeader.replace('Bearer ', '')
        const anonClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { user } } = await anonClient.auth.getUser(token)
        if (!user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

        const { chatId } = await request.json()
        if (!chatId) return NextResponse.json({ error: 'chatId requerido' }, { status: 400 })

        // Obtener datos del chat
        const { data: chat } = await supabaseAdmin
            .from('chats')
            .select('phone_number, contact_name')
            .eq('id', chatId)
            .eq('user_id', user.id)
            .single()

        if (!chat) return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 })

        // Obtener credenciales de WhatsApp del usuario
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id')
            .eq('user_id', user.id)
            .single()

        if (!creds?.access_token || !creds?.phone_number_id) {
            return NextResponse.json({ error: 'Credenciales de WhatsApp no configuradas' }, { status: 400 })
        }

        // Obtener productos activos del usuario
        const { data: products } = await supabaseAdmin
            .from('products')
            .select('id, name, price, description, duration_months')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .limit(10)

        if (!products || products.length === 0) {
            return NextResponse.json({ error: 'No hay productos activos configurados' }, { status: 400 })
        }

        const listBody = `📋 *Nuestros planes disponibles:*\n\nElige el plan que más te convenga y te enviaremos el QR de pago inmediatamente.\n\n💡 Todos incluyen acceso completo al servicio.`

        const sections = [{
            title: 'Planes disponibles',
            rows: products.map(p => ({
                id: `product_${p.id}`,
                title: p.name.substring(0, 24),
                description: (`Bs ${p.price}${p.duration_months ? ` · ${p.duration_months} mes${p.duration_months !== 1 ? 'es' : ''}` : ''}${p.description ? ` · ${p.description}` : ''}`).substring(0, 72)
            }))
        }]

        await sendWhatsAppList(
            chat.phone_number,
            listBody,
            'Ver Planes',
            sections,
            creds.access_token,
            creds.phone_number_id
        )

        // Guardar en base de datos para historial
        const planListContent = products.map(p =>
            `• ${p.name} — Bs ${p.price}${p.duration_months ? ` (${p.duration_months} mes${p.duration_months !== 1 ? 'es' : ''})` : ''}`
        ).join('\n')

        await supabaseAdmin.from('messages').insert({
            chat_id: chatId,
            is_from_me: true,
            content: `📋 *Planes Enviados:*\n\n${planListContent}\n\n👆 El cliente puede elegir tocando "Ver Planes"`,
            status: 'delivered'
        })

        await supabaseAdmin.from('chats').update({
            last_message: '📋 Lista de planes reenviada',
            last_message_time: new Date().toISOString()
        }).eq('id', chatId)

        return NextResponse.json({
            success: true,
            message: `Lista de ${products.length} planes enviada a ${chat.phone_number}`
        })

    } catch (error) {
        console.error('[Resend Plans] Error:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
