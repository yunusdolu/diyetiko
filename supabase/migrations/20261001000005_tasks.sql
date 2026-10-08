-- Safe to run again (e.g. pasted twice in the SQL Editor): every statement checks what exists.
-- Dietitian's own to-do list ("Görevler"): reminders with an optional due day, optionally tied to
-- a client ("Mert'i ara", "Kan tahlili sonucunu iste"). Practice data like any other: owner-only,
-- a client account can never read or write it. Removing a client removes their tasks.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_on date,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_owner_idx on public.tasks (owner_id, done_at, due_on);
create index if not exists tasks_client_idx on public.tasks (client_id);

drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Grants (explicit; platform default privileges are not relied on)
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

alter table public.tasks enable row level security;

-- Owner only; a task may point only at one of the owner's own clients.
drop policy if exists tasks_owner_select on public.tasks;
create policy tasks_owner_select on public.tasks for select to authenticated
  using (owner_id = (select public.staff_uid()));
drop policy if exists tasks_owner_insert on public.tasks;
create policy tasks_owner_insert on public.tasks for insert to authenticated
  with check (owner_id = (select public.staff_uid()) and (client_id is null or public.owns_client(client_id)));
drop policy if exists tasks_owner_update on public.tasks;
create policy tasks_owner_update on public.tasks for update to authenticated
  using (owner_id = (select public.staff_uid()))
  with check (owner_id = (select public.staff_uid()) and (client_id is null or public.owns_client(client_id)));
drop policy if exists tasks_owner_delete on public.tasks;
create policy tasks_owner_delete on public.tasks for delete to authenticated
  using (owner_id = (select public.staff_uid()));
