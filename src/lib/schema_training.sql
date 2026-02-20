-- Agregar campo training_prompt a whatsapp_credentials
-- Este campo almacena el prompt personalizado de entrenamiento de cada usuario
ALTER TABLE whatsapp_credentials ADD COLUMN IF NOT EXISTS training_prompt TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN whatsapp_credentials.training_prompt IS 'Prompt de entrenamiento personalizado. Define el comportamiento de la IA para este negocio.';
