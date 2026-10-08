-- What the dietitian shares with the client beyond the programme: tasks the client ticks off, and
-- the client's own packages and payments (read-only). Needs …000005_tasks.sql and
-- …000006_practice.sql. Safe to run again.

-- ---------------------------------------------------------------------------
-- Tasks the client can see and tick
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists shared boolean not null default false;
alter table public.tasks drop constraint if exists tasks_shared_check;
-- only a task that belongs to a client can be shown to that client
alter table public.tasks add constraint tasks_shared_check check (not shared or client_id is not null);
create index if not exists tasks_shared_idx on public.tasks (client_id) where shared;

-- The client's shared tasks: open ones, and those finished in the last week (so a tick can be
-- undone and the list does not empty the moment it is done).
create or replace function public.portal_tasks() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'dueOn', t.due_on,
    'doneAt', t.done_at
  ) order by t.done_at is not null, t.due_on nulls last, t.created_at), '[]'::jsonb)
  from public.tasks t
  where t.client_id = public.my_client_id()
    and t.shared
    and (t.done_at is null or t.done_at > now() - interval '7 days')
$$;

-- The client ticks (or unticks) one of their own shared tasks. Nothing else about a task can be
-- changed from the portal.
create or replace function public.portal_task_done(p_id uuid, p_done boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_client uuid := public.my_client_id();
begin
  if v_client is null then
    return false;
  end if;
  update public.tasks
     set done_at = case when p_done then coalesce(done_at, now()) end
   where id = p_id and client_id = v_client and shared;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- The client's own packages and payments (never the dietitian's notes)
-- ---------------------------------------------------------------------------
create or replace function public.portal_billing() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'packages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id,
        'name', k.name,
        'sessionsTotal', k.sessions_total,
        'startsOn', k.starts_on,
        'endsOn', k.ends_on,
        'price', k.price,
        'currency', k.currency,
        'closed', k.closed_at is not null,
        'paid', coalesce((
          select sum(p.amount) from public.payments p
           where p.package_id = k.id and p.currency = k.currency), 0),
        -- attended appointments inside the package's dates (Istanbul calendar day)
        'used', (
          select count(*) from public.appointments a
           where a.client_id = k.client_id and a.status = 'done'
             and (a.starts_at + interval '3 hours')::date >= k.starts_on
             and (k.ends_on is null or (a.starts_at + interval '3 hours')::date <= k.ends_on))
      ) order by k.starts_on desc, k.created_at desc)
      from public.client_packages k
      where k.client_id = public.my_client_id()), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'amount', p.amount,
        'currency', p.currency,
        'paidOn', p.paid_on,
        'method', p.method,
        'packageId', p.package_id
      ) order by p.paid_on desc, p.created_at desc)
      from public.payments p
      where p.client_id = public.my_client_id()), '[]'::jsonb)
  )
$$;

revoke all on function public.portal_tasks(), public.portal_task_done(uuid, boolean),
  public.portal_billing() from public, anon;
grant execute on function public.portal_tasks(), public.portal_task_done(uuid, boolean),
  public.portal_billing() to authenticated;
