alter table public.insurers
  add column if not exists dmvic_member_company_id integer;

create unique index if not exists insurers_dmvic_member_company_id_uq
  on public.insurers (dmvic_member_company_id)
  where dmvic_member_company_id is not null;

create table if not exists public.dmvic_certificate_orders (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete restrict,
  insurer_id uuid references public.insurers(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,

  certificate_type text not null check (certificate_type in ('A','B','C','D')),
  certificate_classification integer,
  member_company_id integer,

  status text not null default 'awaiting_validation' check (status in (
    'awaiting_validation','validated','awaiting_payment','paid',
    'issuing','issued','manual_review','failed','refund_pending','refunded'
  )),

  selling_price numeric(14,2) not null check (selling_price >= 0),
  payment_status text not null default 'pending' check (payment_status in (
    'pending','confirmed','failed','refund_pending','refunded'
  )),
  payment_provider text,
  payment_reference text,
  paid_at timestamptz,

  dmvic_cost numeric(14,2) check (dmvic_cost is null or dmvic_cost >= 0),
  dmvic_settlement_status text not null default 'unsettled' check (dmvic_settlement_status in (
    'unsettled','pending','settled','disputed'
  )),
  dmvic_settled_at timestamptz,

  dmvic_api_request_number text,
  dmvic_transaction_number text,
  dmvic_certificate_number text,
  dmvic_issuance_request_id text,
  dmvic_last_error_code text,
  dmvic_last_error_message text,

  validated_at timestamptz,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dmvic_issue_requires_payment
    check (status not in ('issuing','issued') or payment_status = 'confirmed'),
  constraint dmvic_issued_requires_certificate
    check (status <> 'issued' or dmvic_certificate_number is not null)
);

create index if not exists dmvic_certificate_orders_policy_idx
  on public.dmvic_certificate_orders(policy_id);
create index if not exists dmvic_certificate_orders_status_idx
  on public.dmvic_certificate_orders(status);
create index if not exists dmvic_certificate_orders_payment_idx
  on public.dmvic_certificate_orders(payment_status);
create index if not exists dmvic_certificate_orders_settlement_idx
  on public.dmvic_certificate_orders(dmvic_settlement_status);

grant select on public.dmvic_certificate_orders to authenticated;
grant all on public.dmvic_certificate_orders to service_role;

alter table public.dmvic_certificate_orders enable row level security;

drop policy if exists "Authenticated users can read DMVIC certificate orders"
  on public.dmvic_certificate_orders;
create policy "Authenticated users can read DMVIC certificate orders"
  on public.dmvic_certificate_orders for select
  to authenticated
  using (true);