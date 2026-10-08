-- Files in messages (a client sends a lab report as a PDF or a photo; the dietitian can send one
-- back) and daily movement in the check-in. Safe to run again.

-- ---------------------------------------------------------------------------
-- Messages: one optional file each
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_mime text,
  add column if not exists file_size integer;

alter table public.messages drop constraint if exists messages_file_check;
alter table public.messages add constraint messages_file_check check (
  (file_path is null and file_name is null and file_mime is null and file_size is null)
  or (
    file_path is not null
    and char_length(file_name) between 1 and 200
    and file_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    and file_size between 1 and 10485760
  )
);
create index if not exists messages_files_idx on public.messages (client_id, created_at desc)
  where file_path is not null;

-- The owner comes from the client record; a file must sit in that client's own folder
-- ("<dietitian id>/<client id>/…"), whoever sends the message.
create or replace function public.message_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select c.owner_id into new.owner_id from public.clients c where c.id = new.client_id;
  if new.owner_id is null then
    raise exception 'client not found' using errcode = '23503';
  end if;
  new.author_id := (select auth.uid());
  new.read_at := null;
  new.created_at := now();
  if new.diary_meal_id is not null and not exists (
    select 1 from public.diary_meals m where m.id = new.diary_meal_id and m.client_id = new.client_id
  ) then
    raise exception 'diary meal of another client' using errcode = '42501';
  end if;
  if new.file_path is not null
     and not starts_with(new.file_path, new.owner_id::text || '/' || new.client_id::text || '/') then
    raise exception 'file outside the client folder' using errcode = '42501';
  end if;
  return new;
end $$;

-- Private bucket for those files, "<dietitian id>/<client id>/<uuid>.<ext>"
insert into storage.buckets (id, name, public)
values ('client-uploads', 'client-uploads', false)
on conflict (id) do nothing;

drop policy if exists "client uploads client write" on storage.objects;
create policy "client uploads client write" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-uploads' and starts_with(name, (select public.my_photo_prefix())));
drop policy if exists "client uploads client read" on storage.objects;
create policy "client uploads client read" on storage.objects for select to authenticated
  using (bucket_id = 'client-uploads' and starts_with(name, (select public.my_photo_prefix())));
drop policy if exists "client uploads dietitian write" on storage.objects;
create policy "client uploads dietitian write" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-uploads' and (storage.foldername(name))[1] = (select public.staff_uid())::text);
drop policy if exists "client uploads dietitian read" on storage.objects;
create policy "client uploads dietitian read" on storage.objects for select to authenticated
  using (bucket_id = 'client-uploads' and (storage.foldername(name))[1] = (select public.staff_uid())::text);
drop policy if exists "client uploads dietitian delete" on storage.objects;
create policy "client uploads dietitian delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-uploads' and (storage.foldername(name))[1] = (select public.staff_uid())::text);

-- ---------------------------------------------------------------------------
-- Check-in: movement of the day (minutes, and what it was)
-- ---------------------------------------------------------------------------
alter table public.checkins
  add column if not exists activity_min smallint,
  add column if not exists activity_note text;
alter table public.checkins drop constraint if exists checkins_activity_check;
alter table public.checkins add constraint checkins_activity_check check (
  (activity_min is null or activity_min between 0 and 600)
  and (activity_note is null or char_length(activity_note) <= 200)
);
