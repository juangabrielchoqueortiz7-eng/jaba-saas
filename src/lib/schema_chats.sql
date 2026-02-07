
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

-- 7. CREDENCIALES DE WHATSAPP (Multi-Tenant)
create table if not exists public.whatsapp_credentials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  phone_number_id text not null unique, -- ID del teléfono en Meta (identifica al tenant)
  access_token text not null,           -- Token Permanente del usuario
  verify_token text default 'jaba_verify_token', -- Token para validar webhook (puede ser fijo o único)
  openai_key text,                      -- (Opcional) Si traen su propia Key
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 8. Seguridad para Credenciales
alter table whatsapp_credentials enable row level security;

create policy "Usuarios ven sus propias credenciales" on whatsapp_credentials
  for all using (auth.uid() = user_id);

-- 9. ACTUALIZACIÓN CHATS (SaaS)
-- Vincula cada chat a un usuario del sistema (Dueño del negocio)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name='chats' and column_name='user_id') then
    alter table public.chats add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

-- 10. NUEVOS CAMPOS CONFIGURACIÓN ASISTENTE (SellerChat Clone)
do $$ 
begin
  -- Nombre del Bot (ej: "JabaBot")
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='bot_name') then
    alter table public.whatsapp_credentials add column bot_name text default 'Mi Asistente';
  end if;

  -- Mensaje de Bienvenida
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='welcome_message') then
    alter table public.whatsapp_credentials add column welcome_message text;
  end if;

  -- Teléfono Visual (ej: "+591 693...")
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='phone_number_display') then
    alter table public.whatsapp_credentials add column phone_number_display text;
  end if;

  -- 11. NUEVOS CAMPOS CONFIGURACIÓN IA (Sub-tabs)
  -- IA -> General
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='ai_status') then
    alter table public.whatsapp_credentials add column ai_status text default 'active'; -- 'active', 'sleep'
  end if;
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='response_delay_seconds') then
    alter table public.whatsapp_credentials add column response_delay_seconds integer default 5;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='audio_probability') then
    alter table public.whatsapp_credentials add column audio_probability integer default 0; -- 0 = 100% texto, 100 = 100% audio
  end if;

  -- IA -> Texto
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='message_delivery_mode') then
    alter table public.whatsapp_credentials add column message_delivery_mode text default 'complete'; -- 'complete', 'streaming'
  end if;
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='use_emojis') then
    alter table public.whatsapp_credentials add column use_emojis boolean default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='use_text_styles') then
    alter table public.whatsapp_credentials add column use_text_styles boolean default true;
  end if;

  -- IA -> Audio
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='audio_voice_id') then
    alter table public.whatsapp_credentials add column audio_voice_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='max_audio_count') then
    alter table public.whatsapp_credentials add column max_audio_count integer default 2;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='reply_audio_with_audio') then
    alter table public.whatsapp_credentials add column reply_audio_with_audio boolean default false;
  end if;

  -- 12. NUEVOS CAMPOS CHAT (Opcionales)
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='waba_id') then
    alter table public.whatsapp_credentials add column waba_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='app_id') then
    alter table public.whatsapp_credentials add column app_id text;
  end if;

end $$;

-- Actualizar política de chats para que solo veas LOS TUYOS
drop policy if exists "Usuarios autenticados ven chats" on chats;
create policy "Usuarios ven sus propios chats" on chats
  for all using (auth.uid() = user_id);

-- Los mensajes heredan la seguridad del chat, pero podemos reforzar
drop policy if exists "Usuarios autenticados ven mensajes" on messages;
create policy "Usuarios ven mensajes de sus chats" on messages
  for all using (
    exists (
      select 1 from chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  );

