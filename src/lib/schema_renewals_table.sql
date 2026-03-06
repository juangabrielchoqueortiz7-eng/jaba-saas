-- ============================================================
-- CREAR TABLA subscription_renewals (ejecutar en Supabase SQL Editor)
-- Esta tabla registra cada renovación de suscripción para el dashboard de Renovaciones
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    chat_id TEXT,
    phone_number TEXT NOT NULL,
    customer_email TEXT,
    plan_name TEXT NOT NULL,
    amount NUMERIC(10,2),
    old_expiration TEXT,
    new_expiration TEXT,
    receipt_url TEXT,
    triggered_by TEXT DEFAULT 'manual',   -- 'reminder' | 'followup' | 'manual'
    status TEXT DEFAULT 'pending_review', -- 'pending_review' | 'approved' | 'rejected'
    reviewed_at TIMESTAMPTZ DEFAULT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sub_renewals_user_id ON subscription_renewals(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_renewals_status ON subscription_renewals(status);
CREATE INDEX IF NOT EXISTS idx_sub_renewals_created ON subscription_renewals(created_at DESC);

-- Habilitar RLS
ALTER TABLE subscription_renewals ENABLE ROW LEVEL SECURITY;

-- Policy: cada usuario solo ve sus propias renovaciones
CREATE POLICY "Users can read own renewals"
    ON subscription_renewals FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: el service role puede insertar (para el webhook)  
CREATE POLICY "Service role can insert renewals"
    ON subscription_renewals FOR INSERT
    WITH CHECK (true);

-- Policy: usuarios pueden actualizar sus propias renovaciones (approve/reject)
CREATE POLICY "Users can update own renewals"
    ON subscription_renewals FOR UPDATE
    USING (auth.uid() = user_id);
