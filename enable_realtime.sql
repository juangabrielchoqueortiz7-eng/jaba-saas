begin;
  -- Enable Realtime for the subscriptions table
  alter publication supabase_realtime add table public.subscriptions;
commit;
