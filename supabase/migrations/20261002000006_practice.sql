-- Safe to run again (e.g. pasted twice in the SQL Editor): every statement checks what exists.
-- Running the practice ("Paket & ödeme", "Tahliller"):
--   client_packages  what a client bought: N sessions and/or a period, at a price
--   payments         money received, optionally against a package
--   lab_results      blood-work values copied from the lab report, with the lab's OWN reference
--                    range (labs differ; the app never assumes one)
-- Practice data like any other: owner-only, a client account can never read or write it, and
-- removing a client removes all of it.

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- null: not counted in sessions (e.g. a monthly follow-up)
  sessions_total integer check (sessions_total is null or sessions_total between 1 and 200),
  starts_on date not null default current_date,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  price numeric(12, 2) check (price is null or price >= 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'EUR', 'USD', 'GBP')),
  note text check (note is null or char_length(note) <= 2000),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_packages_client_idx on public.client_packages (client_id, starts_on);
create index if not exists client_packages_owner_idx on public.client_packages (owner_id, closed_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  package_id uuid references public.client_packages (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0 and amount < 10000000),
  currency text not null default 'TRY' check (currency in ('TRY', 'EUR', 'USD', 'GBP')),
  paid_on date not null default current_date,
  method text not null default 'transfer' check (method in ('cash', 'card', 'transfer', 'other')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_client_idx on public.payments (client_id, paid_on);
create index if not exists payments_owner_idx on public.payments (owner_id, paid_on);
create index if not exists payments_package_idx on public.payments (package_id);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  taken_on date not null default current_date,
  -- a key from the app's list (glucose_fasting, hba1c, …) or the dietitian's own test name
  test text not null check (char_length(btrim(test)) between 1 and 80),
  value numeric(12, 3) not null check (value >= 0 and value < 1000000),
  unit text check (unit is null or char_length(unit) <= 20),
  ref_low numeric(12, 3),
  ref_high numeric(12, 3),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ref_low is null or ref_high is null or ref_low <= ref_high)
);
create index if not exists lab_results_client_idx on public.lab_results (client_id, test, taken_on);
create index if not exists lab_results_owner_idx on public.lab_results (owner_id, taken_on);

drop trigger if exists set_updated_at on public.client_packages;
create trigger set_updated_at before update on public.client_packages
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.lab_results;
create trigger set_updated_at before update on public.lab_results
  for each row execute function public.set_updated_at();

-- A payment may only point at a package of the same client.
create or replace function public.payment_package_matches(p_package uuid, p_client uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_package is null
      or exists (select 1 from public.client_packages k where k.id = p_package and k.client_id = p_client);
$$;

-- Grants (explicit; platform default privileges are not relied on)
revoke all on public.client_packages, public.payments, public.lab_results from anon;
grant select, insert, update, delete on public.client_packages, public.payments, public.lab_results
  to authenticated;
grant all on public.client_packages, public.payments, public.lab_results to service_role;
revoke all on function public.payment_package_matches(uuid, uuid) from public, anon;
grant execute on function public.payment_package_matches(uuid, uuid) to authenticated, service_role;

alter table public.client_packages enable row level security;
alter table public.payments enable row level security;
alter table public.lab_results enable row level security;

-- Owner only; every row must point at one of the owner's own clients.
drop policy if exists client_packages_owner_select on public.client_packages;
create policy client_packages_owner_select on public.client_packages for select to authenticated
  using (owner_id = (select public.staff_uid()));
drop policy if exists client_packages_owner_insert on public.client_packages;
create policy client_packages_owner_insert on public.client_packages for insert to authenticated
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id));
drop policy if exists client_packages_owner_update on public.client_packages;
create policy client_packages_owner_update on public.client_packages for update to authenticated
  using (owner_id = (select public.staff_uid()))
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id));
drop policy if exists client_packages_owner_delete on public.client_packages;
create policy client_packages_owner_delete on public.client_packages for delete to authenticated
  using (owner_id = (select public.staff_uid()));

drop policy if exists payments_owner_select on public.payments;
create policy payments_owner_select on public.payments for select to authenticated
  using (owner_id = (select public.staff_uid()));
drop policy if exists payments_owner_insert on public.payments;
create policy payments_owner_insert on public.payments for insert to authenticated
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id)
              and public.payment_package_matches(package_id, client_id));
drop policy if exists payments_owner_update on public.payments;
create policy payments_owner_update on public.payments for update to authenticated
  using (owner_id = (select public.staff_uid()))
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id)
              and public.payment_package_matches(package_id, client_id));
drop policy if exists payments_owner_delete on public.payments;
create policy payments_owner_delete on public.payments for delete to authenticated
  using (owner_id = (select public.staff_uid()));

drop policy if exists lab_results_owner_select on public.lab_results;
create policy lab_results_owner_select on public.lab_results for select to authenticated
  using (owner_id = (select public.staff_uid()));
drop policy if exists lab_results_owner_insert on public.lab_results;
create policy lab_results_owner_insert on public.lab_results for insert to authenticated
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id));
drop policy if exists lab_results_owner_update on public.lab_results;
create policy lab_results_owner_update on public.lab_results for update to authenticated
  using (owner_id = (select public.staff_uid()))
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id));
drop policy if exists lab_results_owner_delete on public.lab_results;
create policy lab_results_owner_delete on public.lab_results for delete to authenticated
  using (owner_id = (select public.staff_uid()));
