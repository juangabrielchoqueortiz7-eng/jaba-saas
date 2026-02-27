-- Agregar columna media_type a la tabla messages (si no existe)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT NULL;

-- Agregar columna last_message_status a la tabla chats (para mostrar checkmarks en sidebar)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS last_message_status TEXT DEFAULT 'sent';

-- Agregar columna reviewed_at a subscription_renewals (para tracking de aprobación manual)
ALTER TABLE subscription_renewals ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ DEFAULT NULL;

-- Habilitar RLS y crear policies para renovaciones
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

-- Policy de actualización
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
