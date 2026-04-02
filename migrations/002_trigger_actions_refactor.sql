-- Migration: Refactor trigger_actions + add action_sequences support
-- Purpose: Support 12+ action types with delays, chaining and better logging

-- 1. Add new columns to trigger_actions
ALTER TABLE trigger_actions
ADD COLUMN IF NOT EXISTS delay_seconds INTEGER DEFAULT 0,         -- Pausa antes de ejecutar esta acción
ADD COLUMN IF NOT EXISTS condition_payload JSONB,                 -- Condición opcional (ejecutar solo si se cumple)
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 0,           -- Reintentos en caso de fallo
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;          -- Activar/desactivar sin borrar

-- 2. Create trigger_action_sequences table for chained actions
CREATE TABLE IF NOT EXISTS trigger_action_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES trigger_actions(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  delay_before_seconds INTEGER DEFAULT 0,                          -- Delay ANTES de este step
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(trigger_id, action_id)
);

-- 3. Indexes for action_sequences
CREATE INDEX IF NOT EXISTS idx_trigger_action_sequences_trigger ON trigger_action_sequences(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_action_sequences_order ON trigger_action_sequences(trigger_id, sequence_order);

-- 4. Update trigger_executions to include per-action details
ALTER TABLE trigger_executions
ADD COLUMN IF NOT EXISTS action_details JSONB DEFAULT '[]'::JSONB,  -- Array de resultados de cada acción
ADD COLUMN IF NOT EXISTS actions_failed INTEGER DEFAULT 0,           -- Cuántas acciones fallaron
ADD COLUMN IF NOT EXISTS execution_context JSONB;                    -- Contexto de evaluación

-- 5. Add custom_fields column to chats if not exists
-- (needed for update_field action)
ALTER TABLE chats
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::JSONB;

-- 6. Add bot_enabled column to chats if not exists
-- (needed for toggle_bot action)
ALTER TABLE chats
ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT true;

-- 7. Indexes for execution performance
CREATE INDEX IF NOT EXISTS idx_trigger_executions_trigger_status ON trigger_executions(trigger_id, status);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_chat_created ON trigger_executions(chat_id, created_at DESC);

-- 8. Create notifications table for notify_admin action
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',        -- 'trigger_alert', 'system', 'info', 'warning'
  title TEXT NOT NULL,
  message TEXT,
  chat_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 9. RLS for notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
CREATE POLICY "Users can manage own notifications"
  ON notifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. Comments
COMMENT ON COLUMN trigger_actions.delay_seconds IS 'Segundos de pausa antes de ejecutar esta acción. 0 = sin pausa.';
COMMENT ON COLUMN trigger_actions.condition_payload IS 'Condición JSON opcional. Si se define, la acción solo se ejecuta si la condición se cumple.';
COMMENT ON TABLE trigger_action_sequences IS 'Secuencia de acciones con delays. Permite acciones encadenadas con pausa entre ellas.';
COMMENT ON TABLE notifications IS 'Notificaciones generadas por disparadores via notify_admin. Visibles en el dashboard.';

-- 11. Update legacy action type names (optional migration)
-- Map old 'send_message' to new 'send_text' for new triggers (existing ones keep working)
-- This is backward compatible - both types work
