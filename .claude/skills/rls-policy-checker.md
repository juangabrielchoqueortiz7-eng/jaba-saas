---
name: rls-policy-checker
description: Verifica y corrige politicas de Row Level Security en Supabase para la arquitectura multi-tenant de JABA. Usar cuando el usuario agrega una tabla nueva o sospecha que hay filtracion de datos entre tenants.
---

# RLS Policy Checker — JABA

Audita y corrige las politicas de Row Level Security (RLS) de Supabase para garantizar aislamiento multi-tenant en JABA.

## Checklist obligatorio para cada tabla

```sql
-- 1. Verificar que RLS esta habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Ver politicas existentes de una tabla
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = '<table_name>'
  AND schemaname = 'public';

-- 3. Verificar que user_id existe y tiene FK a auth.users
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '<table_name>'
  AND column_name = 'user_id';
```

## Patron correcto de politicas JABA

```sql
-- Politica para usuarios autenticados
CREATE POLICY "usuarios_ven_solo_sus_datos" ON public.<tabla>
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politica para service role (cron jobs, webhooks)
CREATE POLICY "service_role_acceso_total" ON public.<tabla>
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Politica para anon (solo si la tabla necesita acceso publico)
-- OMITIR si no es necesario
CREATE POLICY "acceso_publico_lectura" ON public.<tabla>
  FOR SELECT
  TO anon
  USING (true);
```

## Errores comunes y correcciones

| Error | Sintoma | Correccion |
|-------|---------|------------|
| RLS deshabilitado | Cualquier usuario ve todos los datos | `ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;` |
| Sin politica service_role | Cron jobs y webhook no pueden leer/escribir | Agregar politica `TO service_role USING (true)` |
| USING sin WITH CHECK | Usuarios pueden insertar datos de otros | Agregar `WITH CHECK (auth.uid() = user_id)` |
| user_id nullable | Filas huerfanas sin tenant | `ALTER TABLE public.<tabla> ALTER COLUMN user_id SET NOT NULL;` |
| Sin FK a auth.users | Datos inconsistentes | Agregar FK constraint |

## Auditoria completa de todas las tablas

```sql
-- Tablas SIN RLS habilitado
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT IN ('spatial_ref_sys'); -- excluir sistema

-- Tablas con RLS pero SIN politica para authenticated
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = t.tablename
      AND p.schemaname = 'public'
      AND (p.roles @> ARRAY['authenticated']::name[] OR p.roles = ARRAY[]::name[])
  );
```

## Proceso

1. Pregunta al usuario: tabla especifica o auditoria completa
2. Genera las queries de verificacion
3. Analiza los resultados e identifica problemas
4. Genera el SQL corrector especifico
5. Confirma que el patron multi-tenant queda correcto
