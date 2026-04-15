// Nota: Este endpoint es especifico para negocios de suscripcion.
// Para automatizaciones generales usar /api/run-automations.

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUsersToExecuteNow } from '@/lib/db/scheduling'
import {
  buildPlanListSections,
  delay,
  extractWhatsAppMessageId,
  findOrCreateChat,
  getPromoImageUrl,
  getServiceName,
  getSubscriptionDateDiff,
  getTenantGreeting,
  groupSubscriptionsByUser,
  hasValidSubscriptionPhone,
  normalizePhone,
  redactEmail,
  redactPhone,
  resolveTemplateName,
  timingSafeCompare,
  toCredentials,
  toProductList,
  toSettings,
  toSubscriptionList,
  type NotificationResults,
} from '@/lib/subscription-notifications'
import { sendWhatsAppList, sendWhatsAppTemplate } from '@/lib/whatsapp'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey,
)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !timingSafeCompare(authHeader ?? '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron Urgency] Starting urgency reminder job at', new Date().toISOString())

  try {
    const usersToExecute = await getUsersToExecuteNow('urgency')

    if (usersToExecute.length === 0) {
      console.log('[Cron Urgency] No users with urgency_hour matching current time in their timezone')
      return NextResponse.json({ sent: 0, failed: 0, skipped: 0, userCount: 0 })
    }

    console.log(`[Cron Urgency] Found ${usersToExecute.length} users to execute urgency for`)

    const specificUserIds = usersToExecute.map(user => user.user_id)
    const result = await processUrgency(specificUserIds)
    console.log(`[Cron Urgency] Done: ${result.sent} sent, ${result.failed} failed`)

    return NextResponse.json({ ...result, usersProcessed: usersToExecute.length })
  } catch (error) {
    console.error('[Cron Urgency] Fatal error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function processUrgency(
  specificUserIds?: string[],
): Promise<NotificationResults & { error?: string }> {
  const results: NotificationResults = { sent: 0, failed: 0, skipped: 0, total: 0 }

  let query = supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('estado', 'ACTIVO')
    .eq('notified', true)
    .eq('followup_sent', true)
    .eq('urgency_sent', false)

  if (specificUserIds && specificUserIds.length > 0) {
    query = query.in('user_id', specificUserIds)
  } else if (specificUserIds && specificUserIds.length === 0) {
    return results
  }

  const { data: subscriptionRows, error } = await query

  if (error) {
    console.error('[Urgency] Error fetching:', error)
    return { ...results, error: error.message }
  }

  const subscriptions = toSubscriptionList(subscriptionRows)
  if (subscriptions.length === 0) {
    console.log('[Urgency] No subscriptions need urgency message')
    return results
  }

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const today = new Date()

  const candidates = subscriptions.filter(subscription => {
    if (subscription.auto_notify_paused || !hasValidSubscriptionPhone(subscription)) {
      return false
    }

    const diffDays = getSubscriptionDateDiff(subscription, today)
    if (diffDays !== null && diffDays > 7) {
      console.log(`[Urgency] ⏭️ Skip ${redactEmail(subscription.correo)}: vence ${subscription.vencimiento} (${diffDays} dias)`)
      return false
    }

    if (!subscription.notified_at) {
      return false
    }

    return new Date(subscription.notified_at) <= twoDaysAgo
  })

  results.total = candidates.length
  results.skipped = subscriptions.length - candidates.length

  if (candidates.length === 0) {
    console.log('[Urgency] No candidates after 48h filter')
    return results
  }

  const userGroups = groupSubscriptionsByUser(candidates)

  for (const [userId, userSubscriptions] of Object.entries(userGroups)) {
    const { data: credentialsRow } = await supabaseAdmin
      .from('whatsapp_credentials')
      .select('access_token, phone_number_id, bot_name, service_name, promo_image_url, timezone, currency_symbol, country_code')
      .eq('user_id', userId)
      .single()

    const credentials = toCredentials(credentialsRow)
    if (!credentials) {
      results.skipped += userSubscriptions.length
      continue
    }

    const { data: settingsRow } = await supabaseAdmin
      .from('subscription_settings')
      .select('enable_auto_notifications, template_config')
      .eq('user_id', userId)
      .single()

    const settings = toSettings(settingsRow)
    if (!settings.enable_auto_notifications) {
      console.log(`[Urgency] Auto notifications disabled for user ${userId}, skipping`)
      results.skipped += userSubscriptions.length
      continue
    }

    const { data: productRows } = await supabaseAdmin
      .from('products')
      .select('id, name, description, price')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const products = toProductList(productRows)
    const listSections = buildPlanListSections(products, credentials.currency_symbol)
    const serviceName = getServiceName(credentials)
    const imageUrl = getPromoImageUrl(credentials)
    const greeting = getTenantGreeting(credentials.timezone)

    for (const subscription of userSubscriptions) {
      try {
        const fullPhone = normalizePhone(subscription.numero, credentials.country_code)
        const urgencyMessage = `⏰ *${greeting}*\n\nTe escribimos por ultima vez porque tu acceso a ${serviceName} de la cuenta *${subscription.correo}* esta a punto de ser suspendido.\n\nEntendemos que a veces se nos pasan las cosas, por eso queremos darte esta ultima oportunidad de mantener tu cuenta activa con todo tu contenido intacto. 📂\n\n👉 Renueva en los proximos minutos seleccionando tu plan y tu acceso seguira activo sin interrupciones.\n\nDe lo contrario, tu cuenta sera suspendida y tu contenido quedara inaccesible temporalmente.\n\n¡Estamos aqui para ayudarte! 💬\n\nRef: ${subscription.equipo || ''}`

        const templateName = resolveTemplateName(
          settings,
          subscription.servicio || serviceName || 'Servicio',
          'urgency',
          'ultimo_aviso_renovacion_v1',
        )

        const sendResult = await sendWhatsAppTemplate(
          fullPhone,
          templateName,
          'es',
          [
            {
              type: 'header',
              parameters: [{ type: 'image', image: { link: imageUrl } }],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: subscription.correo || 'tu cuenta' },
                { type: 'text', text: subscription.equipo || 'S/N' },
              ],
            },
          ],
          credentials.access_token,
          credentials.phone_number_id,
        )

        if (sendResult) {
          const chatId = await findOrCreateChat(
            supabaseAdmin,
            fullPhone,
            userId,
            subscription.correo || fullPhone,
            credentials.country_code,
          )

          if (chatId) {
            await supabaseAdmin.from('messages').insert({
              chat_id: chatId,
              is_from_me: true,
              content: urgencyMessage,
              status: 'delivered',
              whatsapp_message_id: extractWhatsAppMessageId(sendResult),
            })

            await supabaseAdmin.from('chats').update({
              last_message: '⏰ Ultimo aviso de renovacion enviado',
              last_message_time: new Date().toISOString(),
            }).eq('id', chatId)
          }

          if (listSections.length > 0 && listSections[0].rows.length > 0) {
            await delay(1000)

            await sendWhatsAppList(
              fullPhone,
              '👇 Selecciona tu plan para renovar ahora mismo y evitar la suspension:',
              'Renovar Ahora',
              listSections,
              credentials.access_token,
              credentials.phone_number_id,
            )

            if (chatId) {
              await supabaseAdmin.from('messages').insert({
                chat_id: chatId,
                is_from_me: true,
                content: '📋 Lista de Planes (Ultimo Aviso) Enviada',
                status: 'delivered',
              })
            }
          }

          await supabaseAdmin
            .from('subscriptions')
            .update({ urgency_sent: true })
            .eq('id', subscription.id)

          await supabaseAdmin.from('subscription_notification_logs').insert({
            user_id: userId,
            subscription_id: subscription.id,
            phone_number: fullPhone,
            message_type: 'urgency',
            status: 'sent',
          })

          results.sent++
          console.log(`[Urgency] ✅ Sent to ${redactPhone(fullPhone)} (${redactEmail(subscription.correo)})`)
        } else {
          await supabaseAdmin.from('subscription_notification_logs').insert({
            user_id: userId,
            subscription_id: subscription.id,
            phone_number: fullPhone,
            message_type: 'urgency',
            status: 'failed',
            error_message: 'sendWhatsAppTemplate returned null',
          })
          results.failed++
          console.log(`[Urgency] ❌ Failed for ${redactPhone(fullPhone)}`)
        }

        await delay(2000)
      } catch (error) {
        console.error(`[Urgency] Error for sub ${subscription.id}:`, error)
        results.failed++
      }
    }
  }

  return results
}
