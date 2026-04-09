-- =============================================
-- Generalizar automation_jobs para cualquier tipo de negocio
-- =============================================

-- Tipo de audiencia: a quién enviar
ALTER TABLE public.automation_jobs
ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT 'subscriptions_expiring';
-- Valores: 'subscriptions_expiring' | 'all_contacts' | 'tagged_contacts'

-- Configuración extra de audiencia (ej: tags a filtrar)
ALTER TABLE public.automation_jobs
ADD COLUMN IF NOT EXISTS target_config JSONB DEFAULT '{}';
-- Ejemplo para tagged_contacts: { "tags": ["vip", "lead-nuevo"] }

-- Comentario descriptivo para la UI
COMMENT ON COLUMN public.automation_jobs.target_type IS 'Tipo de audiencia: subscriptions_expiring, all_contacts, tagged_contacts';
COMMENT ON COLUMN public.automation_jobs.target_config IS 'Configuración adicional según target_type (ej: tags para tagged_contacts)';
