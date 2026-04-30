-- Fase 4.1: Anti-spam guard — agregar cooldown_minutes a la tabla triggers
-- Ejecutar en Supabase SQL Editor

ALTER TABLE triggers
  ADD COLUMN IF NOT EXISTS cooldown_minutes INT DEFAULT 60;

-- Comentario explicativo
COMMENT ON COLUMN triggers.cooldown_minutes IS
  'Minutos de cooldown por chat. Si el mismo trigger se ejecutó para el mismo chat dentro de este período, se omite. 0 = sin límite.';
