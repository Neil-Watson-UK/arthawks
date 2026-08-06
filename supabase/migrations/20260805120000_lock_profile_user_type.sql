/*
 * Prevent authenticated users from escalating to admin (or changing user_type)
 * via a direct profiles UPDATE through the Data API.
 * Admins may still change types; service_role bypasses RLS/triggers as usual
 * for registration/onboarding server paths that use the service client.
 */

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_type is distinct from old.user_type
       and not public.is_admin() then
      raise exception 'Cannot change user_type'
        using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active
       and not public.is_admin() then
      raise exception 'Cannot change is_active'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();

revoke all on function public.prevent_profile_privilege_escalation() from public;
