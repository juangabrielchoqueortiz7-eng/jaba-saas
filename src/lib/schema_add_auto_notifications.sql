ALTER TABLE public.subscription_settings ADD COLUMN IF NOT EXISTS enable_auto_notifications BOOLEAN DEFAULT true;
