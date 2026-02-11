-- Create table for subscription settings
create table public.subscription_settings (
  user_id uuid references auth.users(id) not null primary key,
  reminder_msg text,
  expired_grace_msg text,
  expired_removed_msg text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.subscription_settings enable row level security;

-- Policies
create policy "Users can view their own settings"
  on public.subscription_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.subscription_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.subscription_settings for update
  using (auth.uid() = user_id);
