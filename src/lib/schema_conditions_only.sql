-- Solo ejecutar esto si ya tienes la tabla 'triggers' creada.
-- (Si te sale error de "ya existe", es que ya corriste la parte anterior).

-- 1. Crear tabla de condiciones
create table if not exists public.trigger_conditions (
  id uuid default gen_random_uuid() primary key,
  trigger_id uuid references public.triggers(id) on delete cascade not null,
  type text not null,               
  operator text default 'equals',   
  value text,                       
  created_at timestamp with time zone default now()
);

-- 2. Habilitar seguridad
alter table trigger_conditions enable row level security;

-- 3. Crear política (Borramos la anterior si existe para evitar error 42710)
drop policy if exists "Usuarios gestionan condiciones de sus disparadores" on trigger_conditions;

create policy "Usuarios gestionan condiciones de sus disparadores" on trigger_conditions
  for all using (
    exists (
      select 1 from triggers
      where triggers.id = trigger_conditions.trigger_id
      and triggers.user_id = auth.uid()
    )
  );

-- 4. Indice
create index if not exists idx_trigger_conditions_trigger_id on trigger_conditions(trigger_id);
