alter table public.tenants
  add column if not exists ira_number text,
  add column if not exists ira_verification_status text not null default 'pending'
    check (ira_verification_status in ('pending','verified','rejected')),
  add column if not exists ira_verified_at timestamptz;

create unique index if not exists tenants_ira_number_uq on public.tenants (upper(ira_number)) where ira_number is not null;

alter table public.dmvic_certificate_orders
  add column if not exists tenant_id uuid references public.tenants(id) on delete restrict,
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete restrict,
  add column if not exists validation_payload jsonb,
  add column if not exists validation_response jsonb,
  add column if not exists issuance_payload jsonb,
  add column if not exists issuance_response jsonb,
  add column if not exists stock_checked_at timestamptz,
  add column if not exists payment_idempotency_key text,
  add column if not exists issuance_idempotency_key text;

create unique index if not exists dmvic_order_payment_idempotency_uq on public.dmvic_certificate_orders(payment_idempotency_key) where payment_idempotency_key is not null;
create unique index if not exists dmvic_order_issuance_idempotency_uq on public.dmvic_certificate_orders(issuance_idempotency_key) where issuance_idempotency_key is not null;
create index if not exists dmvic_orders_tenant_idx on public.dmvic_certificate_orders(tenant_id, created_at desc);

create table if not exists public.dmvic_certificate_prices (
 id uuid primary key default gen_random_uuid(),
 certificate_type text not null check (certificate_type in ('A','B','C','D')),
 classification integer,
 selling_price numeric(14,2) not null check (selling_price >= 0),
 dmvic_cost numeric(14,2) check (dmvic_cost is null or dmvic_cost >= 0),
 active boolean not null default true,
 effective_from timestamptz not null default now(),
 effective_to timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists dmvic_prices_lookup_idx on public.dmvic_certificate_prices(certificate_type, classification, active);

create table if not exists public.dmvic_order_events (
 id bigserial primary key,
 order_id uuid not null references public.dmvic_certificate_orders(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 event_type text not null,
 from_status text,
 to_status text,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists dmvic_order_events_order_idx on public.dmvic_order_events(order_id, created_at);

create table if not exists public.dmvic_settlements (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique,
 amount numeric(14,2) not null check(amount >= 0),
 status text not null default 'pending' check(status in ('pending','settled','disputed')),
 settled_at timestamptz,
 notes text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.dmvic_certificate_orders add column if not exists settlement_id uuid references public.dmvic_settlements(id) on delete set null;

grant select on public.dmvic_certificate_prices to authenticated;
grant all on public.dmvic_certificate_prices to service_role;
grant select on public.dmvic_order_events to authenticated;
grant all on public.dmvic_order_events to service_role;
grant select on public.dmvic_settlements to authenticated;
grant all on public.dmvic_settlements to service_role;
grant usage, select on sequence public.dmvic_order_events_id_seq to service_role;

alter table public.dmvic_certificate_prices enable row level security;
alter table public.dmvic_order_events enable row level security;
alter table public.dmvic_settlements enable row level security;

drop policy if exists "Tenant members read own DMVIC orders" on public.dmvic_certificate_orders;
create policy "Tenant members read own DMVIC orders" on public.dmvic_certificate_orders for select to authenticated
 using (tenant_id = public.current_tenant_id() or public.is_super_admin(auth.uid()));
drop policy if exists "Authenticated users can read DMVIC certificate orders" on public.dmvic_certificate_orders;

drop policy if exists "Authenticated read active DMVIC prices" on public.dmvic_certificate_prices;
create policy "Authenticated read active DMVIC prices" on public.dmvic_certificate_prices for select to authenticated using (active = true or public.is_super_admin(auth.uid()));
drop policy if exists "Tenant members read DMVIC order events" on public.dmvic_order_events;
create policy "Tenant members read DMVIC order events" on public.dmvic_order_events for select to authenticated
 using (exists(select 1 from public.dmvic_certificate_orders o where o.id=order_id and (o.tenant_id=public.current_tenant_id() or public.is_super_admin(auth.uid()))));
drop policy if exists "Super admin reads DMVIC settlements" on public.dmvic_settlements;
create policy "Super admin reads DMVIC settlements" on public.dmvic_settlements for select to authenticated using (public.is_super_admin(auth.uid()));