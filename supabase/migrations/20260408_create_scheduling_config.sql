-- Create scheduling_config table for per-user scheduling preferences
CREATE TABLE IF NOT EXISTS public.scheduling_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone VARCHAR(50) DEFAULT 'America/La_Paz',

  -- Horarios en formato 0-23 (hora local del usuario)
  reminder_hour INT DEFAULT 9 CHECK (reminder_hour >= 0 AND reminder_hour <= 23),
  followup_hour INT DEFAULT 18 CHECK (followup_hour >= 0 AND followup_hour <= 23),
  urgency_hour INT DEFAULT 9 CHECK (urgency_hour >= 0 AND urgency_hour <= 23),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduling_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view/update their own config
CREATE POLICY "Users can view own scheduling_config"
  ON public.scheduling_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduling_config"
  ON public.scheduling_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduling_config"
  ON public.scheduling_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for cron jobs)
CREATE POLICY "Service role can access all scheduling_config"
  ON public.scheduling_config FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create index on user_id for faster lookups
CREATE INDEX idx_scheduling_config_user_id ON public.scheduling_config(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduling_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduling_config_updated_at_trigger
BEFORE UPDATE ON public.scheduling_config
FOR EACH ROW
EXECUTE FUNCTION update_scheduling_config_updated_at();
