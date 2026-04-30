import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabase as supabaseAdmin } from '@/lib/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { triggerId, testPhone } = await req.json()
    if (!triggerId || !testPhone) {
      return NextResponse.json({ error: 'triggerId y testPhone son requeridos' }, { status: 400 })
    }

    // Verify trigger belongs to user
    const { data: trigger } = await supabaseAdmin
      .from('triggers')
      .select('id, name, trigger_actions(*)')
      .eq('id', triggerId)
      .eq('user_id', user.id)
      .single()

    if (!trigger) return NextResponse.json({ error: 'Disparador no encontrado' }, { status: 404 })

    // Get WhatsApp credentials for this tenant
    const { data: creds } = await supabaseAdmin
      .from('whatsapp_credentials')
      .select('access_token, phone_number_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!creds?.access_token || !creds?.phone_number_id) {
      return NextResponse.json({ error: 'No tienes WhatsApp configurado' }, { status: 400 })
    }

    // Find first message action
    const actions = (trigger.trigger_actions || []).sort(
      (a: { action_order?: number }, b: { action_order?: number }) => (a.action_order ?? 0) - (b.action_order ?? 0)
    )
    const firstMessage = actions.find(
      (a: { type: string }) => ['send_text', 'send_template', 'send_interactive'].includes(a.type)
    )

    if (!firstMessage) {
      return NextResponse.json({ error: 'Este disparador no tiene ninguna acción de mensaje' }, { status: 400 })
    }

    let sent = false
    const payload = (firstMessage as { payload?: Record<string, unknown> }).payload || {}

    if (firstMessage.type === 'send_text') {
      const msg = `[PRUEBA] ${payload.message || '(mensaje vacío)'}`
      await sendWhatsAppMessage(testPhone, msg, creds.access_token, creds.phone_number_id)
      sent = true
    } else if (firstMessage.type === 'send_interactive') {
      const msg = `[PRUEBA] ${payload.body || payload.header || '(mensaje de prueba)'}`
      await sendWhatsAppMessage(testPhone, msg, creds.access_token, creds.phone_number_id)
      sent = true
    } else if (firstMessage.type === 'send_template') {
      // For templates just send a text preview since we can't send template to arbitrary number easily
      const templateName = payload.template_name || payload.templateName || 'sin nombre'
      const msg = `[PRUEBA] Este disparador usaría la plantilla: "${templateName}"`
      await sendWhatsAppMessage(testPhone, msg, creds.access_token, creds.phone_number_id)
      sent = true
    }

    if (!sent) {
      return NextResponse.json({ error: 'No se pudo enviar el mensaje de prueba' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: `Mensaje de prueba enviado a ${testPhone}` })
  } catch (err) {
    console.error('[trigger-test]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
