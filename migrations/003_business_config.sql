-- =============================================
-- Migración 003: Configuración de negocio por tenant
-- Agrega campos configurables para escalar JABA como SaaS multi-tenant
-- =============================================

-- Zona horaria del negocio (reemplaza el hardcode de Bolivia UTC-4)
ALTER TABLE whatsapp_credentials
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/La_Paz';

-- Símbolo de moneda (reemplaza el hardcode de "Bs")
ALTER TABLE whatsapp_credentials
ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'Bs';

-- Métodos de pago del negocio (reemplaza el hardcode de "QR bancario (BancoSol...)")
ALTER TABLE whatsapp_credentials
ADD COLUMN IF NOT EXISTS payment_methods TEXT DEFAULT 'QR bancario';
