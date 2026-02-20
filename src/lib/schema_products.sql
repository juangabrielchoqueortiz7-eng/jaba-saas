-- TABLA DE PRODUCTOS / SERVICIOS (Genérica)
-- Cada usuario define sus propios productos: servicios de spa, planes, consultas, etc.

create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,                    -- "Masaje Relajante", "Plan Premium", "Consulta General"
  description text,                      -- Descripción libre del producto/servicio
  price decimal not null default 0,      -- Precio en moneda local
  category text default 'general',       -- Para agrupar: 'servicio', 'producto', 'plan', etc.
  qr_image_url text,                     -- URL del QR de pago (opcional)
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Seguridad RLS
alter table products enable row level security;

-- Política: Usuarios solo gestionan SUS propios productos
create policy "Usuarios gestionan sus propios productos" on products
  for all using (auth.uid() = user_id);

-- Permitir al service role acceso total (para webhook)
create policy "Service role full access products" on products
  for all using (true)
  with check (true);

-- Índices
create index idx_products_user_id on products(user_id);
create index idx_products_active on products(user_id, is_active);
