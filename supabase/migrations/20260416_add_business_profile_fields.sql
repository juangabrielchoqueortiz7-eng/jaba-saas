-- Phase 1/2: add multi-business configuration without changing existing accounts.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  business_name TEXT,
  phone TEXT,
  plan_id TEXT DEFAULT 'free',
  conversations_balance INTEGER DEFAULT 500,
  conversations_total INTEGER DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] DEFAULT ARRAY[
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'orders',
    'payments',
    'settings'
  ]::TEXT[],
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_profile JSONB DEFAULT '{}'::JSONB;

ALTER TABLE public.user_profiles
  ALTER COLUMN enabled_modules SET DEFAULT ARRAY[
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'orders',
    'payments',
    'settings'
  ]::TEXT[],
  ALTER COLUMN onboarding_completed SET DEFAULT false,
  ALTER COLUMN business_profile SET DEFAULT '{}'::JSONB;

UPDATE public.user_profiles
SET
  business_type = 'subscriptions',
  enabled_modules = ARRAY[
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'orders',
    'payments',
    'subscriptions',
    'renewals',
    'notifications',
    'recharges',
    'achievements',
    'settings',
    'admin_accounts'
  ]::TEXT[],
  onboarding_completed = true,
  business_profile = COALESCE(business_profile, '{}'::JSONB)
WHERE business_type IS NULL;

UPDATE public.user_profiles
SET
  enabled_modules = ARRAY[
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'orders',
    'payments',
    'settings'
  ]::TEXT[]
WHERE enabled_modules IS NULL OR array_length(enabled_modules, 1) IS NULL;

UPDATE public.user_profiles
SET business_profile = '{}'::JSONB
WHERE business_profile IS NULL;

INSERT INTO public.user_profiles (
  id,
  full_name,
  business_type,
  enabled_modules,
  onboarding_completed,
  business_profile
)
SELECT
  users.id,
  users.raw_user_meta_data->>'full_name',
  'subscriptions',
  ARRAY[
    'home',
    'chats',
    'assistants',
    'training',
    'flows',
    'triggers',
    'templates',
    'products',
    'orders',
    'payments',
    'subscriptions',
    'renewals',
    'notifications',
    'recharges',
    'achievements',
    'settings',
    'admin_accounts'
  ]::TEXT[],
  true,
  '{}'::JSONB
FROM auth.users AS users
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_profiles AS profiles
  WHERE profiles.id = users.id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_business_type_check'
      AND conrelid = 'public.user_profiles'::REGCLASS
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_business_type_check
      CHECK (
        business_type IS NULL OR business_type IN (
          'subscriptions',
          'restaurant',
          'store',
          'clinic',
          'gym',
          'education',
          'real_estate',
          'technical_service',
          'travel',
          'custom'
        )
      );
  END IF;
END $$;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Users can view own user_profiles'
  ) THEN
    CREATE POLICY "Users can view own user_profiles"
      ON public.user_profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Users can update own user_profiles'
  ) THEN
    CREATE POLICY "Users can update own user_profiles"
      ON public.user_profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Users can insert own user_profiles'
  ) THEN
    CREATE POLICY "Users can insert own user_profiles"
      ON public.user_profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Service role can access all user_profiles'
  ) THEN
    CREATE POLICY "Service role can access all user_profiles"
      ON public.user_profiles FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at_trigger ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at_trigger
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    full_name,
    business_type,
    enabled_modules,
    onboarding_completed,
    business_profile
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NULL,
    ARRAY[
      'home',
      'chats',
      'assistants',
      'training',
      'flows',
      'triggers',
      'templates',
      'products',
      'orders',
      'payments',
      'settings'
    ]::TEXT[],
    false,
    '{}'::JSONB
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();
