create table if not exists public.motor_insurer_rates (
 id uuid primary key default gen_random_uuid(),
 insurer_id uuid not null references public.insurers(id) on delete cascade,
 cover_type text not null check(cover_type in ('comprehensive','third_party','third_party_fire_theft')),
 vehicle_category text not null,
 rate_percent numeric(8,4),
 flat_premium numeric(14,2),
 minimum_premium numeric(14,2),
 excess_summary text,
 benefits_summary text,
 underwriting_notes text,
 active boolean not null default true,
 effective_from date not null default current_date,
 effective_to date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(rate_percent is not null or flat_premium is not null)
);
create index if not exists motor_rates_compare_idx on public.motor_insurer_rates(cover_type,vehicle_category,active);
grant select on public.motor_insurer_rates to authenticated;
grant all on public.motor_insurer_rates to service_role;
alter table public.motor_insurer_rates enable row level security;
drop policy if exists "Authenticated read motor comparison rates" on public.motor_insurer_rates;
create policy "Authenticated read motor comparison rates" on public.motor_insurer_rates for select to authenticated using(active=true or public.is_super_admin(auth.uid()));