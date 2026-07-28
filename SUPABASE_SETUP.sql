-- Chorey 0.8.0 shared-data setup
-- Household PINs are application controls, not database authentication.

alter table public.tasks enable row level security;
alter table public.occurrence_states enable row level security;
grant select, insert, update, delete on table public.tasks to anon;
grant select, insert, update, delete on table public.occurrence_states to anon;

drop policy if exists "SupaChorey shared task access" on public.tasks;
create policy "SupaChorey shared task access" on public.tasks for all to anon using (true) with check (true);
drop policy if exists "SupaChorey shared occurrence access" on public.occurrence_states;
create policy "SupaChorey shared occurrence access" on public.occurrence_states for all to anon using (true) with check (true);

-- Removes task definitions that the application has already forgotten:
-- expired Once tasks and completed Indefinite tasks from a previous day.
create or replace function public.chorey_cleanup_expired_tasks()
returns void language plpgsql security definer set search_path = public as $$
declare expired_ids text[];
begin
  select coalesce(array_agg(id), array[]::text[]) into expired_ids
  from public.tasks
  where
    (task->'schedule'->>'type' = 'once' and (task->'schedule'->>'date')::date < current_date)
    or
    (task->'schedule'->>'type' = 'indefinite' and exists (
      select 1 from public.occurrence_states o
      where o.id = tasks.id || '@indefinite'
        and coalesce((o.state->>'isDone')::boolean, false)
        and (o.state->>'completedAt')::timestamptz::date < current_date
    ));

  if cardinality(expired_ids) > 0 then
    delete from public.occurrence_states where split_part(id, '@', 1) = any(expired_ids);
    delete from public.tasks where id = any(expired_ids);
  end if;
end;
$$;

-- Optional nightly schedule. Supabase projects with pg_cron enabled can run:
-- select cron.schedule('chorey-nightly-cleanup', '0 2 * * *', $$select public.chorey_cleanup_expired_tasks();$$);
