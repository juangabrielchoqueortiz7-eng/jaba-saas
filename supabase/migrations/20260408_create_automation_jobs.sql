CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  template_params JSONB DEFAULT '[]',
  hour INT NOT NULL DEFAULT 9 CHECK (hour >= 0 AND hour <= 23),
  timezone VARCHAR(50) DEFAULT 'America/La_Paz',
  trigger_days_before INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automation_jobs"
  ON public.automation_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access automation_jobs"
  ON public.automation_jobs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX IF NOT EXISTS idx_automation_jobs_user_id ON public.automation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_active ON public.automation_jobs(is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_automation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_jobs_updated_at
BEFORE UPDATE ON public.automation_jobs
FOR EACH ROW EXECUTE FUNCTION update_automation_jobs_updated_at();
