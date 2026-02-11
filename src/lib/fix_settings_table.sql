-- Create the table if it doesn't exist
create table if not exists public.subscription_settings (
    user_id uuid references auth.users not null primary key,
    reminder_msg text,
    expired_grace_msg text,
    expired_removed_msg text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.subscription_settings enable row level security;

-- Create policies
create policy "Users can view their own settings"
on public.subscription_settings for select
using ( auth.uid() = user_id );

create policy "Users can insert/update their own settings"
on public.subscription_settings for insert
with check ( auth.uid() = user_id );

create policy "Users can update their own settings"
on public.subscription_settings for update
using ( auth.uid() = user_id );

-- Grant access
grant all on public.subscription_settings to authenticated;
grant all on public.subscription_settings to service_role;
