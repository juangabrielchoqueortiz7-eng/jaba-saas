-- ============================================================
-- MIGRACIÓN: Agregar duration_months a tabla products
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar el campo duration_months a productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS duration_months INT DEFAULT NULL;

-- 2. Comentario para documentar el uso
COMMENT ON COLUMN products.duration_months IS 
    'Duración en meses que otorga este plan/producto. NULL = sin duración (servicio puntual). Usado para calcular automáticamente la nueva fecha de vencimiento al aprobar una renovación.';

-- 3. Índice auxiliar (opcional, para consultas en el webhook)
CREATE INDEX IF NOT EXISTS idx_products_duration ON products(user_id, duration_months) 
    WHERE duration_months IS NOT NULL;

-- ============================================================
-- VERIFICACIÓN: Ver productos existentes y su duración
-- ============================================================
-- SELECT id, name, price, duration_months FROM products WHERE user_id = '<tu-user-id>';

-- ============================================================
-- ACTUALIZACIÓN MANUAL (opcional): Si ya tienes planes creados,
-- puedes asignarles su duración ahora:
-- ============================================================
-- UPDATE products SET duration_months = 1  WHERE name ILIKE '%1 mes%';
-- UPDATE products SET duration_months = 3  WHERE name ILIKE '%3 mes%' OR name ILIKE '%trimestral%';
-- UPDATE products SET duration_months = 6  WHERE name ILIKE '%6 mes%' OR name ILIKE '%semestral%';
-- UPDATE products SET duration_months = 12 WHERE name ILIKE '%anual%' OR name ILIKE '% año%';
