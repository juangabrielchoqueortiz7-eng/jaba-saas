-- Create a table for subscriptions
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  numero text,
  correo text,
  vencimiento text, -- Keeping as text to match original flexibility, or could be date
  estado text default 'ACTIVO',
  equipo text,
  notified boolean default false,
  user_id uuid references auth.users(id) on delete cascade not null
);

-- Enable Row Level Security (RLS)
alter table public.subscriptions enable row level security;

-- Create policies to restrict access to the owner only
create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own subscriptions"
  on public.subscriptions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own subscriptions"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

-- Create indexes for common searches
create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_estado_idx on public.subscriptions(estado);
