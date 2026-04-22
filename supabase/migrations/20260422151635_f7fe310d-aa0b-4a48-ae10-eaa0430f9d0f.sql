create table if not exists public.department_links (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  link_type text not null check (link_type in ('whatsapp','drive','notion','figma','slack','trello','loom')),
  label text,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_department_links_department on public.department_links(department);

alter table public.department_links enable row level security;

create policy "auth read department_links"
on public.department_links for select
to authenticated using (true);

create policy "owner_admin insert department_links"
on public.department_links for insert
to authenticated
with check (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

create policy "owner_admin update department_links"
on public.department_links for update
to authenticated
using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

create policy "owner_admin delete department_links"
on public.department_links for delete
to authenticated
using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

create trigger trg_department_links_updated_at
before update on public.department_links
for each row execute function public.update_updated_at_column();