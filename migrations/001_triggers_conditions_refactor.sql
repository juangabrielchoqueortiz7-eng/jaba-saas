-- Migration: Refactor trigger_conditions table + add trigger_condition_groups
-- Purpose: Support flexible condition types with AND/OR logic grouping

-- 1. Add new columns to trigger_conditions
ALTER TABLE trigger_conditions
ADD COLUMN IF NOT EXISTS condition_type TEXT,
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES trigger_condition_groups(id) ON DELETE CASCADE;

-- 2. Create trigger_condition_groups table for AND/OR logic
CREATE TABLE IF NOT EXISTS trigger_condition_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  operator TEXT NOT NULL DEFAULT 'AND' CHECK (operator IN ('AND', 'OR')), -- AND = all must match, OR = any can match
  group_order INTEGER NOT NULL DEFAULT 0,
  parent_group_id UUID REFERENCES trigger_condition_groups(id) ON DELETE CASCADE, -- For nested groups
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(trigger_id, id) -- Ensure uniqueness within trigger
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trigger_condition_groups_trigger_id ON trigger_condition_groups(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_condition_groups_parent_id ON trigger_condition_groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_trigger_conditions_group_id ON trigger_conditions(group_id);

-- 4. Create trigger_executions table for audit/logging
CREATE TABLE IF NOT EXISTS trigger_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  chat_id UUID,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')), -- What happened
  conditions_met BOOLEAN,
  conditions_evaluated INTEGER DEFAULT 0, -- How many conditions were checked
  actions_executed INTEGER DEFAULT 0, -- How many actions ran
  errors TEXT[] DEFAULT '{}'::TEXT[], -- Any error messages
  execution_time_ms INTEGER, -- How long it took
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL -- For audit
);

-- 5. Create indexes for executions
CREATE INDEX IF NOT EXISTS idx_trigger_executions_trigger_id ON trigger_executions(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_chat_id ON trigger_executions(chat_id);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_created_at ON trigger_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_status ON trigger_executions(status);

-- 6. Create trigger_variables table for custom field definitions
CREATE TABLE IF NOT EXISTS trigger_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL, -- e.g., "customer_tier", "region", "purchase_count"
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean')),
  category TEXT NOT NULL CHECK (category IN ('custom', 'contact', 'chat', 'subscription')), -- Where this field lives
  description TEXT, -- Help text for UI
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, field_name, category)
);

-- 7. Index for variables
CREATE INDEX IF NOT EXISTS idx_trigger_variables_user_id ON trigger_variables(user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_variables_category ON trigger_variables(category);

-- 8. Add comment to schema for documentation
COMMENT ON TABLE trigger_condition_groups IS 'Groups conditions with AND/OR logic. Supports nested groups for complex queries.';
COMMENT ON TABLE trigger_executions IS 'Audit log: tracks every trigger execution, conditions matched, actions run, and any errors.';
COMMENT ON TABLE trigger_variables IS 'Custom field definitions per user. Defines what chat metadata variables are available for conditions/actions.';

-- 9. Migrate existing data (optional: can be done in app code instead)
-- Set condition_type from existing type values if they exist
UPDATE trigger_conditions
SET condition_type = type
WHERE condition_type IS NULL AND type IS NOT NULL;

-- Create default condition group for each trigger without groups
INSERT INTO trigger_condition_groups (trigger_id, operator, group_order)
SELECT DISTINCT trigger_id, 'AND', 0
FROM trigger_conditions
WHERE group_id IS NULL
  AND trigger_id NOT IN (SELECT DISTINCT trigger_id FROM trigger_condition_groups)
ON CONFLICT DO NOTHING;

-- Assign ungrouped conditions to their trigger's default group
UPDATE trigger_conditions
SET group_id = (
  SELECT id FROM trigger_condition_groups
  WHERE trigger_condition_groups.trigger_id = trigger_conditions.trigger_id
    AND group_order = 0
  LIMIT 1
)
WHERE group_id IS NULL;

-- Add audit function to update trigger_executions.updated_at automatically
CREATE OR REPLACE FUNCTION update_trigger_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_trigger_variables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS trigger_executions_updated_at ON trigger_executions;
CREATE TRIGGER trigger_executions_updated_at
AFTER UPDATE ON trigger_executions
FOR EACH ROW
EXECUTE FUNCTION update_trigger_executions_updated_at();

DROP TRIGGER IF EXISTS trigger_variables_updated_at ON trigger_variables;
CREATE TRIGGER trigger_variables_updated_at
AFTER UPDATE ON trigger_variables
FOR EACH ROW
EXECUTE FUNCTION update_trigger_variables_updated_at();
