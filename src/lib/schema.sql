
-- 1. TABLA DE PERFILES
-- Esta tabla se vincula automáticamente con los usuarios de autenticación
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  company_name text,
  avatar_url text,
  subscription_plan text default 'free', -- 'free', 'pro', 'enterprise'
  credits integer default 10,            -- Créditos iniciales para usar la IA
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. SEGURIDAD (Row Level Security)
-- Habilitamos la seguridad para que nadie pueda ver datos que no le corresponden
alter table profiles enable row level security;

-- Política de Lectura: El usuario solo ve su propio perfil
create policy "Usuarios pueden ver su propio perfil" on profiles
  for select using (auth.uid() = id);

-- Política de Escritura: El usuario solo edita su propio perfil
create policy "Usuarios pueden editar su propio perfil" on profiles
  for update using (auth.uid() = id);

-- 3. AUTOMATIZACIÓN (Trigger)
-- Esta función se ejecuta automáticamente cada vez que alguien se registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, credits)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    10 -- Regalo de bienvenida: 10 créditos
  );
  return new;
end;
$$ language plpgsql security definer;

-- Conectamos la función al evento de creación de usuario
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
