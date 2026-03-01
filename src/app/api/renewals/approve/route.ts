import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST: Aprobar o rechazar renovación manualmente desde el dashboard
export async function POST(request: Request) {
    try {
        // Verificar auth del usuario
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No token' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const anonClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { user }, error: authError } = await anonClient.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const body = await request.json()
        const { renewal_id, action } = body // action: 'approve' | 'reject'

        if (!renewal_id || !action) {
            return NextResponse.json({ error: 'Missing renewal_id or action' }, { status: 400 })
        }

        // Buscar la renovación
        const { data: renewal, error: fetchError } = await supabaseAdmin
            .from('subscription_renewals')
            .select('*')
            .eq('id', renewal_id)
            .eq('user_id', user.id)
            .single()

        if (fetchError || !renewal) {
            return NextResponse.json({ error: 'Renewal not found' }, { status: 404 })
        }

        if (renewal.status !== 'pending_review') {
            return NextResponse.json({ error: 'Renewal already processed', current_status: renewal.status }, { status: 400 })
        }

        // Obtener credenciales de WhatsApp del usuario
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('access_token, phone_number_id')
            .eq('user_id', user.id)
            .single()

        if (action === 'approve') {
            // =============================================
            // APROBAR: Actualizar suscripción + enviar WhatsApp
            // =============================================

            // 1. Actualizar la suscripción con la nueva fecha
            if (renewal.subscription_id) {
                await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        vencimiento: renewal.new_expiration,
                        notified: false,
                        notified_at: null,
                        followup_sent: false,
                        urgency_sent: false
                    })
                    .eq('id', renewal.subscription_id)

                console.log(`[Renewal Approve] ✅ Suscripción ${renewal.subscription_id} actualizada: ${renewal.old_expiration} → ${renewal.new_expiration}`)
            }

            // 2. Marcar renovación como aprobada
            await supabaseAdmin
                .from('subscription_renewals')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', renewal_id)

            // 3. Actualizar la orden
            if (renewal.order_id) {
                await supabaseAdmin
                    .from('orders')
                    .update({
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', renewal.order_id)
            }

            // 4. Enviar mensaje de confirmación al cliente por WhatsApp
            if (creds?.access_token && creds?.phone_number_id && renewal.phone_number) {
                const confirmMsg = `✅ *¡Renovación exitosa!* 🎉\n\nGracias por continuar confiando en nosotros. Tu cuenta *${renewal.customer_email || ''}* de Canva Pro ha sido renovada con éxito.\n\n📋 *Detalle de tu renovación:*\n• Plan: ${renewal.plan_name}\n• Vigencia hasta: *${renewal.new_expiration}*\n\nTodos tus diseños, plantillas y proyectos siguen intactos y disponibles para ti. 🎨\n\nSi tienes alguna consulta, estamos aquí para ayudarte.\n*¡Sigue creando cosas increíbles!* ✨`

                await sendWhatsAppMessage(
                    renewal.phone_number,
                    confirmMsg,
                    creds.access_token,
                    creds.phone_number_id
                )

                // Guardar mensaje en chat
                if (renewal.chat_id) {
                    await supabaseAdmin.from('messages').insert({
                        chat_id: renewal.chat_id,
                        is_from_me: true,
                        content: confirmMsg,
                        status: 'delivered'
                    })

                    await supabaseAdmin.from('chats').update({
                        last_message: '✅ Renovación aprobada',
                        last_message_time: new Date().toISOString()
                    }).eq('id', renewal.chat_id)
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Renewal approved',
                new_expiration: renewal.new_expiration
            })

        } else if (action === 'reject') {
            // =============================================
            // RECHAZAR: Marcar como rechazada + notificar
            // =============================================

            await supabaseAdmin
                .from('subscription_renewals')
                .update({
                    status: 'rejected',
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', renewal_id)

            // Actualizar la orden
            if (renewal.order_id) {
                await supabaseAdmin
                    .from('orders')
                    .update({
                        status: 'cancelled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', renewal.order_id)
            }

            // Enviar mensaje al cliente
            if (creds?.access_token && creds?.phone_number_id && renewal.phone_number) {
                const rejectMsg = `⚠️ *Pago no verificado*\n\nHola, revisamos tu comprobante para el plan *${renewal.plan_name}* pero no pudimos verificar el pago.\n\nPor favor, revisa que:\n• El monto sea correcto (Bs ${renewal.amount})\n• La captura sea legible y corresponda al pago actual\n\nSi ya realizaste el pago, vuelve a enviar tu comprobante. ¡Estamos aquí para ayudarte! 💬`

                await sendWhatsAppMessage(
                    renewal.phone_number,
                    rejectMsg,
                    creds.access_token,
                    creds.phone_number_id
                )

                if (renewal.chat_id) {
                    await supabaseAdmin.from('messages').insert({
                        chat_id: renewal.chat_id,
                        is_from_me: true,
                        content: rejectMsg,
                        status: 'delivered'
                    })

                    await supabaseAdmin.from('chats').update({
                        last_message: '⚠️ Pago no verificado',
                        last_message_time: new Date().toISOString()
                    }).eq('id', renewal.chat_id)
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Renewal rejected'
            })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error) {
        console.error('[Renewal API] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
