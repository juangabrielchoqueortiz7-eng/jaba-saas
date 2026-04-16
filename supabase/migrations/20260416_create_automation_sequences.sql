CREATE TABLE IF NOT EXISTS public.automation_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sequence_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_step INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  reply_cutoff_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  context JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'automation_sequences_status_check'
      AND conrelid = 'public.automation_sequences'::REGCLASS
  ) THEN
    ALTER TABLE public.automation_sequences
      ADD CONSTRAINT automation_sequences_status_check
      CHECK (status IN ('active', 'paused', 'completed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS automation_sequences_status_scheduled_idx
  ON public.automation_sequences (status, scheduled_for);

CREATE INDEX IF NOT EXISTS automation_sequences_chat_idx
  ON public.automation_sequences (chat_id);

CREATE INDEX IF NOT EXISTS automation_sequences_order_idx
  ON public.automation_sequences (order_id);

CREATE UNIQUE INDEX IF NOT EXISTS automation_sequences_active_order_key_idx
  ON public.automation_sequences (order_id, sequence_key)
  WHERE status = 'active' AND order_id IS NOT NULL;

ALTER TABLE public.automation_sequences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'automation_sequences'
      AND policyname = 'Users can view own automation_sequences'
  ) THEN
    CREATE POLICY "Users can view own automation_sequences"
      ON public.automation_sequences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'automation_sequences'
      AND policyname = 'Users can update own automation_sequences'
  ) THEN
    CREATE POLICY "Users can update own automation_sequences"
      ON public.automation_sequences FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'automation_sequences'
      AND policyname = 'Users can insert own automation_sequences'
  ) THEN
    CREATE POLICY "Users can insert own automation_sequences"
      ON public.automation_sequences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'automation_sequences'
      AND policyname = 'Service role can access all automation_sequences'
  ) THEN
    CREATE POLICY "Service role can access all automation_sequences"
      ON public.automation_sequences FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role')
      WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_automation_sequences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS automation_sequences_updated_at_trigger ON public.automation_sequences;
CREATE TRIGGER automation_sequences_updated_at_trigger
BEFORE UPDATE ON public.automation_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_automation_sequences_updated_at();
