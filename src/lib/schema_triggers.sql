-- TABLA DE DISPARADORES (Triggers)
-- Define reglas automáticas que ejecutan acciones basadas en eventos o lógica.

create table if not exists public.triggers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,               -- Nombre interno (ej: "Envío comprobante")
  type text default 'logic',        -- 'logic' (IA evalúa), 'keyword' (palabra clave), 'manual' (flujo)
  description text,                 -- Descripción lógica para la IA (ej: "El usuario envía una foto de comprobante")
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- TABLA DE ACCIONES DE DISPARADOR (Trigger Actions)
-- Define qué sucede cuando un disparador se activa.
create table if not exists public.trigger_actions (
  id uuid default gen_random_uuid() primary key,
  trigger_id uuid references public.triggers(id) on delete cascade not null,
  type text not null,               -- 'update_status', 'add_tag', 'notify_admin', 'send_message'
  payload jsonb default '{}'::jsonb, -- Configuración de la acción (ej: { status: 'paid' }, { message: 'Hola...' })
  action_order integer default 0,    -- Orden de ejecución (1, 2, 3...)
  created_at timestamp with time zone default now()
);

-- Seguridad RLS
alter table triggers enable row level security;
alter table trigger_actions enable row level security;

-- Políticas
create policy "Usuarios gestionan sus propios disparadores" on triggers
  for all using (auth.uid() = user_id);

create policy "Usuarios gestionan acciones de sus disparadores" on trigger_actions
  for all using (
    exists (
      select 1 from triggers
      where triggers.id = trigger_actions.trigger_id
      and triggers.user_id = auth.uid()
    )
  );

-- Índices
create index idx_triggers_user_id on triggers(user_id);
create index idx_trigger_actions_trigger_id on trigger_actions(trigger_id);

-- TABLA DE CONDICIONES DE DISPARADOR (Trigger Conditions)
-- Define requisitos previos para que un disparador se ejecute.
create table if not exists public.trigger_conditions (
  id uuid default gen_random_uuid() primary key,
  trigger_id uuid references public.triggers(id) on delete cascade not null,
  type text not null,               -- 'last_message', 'message_count', 'contains_words', 'has_tag', 'schedule', 'template_sent'
  operator text default 'equals',   -- 'equals', 'contains', 'greater_than', 'less_than', 'not_equals'
  value text,                       -- Valor a comparar (ej: "PAGO_PENDIENTE", "5", "hola")
  created_at timestamp with time zone default now()
);

-- Seguridad RLS para condiciones
alter table trigger_conditions enable row level security;

create policy "Usuarios gestionan condiciones de sus disparadores" on trigger_conditions
  for all using (
    exists (
      select 1 from triggers
      where triggers.id = trigger_conditions.trigger_id
      and triggers.user_id = auth.uid()
    )
  );

create index idx_trigger_conditions_trigger_id on trigger_conditions(trigger_id);
