---
name: multi-tenant-component
description: Genera componentes y paginas del dashboard de JABA con el patron correcto de Server Components, autenticacion y fetch multi-tenant. Usar cuando el usuario necesita crear una nueva pagina o seccion del dashboard.
---

# Multi-Tenant Component — JABA

Genera paginas y componentes del dashboard de JABA siguiendo los patrones establecidos de Server Components, autenticacion y multi-tenancy.

## Patron de pagina Server Component (dashboard)

```typescript
// src/app/dashboard/<seccion>/page.tsx
import { createServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function <Nombre>Page() {
  // 1. Autenticar usuario
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Fetchear datos del tenant
  const { data: items, error } = await supabaseAdmin
    .from('<tabla>')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[dashboard/<seccion>]', error)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white"><Titulo></h1>
        <p className="text-gray-400 mt-1"><Descripcion></p>
      </div>

      {/* Contenido */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        {/* ... */}
      </div>
    </div>
  )
}
```

## Patron de componente Client (interactivo)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export function <Nombre>Client({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchItems()

    // Realtime opcional
    const channel = supabase
      .channel('<tabla>_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: '<tabla>',
        filter: `user_id=eq.${userId}`
      }, () => fetchItems())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('<tabla>')
      .select('*')
      .eq('user_id', userId)
    setItems(data || [])
    setLoading(false)
  }

  if (loading) return <div className="text-gray-400">Cargando...</div>

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{/* render */}</div>
      ))}
    </div>
  )
}
```

## Patron de Server Action (formularios)

```typescript
// actions.ts en la misma carpeta
'use server'

import { createServerClient } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function create<Nombre>Action(formData: FormData) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const data = {
    user_id: user.id,
    campo: formData.get('campo') as string,
    // ...
  }

  const { error } = await supabaseAdmin.from('<tabla>').insert(data)
  if (error) throw error

  revalidatePath('/dashboard/<seccion>')
}
```

## Convenciones de estilo JABA

- Fondo: `bg-gray-800` o `bg-gray-900`
- Bordes: `border border-gray-700`
- Texto principal: `text-white`
- Texto secundario: `text-gray-400`
- Botones primarios: `bg-blue-600 hover:bg-blue-700`
- Botones peligrosos: `bg-red-600 hover:bg-red-700`
- Bordes redondeados: `rounded-xl`

## Proceso

1. Pregunta al usuario: nombre de la seccion, datos que muestra, si necesita interactividad (Client) o solo lectura (Server)
2. Elige el patron correcto (Server/Client/Action)
3. Genera el archivo completo con autenticacion, fetch y UI base
4. Agrega el link en `SidebarNav.tsx` si es una pagina nueva
5. Sigue las convenciones de estilo del dashboard existente
