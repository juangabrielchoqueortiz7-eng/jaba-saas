-- Add target_type and target_config columns to automation_jobs
-- These fields control which contacts receive the automation message

ALTER TABLE public.automation_jobs
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT 'subscriptions_expiring',
  ADD COLUMN IF NOT EXISTS target_config JSONB DEFAULT '{}';
