-- SupaChorey browser access setup
-- Run this once in the Supabase SQL Editor if the publishable-key client cannot
-- read or write the two tables. SupaChorey intentionally has no Supabase Auth;
-- its household PINs are application controls, not database security.

alter table public.tasks enable row level security;
alter table public.occurrence_states enable row level security;

grant select, insert, update, delete on table public.tasks to anon;
grant select, insert, update, delete on table public.occurrence_states to anon;

drop policy if exists "SupaChorey shared task access" on public.tasks;
create policy "SupaChorey shared task access"
on public.tasks
for all
to anon
using (true)
with check (true);

drop policy if exists "SupaChorey shared occurrence access" on public.occurrence_states;
create policy "SupaChorey shared occurrence access"
on public.occurrence_states
for all
to anon
using (true)
with check (true);
