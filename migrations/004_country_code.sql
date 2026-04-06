-- Migration 004: Add country_code to whatsapp_credentials
-- Allows each tenant to configure their country phone prefix (e.g. '591' for Bolivia, '52' for Mexico)

ALTER TABLE whatsapp_credentials
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '591';

COMMENT ON COLUMN whatsapp_credentials.country_code IS 'Country phone prefix for this tenant (e.g. 591, 52, 57)';
