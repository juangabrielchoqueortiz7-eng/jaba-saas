-- TABLA DE PLANTILLAS (Templates)
-- Permite guardar respuestas predefinidas para usar en el chat o en la configuración de IA.

create table if not exists public.templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,              -- Nombre identificativo (ej: "Bienvenida", "Precios")
  content text not null,           -- El mensaje a enviar
  category text default 'general', -- Para agrupar (ej: 'sales', 'support') - Opcional futuro
  created_at timestamp with time zone default now()
);

-- Seguridad RLS
alter table templates enable row level security;

-- Política: Los usuarios solo ven y editan SUS propias plantillas
create policy "Usuarios gestionan sus propias plantillas" on templates
  for all using (auth.uid() = user_id);

-- Índices
create index idx_templates_user_id on templates(user_id);
