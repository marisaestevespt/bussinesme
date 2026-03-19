drop policy if exists "Public can read business settings" on public.business_settings;

create policy "Public can read business settings"
on public.business_settings
for select
to anon
using (true);