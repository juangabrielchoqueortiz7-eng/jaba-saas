-- Migración: Agregar columnas para automatización de notificaciones
-- Ejecutar en Supabase SQL Editor

-- 1. Columna para timestamp de cuando se envió el recordatorio
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='notified_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN notified_at timestamptz;
  END IF;
END $$;

-- 2. Columna para marcar si se envió el followup/remarketing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='followup_sent') THEN
    ALTER TABLE public.subscriptions ADD COLUMN followup_sent boolean DEFAULT false;
  END IF;
END $$;

-- 3. Columna para pausar automatización por cliente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='auto_notify_paused') THEN
    ALTER TABLE public.subscriptions ADD COLUMN auto_notify_paused boolean DEFAULT false;
  END IF;
END $$;

-- 4. Tabla de logs de notificaciones
CREATE TABLE IF NOT EXISTS public.subscription_notification_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  phone_number text,
  message_type text NOT NULL,        -- 'reminder', 'followup', 'confirmation'
  status text DEFAULT 'sent',        -- 'sent', 'failed'
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscription_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification logs" ON public.subscription_notification_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access notification logs" ON public.subscription_notification_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_logs_user_id ON public.subscription_notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_sub_id ON public.subscription_notification_logs(subscription_id);

-- 5. Tabla de renovaciones
CREATE TABLE IF NOT EXISTS public.subscription_renewals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  order_id uuid,
  chat_id uuid,
  phone_number text,
  customer_email text,
  plan_name text,
  amount decimal(10,2),
  old_expiration text,
  new_expiration text,
  receipt_url text,
  triggered_by text DEFAULT 'reminder',  -- 'reminder' o 'followup'
  status text DEFAULT 'pending_review',  -- 'pending_review', 'approved', 'rejected'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscription_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own renewals" ON public.subscription_renewals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own renewals" ON public.subscription_renewals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access renewals" ON public.subscription_renewals
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_renewals_user_id ON public.subscription_renewals(user_id);
CREATE INDEX IF NOT EXISTS idx_renewals_status ON public.subscription_renewals(status);
CREATE INDEX IF NOT EXISTS idx_renewals_created_at ON public.subscription_renewals(created_at DESC);

-- 6. Política service_role para subscriptions (para que el cron pueda actualizar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Service role full access subscriptions'
  ) THEN
    CREATE POLICY "Service role full access subscriptions" ON public.subscriptions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
