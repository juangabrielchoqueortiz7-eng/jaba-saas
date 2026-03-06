-- ============================================================
-- Etiquetas CRM: Agregar columna tags a chats
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Columna tags (array de texto)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Índice GIN para búsqueda eficiente por tag
CREATE INDEX IF NOT EXISTS idx_chats_tags ON chats USING GIN(tags);
