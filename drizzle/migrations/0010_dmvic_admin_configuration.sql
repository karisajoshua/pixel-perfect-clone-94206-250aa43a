drop policy if exists "Super admin manages DMVIC prices" on public.dmvic_certificate_prices;
create policy "Super admin manages DMVIC prices"
on public.dmvic_certificate_prices for all to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

drop policy if exists "Super admin manages DMVIC settlements" on public.dmvic_settlements;
create policy "Super admin manages DMVIC settlements"
on public.dmvic_settlements for all to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

drop policy if exists "Super admin manages motor insurer rates" on public.motor_insurer_rates;
create policy "Super admin manages motor insurer rates"
on public.motor_insurer_rates for all to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

grant select, insert, update, delete on public.dmvic_certificate_prices to authenticated;
grant select, insert, update, delete on public.dmvic_settlements to authenticated;
grant select, insert, update, delete on public.motor_insurer_rates to authenticated;
grant all on public.dmvic_certificate_prices to service_role;
grant all on public.dmvic_settlements to service_role;
grant all on public.motor_insurer_rates to service_role;