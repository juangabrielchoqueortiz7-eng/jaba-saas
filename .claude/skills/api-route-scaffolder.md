---
name: api-route-scaffolder
description: Genera una nueva ruta API de Next.js siguiendo los patrones de JABA. Usar cuando el usuario necesita crear un nuevo endpoint en src/app/api/.
---

# API Route Scaffolder — JABA

Genera rutas API (`route.ts`) siguiendo exactamente los patrones de arquitectura de JABA.

## Patron base de una ruta JABA

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validacion de entrada
    const { campo1, campo2 } = body
    if (!campo1 || !campo2) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Logica de negocio
    const { data, error } = await supabaseAdmin
      .from('tabla')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[api/nombre-ruta]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

## Patrones especiales por tipo de ruta

### Cron job (requiere autenticacion por header)
```typescript
// Verificar CRON_SECRET
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Iterar todos los tenants
const { data: credentials } = await supabaseAdmin
  .from('whatsapp_credentials')
  .select('user_id, access_token, phone_number_id')
  .eq('is_active', true)
```

### Ruta que envia WhatsApp
```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp'

await sendWhatsAppMessage(phoneNumber, mensaje, accessToken, phoneNumberId)
```

### Ruta con autenticacion de usuario (SSR)
```typescript
import { createServerClient } from '@/utils/supabase/server'

const supabase = createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
```

## Proceso

1. Pregunta al usuario: nombre de la ruta, metodo HTTP (GET/POST), proposito, datos de entrada/salida
2. Identifica el patron correcto (cron, WhatsApp, autenticado, publico)
3. Genera el archivo completo en `src/app/api/<nombre>/route.ts`
4. Incluye validacion de entrada, manejo de errores con try/catch, y logs con prefijo `[api/<nombre>]`
5. Si usa WhatsApp, importa desde `@/lib/whatsapp`
6. Si es cron, agrega la verificacion de `CRON_SECRET`

## Convencion de nombres

- Rutas en kebab-case: `send-reminder`, `export-contacts`, `run-trigger`
- Logs con prefijo entre corchetes: `console.error('[api/send-reminder]', error)`
- Variables de entorno con `!` (non-null assertion): `process.env.VARIABLE!`
