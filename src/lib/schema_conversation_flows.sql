-- ============================================================
-- Schema: Conversation Flows (Visual Flow Builder)
-- ============================================================

-- 1. Flujos principales
CREATE TABLE IF NOT EXISTS public.conversation_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0, -- Mayor prioridad se evalúa primero
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flows_user_active ON public.conversation_flows (user_id, is_active);

-- 2. Nodos de cada flujo
CREATE TABLE IF NOT EXISTS public.flow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- trigger, message, buttons, list, condition, ai_response, action, wait_input, delay
    label TEXT DEFAULT '',
    -- Posición en el canvas (para el editor visual)
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,
    -- Configuración del nodo (JSON flexible)
    config JSONB DEFAULT '{}',
    -- Ejemplos de config según tipo:
    -- trigger:      {"trigger_type": "keyword", "keywords": ["hola","plan"], "match_mode": "contains"}
    -- trigger:      {"trigger_type": "event", "event": "first_message"}
    -- trigger:      {"trigger_type": "button_id", "button_id": "renew_plan_*"}
    -- message:      {"text": "¡Hola! Bienvenido a {{service_name}}"}
    -- buttons:      {"text": "Elige una opción:", "buttons": [{"id":"btn_1","title":"Opción 1"},{"id":"btn_2","title":"Opción 2"}]}
    -- list:         {"text": "Selecciona:", "button_text": "Ver opciones", "sections": [...]}
    -- condition:    {"condition_type": "contains", "field": "message", "value": "@"}
    -- condition:    {"condition_type": "message_type", "value": "image"}
    -- ai_response:  {"system_prompt": "Eres un asistente amable...", "max_tokens": 500}
    -- action:       {"action_type": "create_order", "params": {...}}
    -- action:       {"action_type": "update_subscription", "params": {...}}
    -- action:       {"action_type": "add_tag", "tag": "cliente_vip"}
    -- action:       {"action_type": "send_image", "image_url": "{{qr_image_url}}"}
    -- wait_input:   {"timeout_seconds": 300, "timeout_node_id": "..."}
    -- delay:        {"seconds": 2}
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow ON public.flow_nodes (flow_id);

-- 3. Conexiones entre nodos (edges)
CREATE TABLE IF NOT EXISTS public.flow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
    -- Para nodos condition: label del branch (ej: "true", "false", "btn_1")
    source_handle TEXT DEFAULT 'default',
    label TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_edges_flow ON public.flow_edges (flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_edges_source ON public.flow_edges (source_node_id);

-- 4. Estado del usuario dentro de un flujo activo
CREATE TABLE IF NOT EXISTS public.chat_flow_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
    current_node_id UUID REFERENCES public.flow_nodes(id) ON DELETE SET NULL,
    -- Variables recolectadas durante el flujo (email, plan seleccionado, etc.)
    variables JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active', -- active, completed, abandoned
    started_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_flow_state_chat ON public.chat_flow_state (chat_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_flow_state_active ON public.chat_flow_state (chat_id) WHERE status = 'active';

-- 5. RLS Policies
ALTER TABLE public.conversation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_flow_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flows" ON public.conversation_flows
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own flow nodes" ON public.flow_nodes
    FOR ALL USING (flow_id IN (SELECT id FROM public.conversation_flows WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own flow edges" ON public.flow_edges
    FOR ALL USING (flow_id IN (SELECT id FROM public.conversation_flows WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own flow state" ON public.chat_flow_state
    FOR ALL USING (user_id = auth.uid());
