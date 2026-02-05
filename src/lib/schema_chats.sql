
-- ... (Tablas anteriores de profiles) ...

-- 4. CHATS (Conversaciones)
create table if not exists public.chats (
  id uuid default gen_random_uuid() primary key,
  phone_number text not null unique, -- El número de WhatsApp del cliente
  contact_name text,                 -- Nombre (si lo tenemos)
  last_message text,                 -- Previsualización del último mensaje
  last_message_time timestamp with time zone default now(),
  unread_count integer default 0,
  created_at timestamp with time zone default now()
);

-- 5. MENSAJES
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats(id) on delete cascade not null,
  content text,                      -- El texto del mensaje
  is_from_me boolean default false,  -- true = yo envié, false = cliente envió
  status text default 'delivered',   -- 'sent', 'delivered', 'read'
  created_at timestamp with time zone default now()
);

-- 6. SEGURIDAD PARA CHATS
alter table chats enable row level security;
alter table messages enable row level security;

-- Permitir que cualquier usuario autenticado vea los chats (simplificado para este SaaS)
-- En un SaaS real multi-tenant, habría que filtrar por 'organization_id'
create policy "Usuarios autenticados ven chats" on chats
  for all using (auth.role() = 'authenticated');

create policy "Usuarios autenticados ven mensajes" on messages
  for all using (auth.role() = 'authenticated');

-- Indices para velocidad
create index idx_chats_phone on chats(phone_number);
create index idx_messages_chat_id on messages(chat_id);
create index idx_messages_created_at on messages(created_at);
