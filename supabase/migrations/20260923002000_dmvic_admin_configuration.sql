-- Super-admin write controls for the DMVIC configuration centre.
-- Regular agency users retain read-only access granted by earlier migrations.

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
