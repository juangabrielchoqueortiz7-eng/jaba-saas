-- MODIFICACIÓN DE CREDENCIALES (Saldos)
-- Agregamos columnas para llevar el saldo de conversaciones y audios.

do $$ 
begin
  -- Saldo de Conversaciones (default 100 gratis)
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='balance_conversations') then
    alter table public.whatsapp_credentials add column balance_conversations integer default 100;
  end if;

  -- Saldo de Audios (segundos o minutos? Usaremos 'unidades' o 'créditos' para simplificar por ahora. Asumimos 1 crédito = 1 minuto o 1 audio)
  -- En la UI dice "30 minutos". Guardemos MINUTOS.
  if not exists (select 1 from information_schema.columns where table_name='whatsapp_credentials' and column_name='balance_audio_minutes') then
    alter table public.whatsapp_credentials add column balance_audio_minutes integer default 15;
  end if;
end $$;


-- TABLA DE TRANSACCIONES (Historial de Recargas)
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(10, 2) not null,   -- Monto pagado (ej: 9.99)
  currency text default 'USD',
  type text not null,               -- 'conversations', 'audios'
  credits_added integer not null,   -- Cuánto se recargó
  status text default 'completed',  -- 'pending', 'completed', 'failed'
  payment_method text default 'manual', -- 'stripe', 'mercadopago', 'manual'
  created_at timestamp with time zone default now()
);

-- Seguridad RLS
alter table transactions enable row level security;

create policy "Usuarios ven sus propias transacciones" on transactions
  for all using (auth.uid() = user_id);

create index idx_transactions_user_id on transactions(user_id);
