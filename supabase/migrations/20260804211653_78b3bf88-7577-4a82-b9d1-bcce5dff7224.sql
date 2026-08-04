
create or replace function public.clients_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only guards the portal-client self-service path; staff edits are unaffected.
  if NEW.auth_user_id is not distinct from auth.uid()
     and auth.uid() is not null
     and not (
       public.has_role(auth.uid(), 'admin'::app_role)
       or public.has_role(auth.uid(), 'manager'::app_role)
       or public.has_role(auth.uid(), 'agent'::app_role)
     )
  then
    NEW.kyc_status     := OLD.kyc_status;
    NEW.assigned_agent := OLD.assigned_agent;
    NEW.branch_id      := OLD.branch_id;
    NEW.tenant_id      := OLD.tenant_id;
    NEW.client_type    := OLD.client_type;
    NEW.auth_user_id   := OLD.auth_user_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists clients_guard_self_update on public.clients;
create trigger clients_guard_self_update
before update on public.clients
for each row execute function public.clients_guard_self_update();

create or replace function public.profiles_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.id = auth.uid() and not public.has_role(auth.uid(), 'admin'::app_role) then
    NEW.branch_id := OLD.branch_id;
    NEW.tenant_id := OLD.tenant_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_guard_self_update on public.profiles;
create trigger profiles_guard_self_update
before update on public.profiles
for each row execute function public.profiles_guard_self_update();
