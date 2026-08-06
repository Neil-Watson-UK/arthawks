/*
 * Persist public contact-form submissions for admin inbox.
 * Writes go through service role from /api/contact; admins read via is_admin().
 */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'contact_topic') then
    create type public.contact_topic as enum (
      'hello',
      'artists',
      'venues',
      'support'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'contact_submission_status') then
    create type public.contact_submission_status as enum (
      'new',
      'read',
      'archived'
    );
  end if;
end $$;

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  topic public.contact_topic not null,
  name text not null,
  email text not null,
  message text not null,
  ip text,
  email_sent boolean not null default false,
  email_skipped boolean not null default false,
  status public.contact_submission_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_idx
  on public.contact_submissions (created_at desc);

create index if not exists contact_submissions_status_idx
  on public.contact_submissions (status, created_at desc);

create index if not exists contact_submissions_topic_idx
  on public.contact_submissions (topic, created_at desc);

alter table public.contact_submissions enable row level security;

drop policy if exists contact_submissions_admin_select on public.contact_submissions;
drop policy if exists contact_submissions_admin_update on public.contact_submissions;
drop policy if exists contact_submissions_admin_delete on public.contact_submissions;

create policy contact_submissions_admin_select
  on public.contact_submissions
  for select
  to authenticated
  using (public.is_admin());

create policy contact_submissions_admin_update
  on public.contact_submissions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy contact_submissions_admin_delete
  on public.contact_submissions
  for delete
  to authenticated
  using (public.is_admin());

grant select, update, delete on public.contact_submissions to authenticated;
grant all on public.contact_submissions to service_role;
