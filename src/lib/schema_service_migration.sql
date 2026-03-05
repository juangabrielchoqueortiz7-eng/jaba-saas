-- ============================================================
-- MIGRACIÓN: Agregar service_name y service_description a whatsapp_credentials
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar campos para que cada negocio configure su servicio
ALTER TABLE whatsapp_credentials ADD COLUMN IF NOT EXISTS service_name TEXT DEFAULT NULL;
ALTER TABLE whatsapp_credentials ADD COLUMN IF NOT EXISTS service_description TEXT DEFAULT NULL;
ALTER TABLE whatsapp_credentials ADD COLUMN IF NOT EXISTS promo_image_url TEXT DEFAULT NULL;

-- 2. Comentarios
COMMENT ON COLUMN whatsapp_credentials.service_name IS 'Nombre del servicio (ej: Canva Pro, Gym Pro, Academia Virtual). Usado por el bot en los mensajes.';
COMMENT ON COLUMN whatsapp_credentials.service_description IS 'Descripción del servicio (ej: acceso a diseño profesional). Usado por el bot en el saludo.';

-- 3. ACTUALIZAR TU CUENTA (ejecutar después de agregar los campos):
-- UPDATE whatsapp_credentials 
-- SET service_name = 'Canva Pro', 
--     service_description = 'diseño profesional con Canva Pro. Tendrás acceso a miles de plantillas Pro exclusivas, Estudio Mágico (IA), Kit de Marca, eliminación de fondos, páginas web profesionales, y más de 100M de fotos y videos premium'
-- WHERE user_id = '<TU-USER-ID>';
