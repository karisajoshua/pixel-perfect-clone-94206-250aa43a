alter table public.policies
  add column if not exists insurer_base_premium numeric(14,2),
  add column if not exists markup_type text,
  add column if not exists markup_value numeric(14,2),
  add column if not exists markup_amount numeric(14,2),
  add column if not exists quoted_premium numeric(14,2);

alter table public.policies drop constraint if exists policies_markup_type_check;
alter table public.policies add constraint policies_markup_type_check
  check (markup_type is null or markup_type in ('fixed','percent'));

alter table public.policies drop constraint if exists policies_markup_nonnegative_check;
alter table public.policies add constraint policies_markup_nonnegative_check
  check (
    coalesce(insurer_base_premium,0) >= 0 and
    coalesce(markup_value,0) >= 0 and
    coalesce(markup_amount,0) >= 0 and
    coalesce(quoted_premium,0) >= 0
  );

alter table public.quotations
  add column if not exists insurer_base_premium numeric(14,2),
  add column if not exists markup_type text,
  add column if not exists markup_value numeric(14,2),
  add column if not exists markup_amount numeric(14,2),
  add column if not exists quoted_premium numeric(14,2);

alter table public.quotations drop constraint if exists quotations_markup_type_check;
alter table public.quotations add constraint quotations_markup_type_check
  check (markup_type is null or markup_type in ('fixed','percent'));

alter table public.quotations drop constraint if exists quotations_markup_nonnegative_check;
alter table public.quotations add constraint quotations_markup_nonnegative_check
  check (
    coalesce(insurer_base_premium,0) >= 0 and
    coalesce(markup_value,0) >= 0 and
    coalesce(markup_amount,0) >= 0 and
    coalesce(quoted_premium,0) >= 0
  );

comment on column public.policies.insurer_base_premium is 'Original insurer/company premium before agency or agent markup.';
comment on column public.policies.markup_amount is 'Calculated markup retained separately from insurer base premium.';
comment on column public.policies.quoted_premium is 'Final client-facing quoted premium: insurer base premium plus markup.';