-- Agregar columna media_type a la tabla messages (si no existe)
-- Ejecutar en Supabase SQL Editor
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT NULL;

-- Agregar RLS policy para subscription_renewals (lectura por usuario autenticado)
-- Primero verificar si RLS está habilitado
ALTER TABLE subscription_renewals ENABLE ROW LEVEL SECURITY;

-- Policy de lectura
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'subscription_renewals' AND policyname = 'Users can read own renewals'
    ) THEN
        CREATE POLICY "Users can read own renewals" ON subscription_renewals
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Policy de actualización (para aprobar/rechazar)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'subscription_renewals' AND policyname = 'Users can update own renewals'
    ) THEN
        CREATE POLICY "Users can update own renewals" ON subscription_renewals
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END
$$;
