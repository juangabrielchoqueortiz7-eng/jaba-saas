// Nota: Este endpoint es especifico para negocios de suscripcion.
// Para automatizaciones generales usar /api/run-automations.

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { asRecord } from '@/lib/automation-jobs'
import { getUsersToExecuteNow } from '@/lib/db/scheduling'
import {
  buildPlanListContent,
  buildPlanListSections,
  delay,
  extractWhatsAppMessageId,
  findOrCreateChat,
  getPromoImageUrl,
  getServiceName,
  getSubscriptionDateDiff,
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
    console.log('[Cron Reminders] Unauthorized access attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron Reminders] Starting automated reminder job at', new Date().toISOString())

  try {
    const usersToExecute = await getUsersToExecuteNow('reminder')

    if (usersToExecute.length === 0) {
      console.log('[Cron Reminders] No users with reminder_hour matching current time in their timezone')
      return NextResponse.json({ sent: 0, failed: 0, skipped: 0, userCount: 0 })
    }

    console.log(`[Cron Reminders] Found ${usersToExecute.length} users to execute reminders for`)

    const specificUserIds = usersToExecute.map(user => user.user_id)
    const result = await processReminders(specificUserIds)
    console.log(`[Cron Reminders] Done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`)

    return NextResponse.json({ ...result, usersProcessed: usersToExecute.length })
  } catch (error) {
    console.error('[Cron Reminders] Fatal error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No token' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  let force = false
  let singlePhone: string | null = null

  try {
    const body = asRecord(await request.json())
    force = body?.force === true
    singlePhone = typeof body?.phoneNumber === 'string' ? body.phoneNumber : null
  } catch {
    // No body = normal mode
  }

  if (singlePhone) {
    console.log(`[Manual Reminders] Re-notificacion individual a ${singlePhone} por usuario ${user.id}`)

    try {
      const result = await sendSingleReminder(singlePhone, user.id)
      return NextResponse.json(result)
    } catch (error) {
      console.error('[Manual Reminders] Error sending single reminder:', error)
      return NextResponse.json({ error: 'Error sending reminder' }, { status: 500 })
    }
  }

  console.log(`[Manual Reminders] Triggered by user ${user.id}${force ? ' (FORCE/BROADCAST)' : ''}`)

  try {
    const result = await processReminders([user.id], force)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Manual Reminders] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function sendSingleReminder(phoneNumber: string, userId: string) {
  const { data: credentialsRow } = await supabaseAdmin
    .from('whatsapp_credentials')
    .select('access_token, phone_number_id, bot_name, service_name, promo_image_url, timezone, currency_symbol, country_code')
    .eq('user_id', userId)
    .single()

  const credentials = toCredentials(credentialsRow)
  if (!credentials) {
    return { error: 'No WhatsApp credentials found', sent: 0 }
  }

  const fullPhone = normalizePhone(phoneNumber, credentials.country_code)
  const withoutPrefix = fullPhone.startsWith(credentials.country_code)
    ? fullPhone.slice(credentials.country_code.length)
    : fullPhone

  const { data: subscriptionRow } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .or(`numero.eq.${fullPhone},numero.eq.${withoutPrefix}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const subscription = toSubscriptionList(subscriptionRow)[0]

  const { data: productRows } = await supabaseAdmin
    .from('products')
    .select('id, name, description, price')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const products = toProductList(productRows)
  const imageUrl = getPromoImageUrl(credentials)

  const sendResult = await sendWhatsAppTemplate(
    fullPhone,
    'recordatorio_renovacion_v1',
    'es',
    [
      {
        type: 'header',
        parameters: [{ type: 'image', image: { link: imageUrl } }],
      },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: subscription?.correo || 'tu cuenta' },
          { type: 'text', text: subscription?.vencimiento || 'pronto' },
        ],
      },
    ],
    credentials.access_token,
    credentials.phone_number_id,
  )

  if (!sendResult) {
    return {
      error: 'Template send failed',
      sent: 0,
      hint: 'Verifica que el template "recordatorio_renovacion_v1" este aprobado en Meta.',
    }
  }

  const chatId = await findOrCreateChat(
    supabaseAdmin,
    fullPhone,
    userId,
    subscription?.correo || fullPhone,
    credentials.country_code,
  )

  if (chatId) {
    const serviceName = getServiceName(credentials)
    const actualTemplateText = `⚠️ *Accion requerida: Tu acceso a ${serviceName} necesita atencion*\n\n¡Hola! Notamos que tu suscripcion de la cuenta ${subscription?.correo || 'tu cuenta'} vencera / vencio el ${subscription?.vencimiento || 'fecha no registrada'}.\n\nComo valoramos tu preferencia, queremos recordarte renovar a tiempo para evitar cortes definitivos y seguir disfrutando de todos los beneficios de ${serviceName}. ✨\n\nPara renovar, puedes ver los precios en la imagen adjunta o elegir tu plan en la lista que te enviaremos a continuacion 👇`

    await supabaseAdmin.from('messages').insert({
      chat_id: chatId,
      is_from_me: true,
      content: actualTemplateText,
      status: 'delivered',
      whatsapp_message_id: extractWhatsAppMessageId(sendResult),
    })

    await supabaseAdmin.from('chats').update({
      last_message: '🔔 Recordatorio de renovacion enviado',
      last_message_time: new Date().toISOString(),
    }).eq('id', chatId)
  }

  let listSent = false
  const listSections = buildPlanListSections(products, credentials.currency_symbol)
  if (listSections.length > 0 && listSections[0].rows.length > 0) {
    await delay(1000)

    try {
      const listResult = await sendWhatsAppList(
        fullPhone,
        '👇 Selecciona el plan que deseas para renovar tu suscripcion:',
        'Ver Planes',
        listSections,
        credentials.access_token,
        credentials.phone_number_id,
      )
      listSent = Boolean(listResult)

      if (listSent && chatId) {
        await supabaseAdmin.from('messages').insert({
          chat_id: chatId,
          is_from_me: true,
          content: `📋 *Planes Enviados:*\n\n${buildPlanListContent(products, credentials.currency_symbol)}\n\n👆 El cliente lo recibio como botones interactivos`,
          status: 'delivered',
        })
      }
    } catch (error) {
      console.log(`[Manual Reminders] Lista interactiva no pudo enviarse (fuera de ventana 24h): ${error}`)
    }

    if (!listSent && chatId) {
      await supabaseAdmin.from('messages').insert({
        chat_id: chatId,
        is_from_me: true,
        content: '⚠️ *Nota del sistema:* La lista de planes interactiva no se pudo enviar porque el cliente esta fuera de la ventana de 24h de WhatsApp.\n\nCuando el cliente responda, usa el boton 📋 Planes para enviarle la lista.',
        status: 'delivered',
      })
    }
  }

  console.log(`[Manual Reminders] ✅ Recordatorio individual enviado a ${redactPhone(fullPhone)} | Lista: ${listSent ? 'OK' : 'BLOQUEADA (>24h)'}`)

  return {
    sent: 1,
    failed: 0,
    phone: fullPhone,
    listSent,
    note: listSent
      ? 'Template + lista enviados'
      : 'Solo template enviado (cliente fuera de ventana 24h). Usa el boton Planes cuando responda.',
  }
}

async function processReminders(
  specificUserIds?: string[],
  force: boolean = false,
): Promise<NotificationResults & { error?: string }> {
  const today = new Date()
  const results: NotificationResults = { sent: 0, failed: 0, skipped: 0, total: 0 }

  let query = supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('estado', 'ACTIVO')

  if (!force) {
    query = query.eq('notified', false)
  }

  if (specificUserIds && specificUserIds.length > 0) {
    query = query.in('user_id', specificUserIds)
  } else if (specificUserIds && specificUserIds.length === 0) {
    return results
  }

  const { data: subscriptionRows, error: subError } = await query

  if (subError) {
    console.error('[Reminders] Error fetching subscriptions:', subError)
    return { ...results, error: subError.message }
  }

  const subscriptions = toSubscriptionList(subscriptionRows)
  if (subscriptions.length === 0) {
    console.log('[Reminders] No subscriptions to process')
    return results
  }

  const candidates = subscriptions.filter(subscription => {
    if (subscription.auto_notify_paused || !hasValidSubscriptionPhone(subscription)) {
      return false
    }

    if (force) {
      return true
    }

    const diffDays = getSubscriptionDateDiff(subscription, today)
    return diffDays !== null && diffDays <= 0
  })

  results.total = candidates.length
  results.skipped = subscriptions.length - candidates.length

  if (candidates.length === 0) {
    console.log('[Reminders] No candidates after filtering')
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
      console.log(`[Reminders] No WhatsApp credentials for user ${userId}, skipping ${userSubscriptions.length} subs`)
      results.skipped += userSubscriptions.length
      results.total -= userSubscriptions.length
      continue
    }

    const { data: settingsRow } = await supabaseAdmin
      .from('subscription_settings')
      .select('reminder_msg, expired_grace_msg, enable_auto_notifications, template_config')
      .eq('user_id', userId)
      .single()

    const settings = toSettings(settingsRow)
    if (!settings.enable_auto_notifications) {
      console.log(`[Reminders] Auto notifications disabled for user ${userId}, skipping`)
      results.skipped += userSubscriptions.length
      results.total -= userSubscriptions.length
      continue
    }

    const { data: productRows } = await supabaseAdmin
      .from('products')
      .select('id, name, description, price')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const products = toProductList(productRows)
    const currencySymbol = credentials.currency_symbol
    const listSections = buildPlanListSections(products, currencySymbol)
    const plansText = buildPlanListContent(products, currencySymbol)
    const serviceName = getServiceName(credentials)
    const imageUrl = getPromoImageUrl(credentials)

    const defaultReminder = `⚠️ *Accion requerida: Tu acceso a ${serviceName} necesita atencion*\n\n¡Hola! Notamos que tu suscripcion vencio el {vencimiento} de tu cuenta {correo}\n\nPorque valoramos tu preferencia, hemos mantenido activo un acceso temporal para que no pierdas tu ritmo. ⏳ Sin embargo, este periodo de gracia es limitado.\n\n📋 *Planes disponibles para renovar:*\n{planes}\n\nPor favor, renueva lo antes posible para evitar cortes definitivos y seguir disfrutando de todos los beneficios de ${serviceName}. *¡Te esperamos!* ✨\n\nRef: {equipo}`
    const defaultExpiredGrace = `⚠️ *Accion requerida: Tu acceso a ${serviceName} necesita atencion*\n\n¡Hola! Notamos que tu suscripcion vencio el {vencimiento} de tu cuenta {correo}\n\nPorque valoramos tu preferencia, hemos mantenido activo un acceso temporal para que no pierdas tu ritmo. ⏳ Sin embargo, este periodo de gracia es limitado.\n\n📋 *Planes disponibles para renovar:*\n{planes}\n\nPor favor, renueva lo antes posible para evitar cortes definitivos y seguir disfrutando de todos los beneficios de ${serviceName}. *¡Te esperamos!* ✨\n\nRef: {equipo}`

    for (const subscription of userSubscriptions) {
      try {
        const fullPhone = normalizePhone(subscription.numero, credentials.country_code)
        const diffDays = getSubscriptionDateDiff(subscription, today) ?? 0
        const messageTemplate = diffDays < 0
          ? settings.expired_grace_msg || defaultExpiredGrace
          : settings.reminder_msg || defaultReminder

        const message = messageTemplate
          .replace(/{correo}/g, subscription.correo || '')
          .replace(/{vencimiento}/g, subscription.vencimiento || '')
          .replace(/{equipo}/g, subscription.equipo || '')
          .replace(/{planes}/g, plansText)

        const templateName = resolveTemplateName(
          settings,
          subscription.servicio || serviceName || 'Servicio',
          'reminder',
          'recordatorio_renovacion_v1',
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
                { type: 'text', text: subscription.vencimiento || 'pronto' },
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
              content: message,
              status: 'delivered',
              whatsapp_message_id: extractWhatsAppMessageId(sendResult),
            })

            await supabaseAdmin.from('chats').update({
              last_message: '📤 Recordatorio de renovacion enviado',
              last_message_time: new Date().toISOString(),
            }).eq('id', chatId)
          }

          if (listSections.length > 0 && listSections[0].rows.length > 0) {
            await delay(1000)

            await sendWhatsAppList(
              fullPhone,
              '👇 Selecciona el plan que deseas para renovar tu suscripcion:',
              'Ver Planes',
              listSections,
              credentials.access_token,
              credentials.phone_number_id,
            )

            if (chatId && products.length > 0) {
              await supabaseAdmin.from('messages').insert({
                chat_id: chatId,
                is_from_me: true,
                content: `📋 *Planes Enviados:*\n\n${plansText}\n\n👆 El cliente lo recibio como botones interactivos`,
                status: 'delivered',
              })
            }
          }

          await supabaseAdmin
            .from('subscriptions')
            .update({
              notified: true,
              notified_at: new Date().toISOString(),
              followup_sent: false,
              urgency_sent: false,
            })
            .eq('id', subscription.id)

          await supabaseAdmin.from('subscription_notification_logs').insert({
            user_id: userId,
            subscription_id: subscription.id,
            phone_number: fullPhone,
            message_type: 'reminder',
            status: 'sent',
          })

          results.sent++
          console.log(`[Reminders] ✅ Sent to ${redactPhone(fullPhone)} (${redactEmail(subscription.correo)})`)

          const reminderChatId = chatId ?? await findOrCreateChat(
            supabaseAdmin,
            fullPhone,
            userId,
            subscription.correo,
            credentials.country_code,
          )

          if (reminderChatId) {
            const { data: chatRow } = await supabaseAdmin
              .from('chats')
              .select('id, tags')
              .eq('id', reminderChatId)
              .single()

            const chat = asRecord(chatRow)
            const rawTags = Array.isArray(chat?.tags) ? chat.tags.filter((tag): tag is string => typeof tag === 'string') : []
            const nextTags = [...new Set([...rawTags.filter(tag => tag !== 'pago'), 'renovacion_pendiente'])]

            await supabaseAdmin.from('chats').update({ tags: nextTags }).eq('id', reminderChatId)
          }
        } else {
          await supabaseAdmin.from('subscription_notification_logs').insert({
            user_id: userId,
            subscription_id: subscription.id,
            phone_number: fullPhone,
            message_type: 'reminder',
            status: 'failed',
            error_message: 'sendWhatsAppTemplate returned null',
          })

          results.failed++
          console.log(`[Reminders] ❌ Failed for ${redactPhone(fullPhone)}`)
        }

        await delay(2000)
      } catch (error) {
        console.error(`[Reminders] Error processing sub ${subscription.id}:`, error)
        results.failed++

        await supabaseAdmin.from('subscription_notification_logs').insert({
          user_id: userId,
          subscription_id: subscription.id,
          phone_number: subscription.numero,
          message_type: 'reminder',
          status: 'failed',
          error_message: String(error),
        })
      }
    }
  }

  return results
}
