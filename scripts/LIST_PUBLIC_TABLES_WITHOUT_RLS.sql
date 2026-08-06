-- Paste in Supabase Dashboard → SQL Editor to see which public tables lack RLS.
-- This is what the "rls_disabled_in_public" email is about.

select
  n.nspname as schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;
