---
name: cron-job-creator
description: Genera un nuevo cron job para JABA siguiendo el patron de subscription-reminders. Usar cuando el usuario necesita una nueva tarea automatica que se ejecute periodicamente en Vercel.
---

# Cron Job Creator — JABA

Genera el codigo completo para un nuevo cron job en JABA siguiendo el patron establecido en `subscription-reminders`, `subscription-urgency` y `subscription-followup`.

## Patron base de cron job JABA

```typescript
// src/app/api/<nombre-cron>/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  // 1. Verificar autorizacion del cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { processed: 0, sent: 0, errors: 0 }

  try {
    // 2. Obtener todos los tenants activos
    const { data: credentials, error: credError } = await supabaseAdmin
      .from('whatsapp_credentials')
      .select('user_id, access_token, phone_number_id')
      .eq('is_active', true)

    if (credError) throw credError

    // 3. Iterar por tenant
    for (const cred of credentials || []) {
      try {
        // 4. Obtener datos del tenant
        const { data: items } = await supabaseAdmin
          .from('<tabla>')
          .select('*')
          .eq('user_id', cred.user_id)
          // ... filtros adicionales

        for (const item of items || []) {
          try {
            // 5. Verificar si ya se proceso (evitar duplicados)
            const { data: log } = await supabaseAdmin
              .from('subscription_notification_logs')
              .select('id')
              .eq('subscription_id', item.id)
              .eq('message_type', '<tipo_mensaje>')
              .single()

            if (log) continue // Ya enviado

            // 6. Enviar mensaje
            await sendWhatsAppMessage(item.numero, mensaje, cred.access_token, cred.phone_number_id)

            // 7. Registrar en log
            await supabaseAdmin
              .from('subscription_notification_logs')
              .insert({
                subscription_id: item.id,
                user_id: cred.user_id,
                message_type: '<tipo_mensaje>',
                status: 'sent',
                phone_number: item.numero
              })

            results.sent++
          } catch (itemError) {
            console.error('[<nombre-cron>] Error item:', item.id, itemError)
            results.errors++
          }

          results.processed++
        }
      } catch (tenantError) {
        console.error('[<nombre-cron>] Error tenant:', cred.user_id, tenantError)
        results.errors++
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('[<nombre-cron>] Error general:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

## Agregar a vercel.json

```json
{
  "crons": [
    {
      "path": "/api/<nombre-cron>",
      "schedule": "0 13 * * *"
    }
  ]
}
```

## Horarios UTC disponibles (referencia JABA)

| Hora UTC | Hora Argentina | Uso actual |
|----------|---------------|------------|
| 13:00 | 10:00 | subscription-reminders, subscription-urgency |
| 22:00 | 19:00 | subscription-followup |
| 14:00 | 11:00 | trigger-engine |

## Proceso

1. Pregunta al usuario: proposito del cron, frecuencia, que tabla procesa, que mensaje o accion ejecuta
2. Genera el archivo `route.ts` completo con el patron multi-tenant
3. Genera el fragmento para agregar en `vercel.json`
4. Advierte si necesita nueva columna de log en `subscription_notification_logs` o tabla nueva
5. Recuerda agregar `CRON_SECRET` al `.env.local` si no existe
