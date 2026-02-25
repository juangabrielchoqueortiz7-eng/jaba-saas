import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendWhatsAppList } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST: Enviar mensaje de prueba a un número específico
export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { phone } = body

    if (!phone) {
        return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    const fullPhone = (cleanPhone.length === 8 && (cleanPhone.startsWith('6') || cleanPhone.startsWith('7')))
        ? '591' + cleanPhone : cleanPhone

    // Get credentials
    const { data: creds } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id')
        .eq('user_id', user.id)
        .single()

    if (!creds?.access_token) {
        return NextResponse.json({ error: 'No WhatsApp credentials' }, { status: 400 })
    }

    // Get products
    const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, name, description, price')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

    const plansText = (products || []).map(p => `• ${p.name} - ${p.price} Bs`).join('\n')

    const testMessage = `✅ *MENSAJE DE PRUEBA - Jaba Bot*

Este es un mensaje de prueba del sistema de recordatorios automáticos.

📋 *Planes disponibles:*
${plansText}

A continuación te llegará una lista interactiva con los planes disponibles para que puedas seleccionar uno directamente. 👇`

    // Send message
    const sendResult = await sendWhatsAppMessage(fullPhone, testMessage, creds.access_token, creds.phone_number_id)

    if (!sendResult) {
        return NextResponse.json({ error: 'Failed to send message', details: 'sendWhatsAppMessage returned null' }, { status: 500 })
    }

    const waMessageId = sendResult?.messages?.[0]?.id || null

    // Find/create chat
    const cleanNum = fullPhone.replace(/\D/g, '')
    const withPrefix = cleanNum.startsWith('591') ? cleanNum : '591' + cleanNum
    const withoutPrefix = cleanNum.startsWith('591') ? cleanNum.slice(3) : cleanNum

    const { data: existingChat } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('user_id', user.id)
        .or(`phone_number.eq.${withPrefix},phone_number.eq.${withoutPrefix},phone_number.eq.+${withPrefix}`)
        .limit(1)
        .maybeSingle()

    let chatId = existingChat?.id
    if (!chatId) {
        const { data: newChat } = await supabaseAdmin
            .from('chats')
            .insert({
                phone_number: withPrefix,
                user_id: user.id,
                contact_name: `Test ${fullPhone}`,
                last_message: 'Mensaje de prueba',
                unread_count: 0
            })
            .select('id')
            .single()
        chatId = newChat?.id
    }

    // Save message to chat
    if (chatId) {
        await supabaseAdmin.from('messages').insert({
            chat_id: chatId,
            is_from_me: true,
            content: testMessage,
            status: 'delivered',
            whatsapp_message_id: waMessageId
        })

        await supabaseAdmin.from('chats').update({
            last_message: '🧪 Mensaje de prueba enviado',
            last_message_time: new Date().toISOString()
        }).eq('id', chatId)
    }

    // Send interactive list
    if (products && products.length > 0) {
        const listSections = [{
            title: 'Planes Disponibles',
            rows: products.map(p => ({
                id: `renew_plan_${p.id}`,
                title: p.name.substring(0, 24),
                description: `Bs ${p.price}`
            }))
        }]

        await new Promise(r => setTimeout(r, 1000))
        await sendWhatsAppList(
            fullPhone,
            '👇 Selecciona el plan que deseas:',
            'Ver Planes',
            listSections,
            creds.access_token,
            creds.phone_number_id
        )

        if (chatId) {
            await supabaseAdmin.from('messages').insert({
                chat_id: chatId,
                is_from_me: true,
                content: '📋 Lista de Planes Enviada (Prueba)',
                status: 'delivered'
            })
        }
    }

    return NextResponse.json({
        success: true,
        phone: fullPhone,
        whatsapp_message_id: waMessageId,
        chat_id: chatId
    })
}
