---
name: supabase-migration
description: Genera SQL de migracion para Supabase con RLS multi-tenant correcto para JABA. Usar cuando el usuario necesita crear o modificar tablas, columnas, indices o politicas de seguridad.
---

# Supabase Migration — JABA

Generates SQL migrations siguiendo exactamente los patrones de arquitectura multi-tenant de JABA.

## Patron base obligatorio para TODA tabla nueva

```sql
-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS public.<table_name> (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- ... columnas adicionales
);

-- 2. Habilitar RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- 3. Politica para usuarios autenticados (solo ven sus datos)
CREATE POLICY "<table_name>_user_policy" ON public.<table_name>
  FOR ALL USING (auth.uid() = user_id);

-- 4. Politica para service role (cron jobs, webhooks)
CREATE POLICY "<table_name>_service_role_policy" ON public.<table_name>
  FOR ALL TO service_role USING (true);

-- 5. Indice por user_id para performance
CREATE INDEX IF NOT EXISTS idx_<table_name>_user_id ON public.<table_name>(user_id);
```

## Tipos de columnas comunes en JABA

| Dato | Tipo SQL |
|------|----------|
| Telefono | `text NOT NULL` |
| Estado | `text DEFAULT 'activo'` |
| Fecha vencimiento | `date` o `timestamptz` |
| Precio | `numeric(10,2)` |
| JSON config | `jsonb DEFAULT '{}'` |
| Flag booleano | `boolean DEFAULT false` |
| Referencia a otra tabla | `uuid REFERENCES public.<tabla>(id) ON DELETE CASCADE` |

## Proceso

1. Pregunta al usuario: nombre de la tabla, proposito, columnas necesarias
2. Identifica si necesita referencia a tablas existentes (chats, subscriptions, products, flows, etc.)
3. Genera el SQL completo con:
   - CREATE TABLE con todas las columnas
   - RLS habilitado
   - 2 politicas (user + service_role)
   - Indices relevantes
4. Si es ALTER TABLE (agregar columna), genera solo el ALTER + indice si aplica
5. Advierte si hay columnas sin NOT NULL que podrian causar problemas

## Tablas existentes para referencias

- `auth.users` — Tabla de Supabase Auth
- `public.chats` — Conversaciones (id, user_id, phone_number)
- `public.messages` — Mensajes (id, chat_id, content)
- `public.subscriptions` — Suscripciones (id, user_id, numero, servicio)
- `public.orders` — Ordenes (id, user_id, phone_number, status)
- `public.products` — Productos (id, user_id, name, price)
- `public.flows` / `public.flow_nodes` / `public.flow_edges` — Flow builder
- `public.whatsapp_credentials` — Credenciales WhatsApp por tenant

## Output esperado

SQL listo para ejecutar en el SQL Editor de Supabase o via CLI (`supabase db push`).
