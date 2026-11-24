-- FICTIONAL DEMO DATA for the shared demo site only (scripts/demo-db.mjs runs it after
-- supabase/local/demo.sql). Never run against a production database.
--
-- Makes the panel look like a busy practice: more clients, unread messages in several threads,
-- tasks due today, a full week of appointments, new requests, packages, payments, lab results,
-- daily check-ins and active programs. Every date is relative to "now", so a reset (nightly, see
-- demo-db.mjs) always shows a current week. Portal links use the data-only accounts
-- <name>@diyetiko.test that demo-db.mjs creates; without them those parts are skipped.

-- one message with its own time (the insert trigger stamps "now" and clears read_at)
create or replace function pg_temp.demo_msg(
  p_client uuid, p_author text, p_body text, p_days_ago int, p_time time, p_read boolean
) returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.messages (client_id, author, body) values (p_client, p_author, p_body)
  returning id into v_id;
  update public.messages
     set created_at = least(((now() at time zone 'Europe/Istanbul')::date - p_days_ago + p_time)
                            at time zone 'Europe/Istanbul', now() - interval '5 minutes'),
         read_at = case when p_read then now() - interval '1 minute' else null end
   where id = v_id;
end $$;

-- a message from "today": so many minutes before the reset ran (keeps today's threads spread out)
create or replace function pg_temp.demo_msg_ago(
  p_client uuid, p_author text, p_body text, p_minutes_ago int, p_read boolean
) returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.messages (client_id, author, body) values (p_client, p_author, p_body)
  returning id into v_id;
  update public.messages
     set created_at = now() - make_interval(mins => p_minutes_ago),
         read_at = case when p_read then now() - interval '1 minute' else null end
   where id = v_id;
end $$;

-- habits + daily check-ins for the last p_days days (a few days skipped, like real people)
create or replace function pg_temp.demo_checkins(
  p_client uuid, p_owner uuid, p_days int, p_start_kg real, p_trend real, p_labels text[]
) returns void language plpgsql as $$
declare
  v_habits uuid[] := '{}';
  v_id uuid;
  i int;
begin
  for i in 1 .. array_length(p_labels, 1) loop
    insert into public.client_habits (owner_id, client_id, label, position)
    values (p_owner, p_client, p_labels[i], i - 1) returning id into v_id;
    v_habits := v_habits || v_id;
  end loop;
  for i in reverse p_days .. 1 loop
    continue when i % 5 = 4; -- a missed day now and then
    insert into public.checkins (client_id, day, weight_kg, water_ml, habits, energy, note, updated_at)
    values (
      p_client,
      current_date - i,
      round((p_start_kg + p_trend * (p_days - i) + ((i % 3) - 1) * 0.2)::numeric, 1),
      1250 + (i % 4) * 250,
      v_habits[1 : 1 + (i % array_length(v_habits, 1))],
      3 + (i % 3 = 0)::int,
      case when i = 2 then 'Dün akşam dışarıda yedim ama porsiyonu küçük tuttum.' end,
      least(((current_date - i) + time '21:30') at time zone 'Europe/Istanbul', now())
    );
  end loop;
end $$;

-- copy a program (days, meals, items) for another client
create or replace function pg_temp.demo_copy_program(
  p_src uuid, p_client uuid, p_title text, p_status public.program_status, p_days_ago int,
  p_kcal real
) returns void language plpgsql as $$
declare v_new uuid := gen_random_uuid();
begin
  insert into public.programs (id, owner_id, client_id, is_template, title, language, status, starts_on,
                               target_kcal, target_protein_g, target_carb_g, target_fat_g, notes, hydration)
  select v_new, owner_id, p_client, false, p_title, 'tr', p_status, current_date - p_days_ago,
         p_kcal, round(p_kcal * 0.25 / 4), round(p_kcal * 0.45 / 4), round(p_kcal * 0.30 / 9), notes, hydration
    from public.programs where id = p_src;

  create temp table demo_day_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from public.program_days where program_id = p_src;
  insert into public.program_days (id, owner_id, program_id, position, label)
  select m.new_id, d.owner_id, v_new, d.position, d.label
    from public.program_days d join demo_day_map m on m.old_id = d.id;

  create temp table demo_meal_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from public.program_meals where program_id = p_src;
  insert into public.program_meals (id, owner_id, program_id, day_id, slot, position, time_label, note)
  select mm.new_id, pm.owner_id, v_new, dm.new_id, pm.slot, pm.position, pm.time_label, pm.note
    from public.program_meals pm
    join demo_meal_map mm on mm.old_id = pm.id
    join demo_day_map dm on dm.old_id = pm.day_id;

  insert into public.program_meal_items (owner_id, program_id, meal_id, food_id, recipe_id, name, grams,
                                         unit_key, unit_qty, servings, kcal, protein_g, carb_g, fat_g,
                                         fiber_g, note, position)
  select i.owner_id, v_new, mm.new_id, i.food_id, i.recipe_id, i.name, i.grams, i.unit_key, i.unit_qty,
         i.servings, i.kcal, i.protein_g, i.carb_g, i.fat_g, i.fiber_g, i.note, i.position
    from public.program_meal_items i join demo_meal_map mm on mm.old_id = i.meal_id;

  drop table demo_day_map;
  drop table demo_meal_map;
end $$;

do $extra$
declare
  v_owner uuid;
  -- existing demo clients (supabase/local/demo.sql)
  c_deniz  constant uuid := '8c333d28-8e6c-5635-946c-1e3d9066554c';
  c_emre   constant uuid := 'e0dfed6d-9351-53a5-9efd-6960f459309f';
  c_layla  constant uuid := '82874080-9118-558c-a40b-6ebebb298afc';
  c_camille constant uuid := '422ac089-f6c4-5897-87f6-99c47a01879d';
  c_mert   constant uuid := '6b2010b0-cd81-5359-9d4b-1e6ef7957fb4';
  -- new ones
  c_zeynep uuid := gen_random_uuid();
  c_can    uuid := gen_random_uuid();
  c_ayse   uuid := gen_random_uuid();
  c_burak  uuid := gen_random_uuid();
  c_elif   uuid := gen_random_uuid();
  c_hakan  uuid := gen_random_uuid();
  c_merve  uuid := gen_random_uuid();
  c_ozan   uuid := gen_random_uuid();
  v_template constant uuid := 'a65a3ccd-bbdf-5600-9c3d-122423909eda';
  p_ayse uuid := gen_random_uuid();
  p_can uuid := gen_random_uuid();
  p_zeynep uuid := gen_random_uuid();
  p_burak uuid := gen_random_uuid();
  p_hakan uuid := gen_random_uuid();
  r record;
begin
  select id into v_owner from public.profiles where role = 'dietitian' order by created_at limit 1;
  if v_owner is null then
    raise exception 'No dietitian account found.';
  end if;

  -- ── Clients ──────────────────────────────────────────────────────────────
  insert into public.clients (id, owner_id, full_name, email, phone, birth_date, sex, height_cm, goal,
                              goal_weight_kg, activity_level, allergies, medical_notes, preferred_language,
                              status, tags, source, kvkk_consent_at, kvkk_consent_version, created_at) values
    (c_zeynep, v_owner, 'Zeynep Arslan (demo)', 'zeynep.demo@example.com', '+905550000011', current_date - interval '34 years', 'female', 164,
     'Doğum sonrası enerjiyi toparlamak, yavaş ve kalıcı kilo vermek.', 62, 'light', null, 'Demo: emziriyor; kalori açığı küçük tutulacak.', 'tr',
     'active', '{"online"}', 'demo', now() - interval '35 days', 'kvkk-2026-01', now() - interval '35 days'),
    (c_can, v_owner, 'Can Öztürk (demo)', 'can.demo@example.com', '+905550000012', current_date - interval '41 years', 'male', 178,
     'Kolesterolü düşürmek, bel çevresini azaltmak.', 82, 'sedentary', null, 'Demo: LDL yüksek; hekim takibinde.', 'tr',
     'active', '{"ofis"}', 'demo', now() - interval '63 days', 'kvkk-2026-01', now() - interval '63 days'),
    (c_ayse, v_owner, 'Ayşe Kılıç (demo)', 'ayse.demo@example.com', '+905550000013', current_date - interval '28 years', 'female', 168,
     'İnsülin direnci; tatlı krizlerini azaltmak.', 64, 'light', 'Fındık', 'Demo: insülin direnci tanısı var.', 'tr',
     'active', '{"online"}', 'demo', now() - interval '49 days', 'kvkk-2026-01', now() - interval '49 days'),
    (c_burak, v_owner, 'Burak Şahin (demo)', 'burak.demo@example.com', '+905550000014', current_date - interval '23 years', 'male', 183,
     'Kas kazanımı, haftada 4 gün ağırlık antrenmanı.', 80, 'very_active', null, null, 'tr',
     'active', '{"sporcu"}', 'demo', now() - interval '21 days', 'kvkk-2026-01', now() - interval '21 days'),
    (c_elif, v_owner, 'Elif Yılmaz (demo)', 'elif.y.demo@example.com', '+905550000015', current_date - interval '52 years', 'female', 160,
     'Menopoz döneminde kemik sağlığı ve kilo dengesi.', 66, 'moderate', null, null, 'tr',
     'active', '{"ofis"}', 'demo', now() - interval '91 days', 'kvkk-2026-01', now() - interval '91 days'),
    (c_hakan, v_owner, 'Hakan Demirtaş (demo)', 'hakan.demo@example.com', '+905550000016', current_date - interval '47 years', 'male', 174,
     'Tip 2 diyabet; öğün düzeni ve karbonhidrat dağılımı.', 85, 'light', null, 'Demo: metformin kullanıyor (hekim kararı).', 'tr',
     'active', '{"online"}', 'demo', now() - interval '77 days', 'kvkk-2026-01', now() - interval '77 days'),
    (c_merve, v_owner, 'Merve Aydın (demo)', 'merve.demo@example.com', '+905550000017', current_date - interval '31 years', 'female', 170,
     'Şişkinlik ve sindirim rahatsızlıkları.', null, 'moderate', 'Laktoz', null, 'tr',
     'paused', '{}', 'demo', now() - interval '56 days', 'kvkk-2026-01', now() - interval '56 days'),
    (c_ozan, v_owner, 'Ozan Kurt (demo)', 'ozan.demo@example.com', '+905550000018', current_date - interval '36 years', 'male', 176,
     'Maraton hazırlığı: uzun koşu günlerinde enerji.', null, 'very_active', null, null, 'tr',
     'active', '{"sporcu","online"}', 'demo', now() - interval '14 days', 'kvkk-2026-01', now() - interval '14 days');

  -- ── Measurements (a few weigh-ins each) ─────────────────────────────────────
  insert into public.measurements (owner_id, client_id, measured_at, weight_kg, body_fat_pct, waist_cm, hip_cm)
  select v_owner, x.client_id, now() - make_interval(days => x.days_ago), x.kg, x.fat, x.waist, x.hip
    from (values
      (c_zeynep, 35, 71.4, 33.0, 88.0, 104.0), (c_zeynep, 21, 70.1, 32.4, 86.5, 103.0), (c_zeynep, 7, 69.2, 31.9, 85.0, 102.0),
      (c_can, 63, 92.8, 27.5, 104.0, null), (c_can, 42, 91.0, 26.9, 102.0, null), (c_can, 21, 89.6, 26.1, 100.0, null), (c_can, 3, 88.7, 25.6, 98.5, null),
      (c_ayse, 49, 72.5, 34.1, 86.0, 106.0), (c_ayse, 28, 70.9, 33.2, 84.0, 105.0), (c_ayse, 10, 69.8, 32.6, 82.5, 104.0),
      (c_burak, 21, 74.0, 12.5, 78.0, null), (c_burak, 7, 75.1, 12.8, 78.5, null),
      (c_elif, 91, 71.0, 35.0, 90.0, 108.0), (c_elif, 60, 69.8, 34.2, 88.0, 107.0), (c_elif, 30, 68.9, 33.8, 87.0, 106.0), (c_elif, 5, 68.4, 33.5, 86.0, 106.0),
      (c_hakan, 77, 95.2, 30.0, 108.0, null), (c_hakan, 49, 92.9, 29.1, 105.0, null), (c_hakan, 21, 91.1, 28.4, 103.0, null),
      (c_merve, 56, 63.0, 27.0, 74.0, 98.0),
      (c_ozan, 14, 70.5, 11.0, 79.0, null)
    ) as x(client_id, days_ago, kg, fat, waist, hip);

  -- ── Notes ─────────────────────────────────────────────────────────────────
  insert into public.client_notes (owner_id, client_id, body, pinned, created_at) values
    (v_owner, c_zeynep, 'Gece uykusu bölünüyor; kahvaltıyı hazırlanması kolay seçeneklerle kuralım.', true, now() - interval '34 days'),
    (v_owner, c_can, 'Öğle yemekleri iş yerinde; kafeterya menüsünden seçim listesi hazırlandı.', true, now() - interval '60 days'),
    (v_owner, c_can, 'Bel çevresi 5,5 cm azaldı. Akşam atıştırması hâlâ zorluyor.', false, now() - interval '3 days'),
    (v_owner, c_ayse, 'Tatlı isteği ikindi saatinde. Ara öğüne protein eklendi.', true, now() - interval '45 days'),
    (v_owner, c_burak, 'Antrenman sonrası öğün atlanıyor; çantada taşınabilir seçenekler önerildi.', false, now() - interval '7 days'),
    (v_owner, c_elif, 'Kalsiyum ve D vitamini kaynakları konuşuldu; hekim tahlili bekleniyor.', true, now() - interval '30 days'),
    (v_owner, c_hakan, 'Kahvaltıda karbonhidratı azaltınca öğle şekeri daha dengeli.', true, now() - interval '20 days'),
    (v_owner, c_ozan, 'Uzun koşu günü: koşudan 2-3 saat önce kahvaltı, koşu sırasında sıvı planı.', true, now() - interval '12 days');

  -- ── Programs: copies of the demo template for five clients ─────────────────
  if exists (select 1 from public.programs where id = v_template) then
    perform pg_temp.demo_copy_program(v_template, c_ayse, 'İnsülin dengesi — 1. ay', 'active', 20, 1650);
    perform pg_temp.demo_copy_program(v_template, c_can, 'Kalp dostu akdeniz düzeni', 'active', 40, 2000);
    perform pg_temp.demo_copy_program(v_template, c_zeynep, 'Doğum sonrası toparlanma', 'active', 14, 1900);
    perform pg_temp.demo_copy_program(v_template, c_burak, 'Kas kazanımı — antrenman günleri', 'active', 7, 2900);
    perform pg_temp.demo_copy_program(v_template, c_hakan, 'Karbonhidrat dağılımı (taslak)', 'draft', 0, 1800);
    perform pg_temp.demo_copy_program(v_template, c_elif, 'Menopoz döneminde dengeli tabak', 'active', 30, 1700);
  end if;

  -- ── Appointments: a full week, plus some history ──────────────────────────
  insert into public.appointments (owner_id, client_id, starts_at, duration_min, kind, status, note)
  select v_owner, x.client_id, (current_date + x.day_off)::timestamp + x.at - interval '3 hours', x.mins,
         x.kind::public.appointment_kind, x.status::public.appointment_status, x.note
    from (values
      (c_ayse, 0, time '11:00', 45, 'online', 'scheduled', 'Kontrol: tatlı krizleri'),
      (c_can, 0, time '13:30', 30, 'in_person', 'scheduled', null),
      (c_hakan, 0, time '15:00', 45, 'online', 'scheduled', 'Şeker günlüğü üzerinden geçilecek'),
      (c_zeynep, 1, time '09:30', 45, 'online', 'scheduled', null),
      (c_burak, 1, time '18:00', 30, 'in_person', 'scheduled', 'Antrenman günü öğünleri'),
      (c_elif, 2, time '10:30', 45, 'in_person', 'scheduled', null),
      (c_ozan, 2, time '19:00', 30, 'online', 'scheduled', 'Uzun koşu öncesi plan'),
      (c_emre, 3, time '12:00', 45, 'in_person', 'scheduled', null),
      (c_ayse, 3, time '16:30', 30, 'phone', 'scheduled', null),
      (c_can, 4, time '09:00', 45, 'in_person', 'scheduled', null),
      (c_camille, 5, time '11:30', 45, 'online', 'scheduled', null),
      (c_hakan, 6, time '10:00', 30, 'phone', 'scheduled', null),
      (c_zeynep, -1, time '10:00', 45, 'online', 'done', null),
      (c_can, -2, time '13:30', 30, 'in_person', 'done', null),
      (c_merve, -3, time '17:00', 45, 'online', 'cancelled', 'Danışan erteledi'),
      (c_ayse, -7, time '11:00', 45, 'online', 'done', null),
      (c_elif, -9, time '10:30', 45, 'in_person', 'done', null),
      (c_hakan, -14, time '15:00', 45, 'online', 'done', null),
      (c_burak, -7, time '18:00', 30, 'in_person', 'no_show', null),
      (c_can, -21, time '13:30', 30, 'in_person', 'done', null),
      (c_elif, -30, time '10:30', 45, 'in_person', 'done', null)
    ) as x(client_id, day_off, at, mins, kind, status, note);

  -- ── Tasks: overdue, today, this week, shared with clients, done ───────────
  insert into public.tasks (owner_id, client_id, title, due_on, done_at, shared) values
    (v_owner, c_can, 'Lipid tahlili sonucunu iste (demo)', current_date - 2, null, false),
    (v_owner, c_ayse, 'Ara öğün listesini güncelle (demo)', current_date, null, false),
    (v_owner, c_hakan, 'Şeker ölçüm tablosunu kontrol et (demo)', current_date, null, false),
    (v_owner, c_zeynep, 'Emzirme dönemi kalori notunu hekime ilet (demo)', current_date + 1, null, false),
    (v_owner, c_burak, 'Antrenman günleri için alışveriş listesi hazırla (demo)', current_date + 2, null, false),
    (v_owner, c_ozan, 'Yarış haftası menüsünü yaz (demo)', current_date + 5, null, false),
    (v_owner, null, 'Yeni talepleri ara (demo)', current_date, null, false),
    (v_owner, null, 'Ay sonu ödeme listesini kontrol et (demo)', current_date + 3, null, false),
    (v_owner, c_ayse, 'Her gün 8 bardak su (demo)', null, null, true),
    (v_owner, c_can, 'Haftada 3 gün 30 dk yürüyüş (demo)', null, null, true),
    (v_owner, c_hakan, 'Kahvaltı sonrası şeker ölçümünü yaz (demo)', current_date + 1, null, true),
    (v_owner, c_elif, 'Kemik yoğunluğu ölçümü randevusu al (demo)', current_date - 1, null, true),
    (v_owner, c_zeynep, 'İlk kontrol notlarını paylaş (demo)', current_date - 6, now() - interval '5 days', false),
    (v_owner, c_can, 'Kafeterya seçim listesini gönder (demo)', current_date - 20, now() - interval '19 days', false),
    (v_owner, null, 'Sitedeki tarifleri gözden geçir (demo)', current_date - 4, now() - interval '4 days', false);

  -- ── Requests from the site ────────────────────────────────────────────────
  insert into public.leads (owner_id, kind, name, email, phone, message, payload, locale, consent_at, consent_version, status, created_at) values
    (v_owner, 'contact', 'Selin K. (demo)', 'selin.k.demo@example.com', '+905550000021',
     'Merhaba, hamilelikte beslenme danışmanlığı veriyor musunuz?', '{"preferred":"whatsapp"}', 'tr',
     now() - interval '2 hours', 'contact-2026-01', 'new', now() - interval '2 hours'),
    (v_owner, 'wizard', 'Murat (demo)', null, '+905550000022', null,
     '{"goal":"weight_down","activity":"sedentary","habits":["late_eating","snacking","sweet_drinks"],"time":"t30"}', 'tr',
     now() - interval '9 hours', 'wizard-2026-01', 'new', now() - interval '9 hours'),
    (v_owner, 'contact', 'Gizem (demo)', 'gizem.demo@example.com', null,
     'Ofis çalışanları için grup programı yapıyor musunuz? 12 kişilik bir ekibiz.', '{"preferred":"email"}', 'tr',
     now() - interval '1 day 4 hours', 'contact-2026-01', 'new', now() - interval '1 day 4 hours'),
    (v_owner, 'wizard', 'Deniz T. (demo)', null, '+905550000023', null,
     '{"goal":"sport","activity":"active","habits":["irregular","low_water"],"time":"t60"}', 'tr',
     now() - interval '2 days', 'wizard-2026-01', 'new', now() - interval '2 days'),
    (v_owner, 'professional', 'Uzm. Dyt. Can (demo)', 'dyt.can.demo@example.com', null,
     'Sporcu beslenmesi alanında vaka paylaşımı için görüşmek isterim.', '{"profession":"Diyetisyen","organization":"Demo Spor Kulübü"}', 'tr',
     now() - interval '4 days', 'pro-2026-01', 'new', now() - interval '4 days'),
    (v_owner, 'contact', 'Ahmet Y. (demo)', 'ahmet.y.demo@example.com', '+905550000024',
     'Babam için diyabet beslenmesi danışmanlığı almak istiyoruz.', '{"preferred":"phone"}', 'tr',
     now() - interval '8 days', 'contact-2026-01', 'contacted', now() - interval '8 days'),
    (v_owner, 'wizard', 'Ece (demo)', null, '+905550000025', null,
     '{"goal":"regular","activity":"light","habits":["skip_breakfast","eat_out"],"time":"t15"}', 'tr',
     now() - interval '12 days', 'wizard-2026-01', 'contacted', now() - interval '12 days');

  -- ── Packages and payments (fills "Tahsilat" and the clients' billing) ─────
  for r in
    select * from (values
      (c_zeynep, '3 aylık plan (demo)', null::int, 35, 3, 4500.00),
      (c_can, '6 aylık plan (demo)', null::int, 63, 6, 8400.00),
      (c_ayse, '8 seanslık takip (demo)', 8, 49, 2, 4800.00),
      (c_burak, '4 seanslık sporcu paketi (demo)', 4, 21, 1, 3200.00),
      (c_elif, '12 aylık plan (demo)', null::int, 91, 12, 14400.00),
      (c_hakan, '6 aylık plan (demo)', null::int, 77, 6, 8400.00),
      (c_ozan, '4 seanslık sporcu paketi (demo)', 4, 14, 1, 3200.00)
    ) as t(client_id, name, sessions, days_ago, months, total)
  loop
    declare v_pkg uuid := gen_random_uuid(); n int;
    begin
      insert into public.client_packages (id, owner_id, client_id, name, sessions_total, starts_on, ends_on)
      values (v_pkg, v_owner, r.client_id, r.name, r.sessions, current_date - r.days_ago,
              case when r.sessions is null then (current_date - r.days_ago + make_interval(months => r.months) - interval '1 day')::date end);
      -- paid in instalments, one per month so far (at least one)
      for n in 0 .. greatest(0, least(r.months, r.days_ago / 30 + 1) - 1) loop
        insert into public.payments (owner_id, client_id, package_id, amount, currency, paid_on, method, note)
        values (v_owner, r.client_id, v_pkg,
                round(r.total / greatest(1, least(r.months, 3)), 2), 'TRY',
                current_date - r.days_ago + n * 30,
                (array['transfer', 'card', 'cash'])[1 + (n % 3)],
                case when n = 0 then 'İlk ödeme (demo)' end);
      end loop;
    end;
  end loop;

  -- ── Lab results ───────────────────────────────────────────────────────────
  insert into public.lab_results (owner_id, client_id, taken_on, test, value, unit) values
    (v_owner, c_ayse, current_date - 50, 'glucose_fasting', 104, 'mg/dL'),
    (v_owner, c_ayse, current_date - 50, 'insulin_fasting', 19, 'µIU/mL'),
    (v_owner, c_ayse, current_date - 50, 'hba1c', 5.8, '%'),
    (v_owner, c_ayse, current_date - 8, 'glucose_fasting', 96, 'mg/dL'),
    (v_owner, c_ayse, current_date - 8, 'insulin_fasting', 13, 'µIU/mL'),
    (v_owner, c_can, current_date - 65, 'ldl', 172, 'mg/dL'),
    (v_owner, c_can, current_date - 65, 'hdl', 38, 'mg/dL'),
    (v_owner, c_can, current_date - 65, 'triglycerides', 210, 'mg/dL'),
    (v_owner, c_can, current_date - 5, 'ldl', 141, 'mg/dL'),
    (v_owner, c_can, current_date - 5, 'hdl', 42, 'mg/dL'),
    (v_owner, c_can, current_date - 5, 'triglycerides', 168, 'mg/dL'),
    (v_owner, c_hakan, current_date - 80, 'hba1c', 7.6, '%'),
    (v_owner, c_hakan, current_date - 80, 'glucose_fasting', 148, 'mg/dL'),
    (v_owner, c_hakan, current_date - 10, 'hba1c', 6.9, '%'),
    (v_owner, c_hakan, current_date - 10, 'glucose_fasting', 121, 'mg/dL'),
    (v_owner, c_elif, current_date - 32, 'vitamin_d', 18, 'ng/mL');

  -- ── Portal: link the data-only accounts, habits, check-ins, messages ──────
  for r in
    select x.client_id, u.id as user_id, x.days, x.kg, x.trend, x.labels
      from (values
        (c_emre, 'emre@diyetiko.test', 10, 76.0::real, 0.05::real, array['Antrenman sonrası öğün', '3 litre su', 'Uyku 7 saat']),
        (c_mert, 'mert@diyetiko.test', 14, 83.4::real, -0.08::real, array['22:00''den sonra atıştırma yok', 'Öğle yürüyüşü', 'Her öğünde sebze']),
        (c_camille, 'camille@diyetiko.test', 9, 61.0::real, 0.0::real, array['Her öğünde protein', 'Baklagil günde bir kez']),
        (c_zeynep, 'zeynep@diyetiko.test', 12, 69.8::real, -0.06::real, array['Kahvaltı yap', 'Ara öğün hazırla', '2 litre su']),
        (c_can, 'can@diyetiko.test', 14, 89.4::real, -0.06::real, array['Öğle yürüyüşü', 'Akşam atıştırması yok', 'Haftada 2 balık']),
        (c_ayse, 'ayse@diyetiko.test', 13, 70.4::real, -0.05::real, array['İkindi ara öğünü', 'Tatlı yerine meyve', '30 dk yürüyüş', 'Su takibi']),
        (c_burak, 'burak@diyetiko.test', 8, 74.8::real, 0.04::real, array['Antrenman sonrası protein', 'Kahvaltı yap']),
        (c_hakan, 'hakan@diyetiko.test', 12, 91.5::real, -0.04::real, array['Kahvaltı sonrası ölçüm', 'Öğün saatleri', 'Akşam yürüyüşü'])
      ) as x(client_id, email, days, kg, trend, labels)
      join auth.users u on lower(u.email) = x.email
  loop
    update public.clients
       set user_id = r.user_id, portal_consent_at = now() - interval '12 days', portal_consent_version = 'portal-2026-01'
     where id = r.client_id and user_id is null;
    perform pg_temp.demo_checkins(r.client_id, v_owner, r.days, r.kg, r.trend, r.labels);
  end loop;

  -- conversations: unread client messages in several threads keep the inbox badge alive
  perform pg_temp.demo_msg(c_ayse, 'client', 'Merhaba, dün ikindi tatlı krizi geldi, yerine ne yiyebilirim?', 3, time '16:20', true);
  perform pg_temp.demo_msg(c_ayse, 'dietitian', 'Bir avuç çiğ badem ve bir kase yoğurt deneyelim; tarçın da ekleyebilirsin.', 3, time '18:05', true);
  perform pg_temp.demo_msg_ago(c_ayse, 'client', 'Denedim, gerçekten işe yaradı! Bugün de aynısını yaptım.', 96, false);
  perform pg_temp.demo_msg_ago(c_ayse, 'client', 'Bir de hafta sonu doğum günü var, pasta konusunda ne önerirsiniz?', 94, false);

  perform pg_temp.demo_msg(c_can, 'client', 'Tahlil sonuçlarım çıktı, LDL 141 olmuş. Fotoğrafını hekimime de gösterdim.', 1, time '10:45', true);
  perform pg_temp.demo_msg(c_can, 'dietitian', 'Harika gelişme! Perşembe görüşmemizde ayrıntılı bakalım.', 1, time '12:30', true);
  perform pg_temp.demo_msg_ago(c_can, 'client', 'Bu akşam iş yemeği var, menüde ızgara balık ve makarna seçeneği var. Hangisi?', 240, false);

  perform pg_temp.demo_msg(c_zeynep, 'client', 'Gece uykusuz kalınca sabah kahvaltı hazırlayamıyorum, pratik bir öneriniz var mı?', 2, time '08:15', true);
  perform pg_temp.demo_msg(c_zeynep, 'dietitian', 'Akşamdan yulaf kavanozu hazırlayabilirsin: yulaf, yoğurt, meyve. Sabah sadece alıp yersin.', 2, time '09:40', true);
  perform pg_temp.demo_msg_ago(c_zeynep, 'client', 'Yulaf kavanozu çok iyi geldi, teşekkürler!', 380, false);

  perform pg_temp.demo_msg_ago(c_hakan, 'client', 'Bu sabah açlık şekerim 118 çıktı. Kahvaltıda ekmeği yarıya indirdim.', 32, false);
  perform pg_temp.demo_msg_ago(c_hakan, 'client', 'Öğleden sonra yürüyüşe de çıkacağım.', 30, false);

  perform pg_temp.demo_msg(c_burak, 'client', 'Antrenmandan sonra iştahım kapanıyor, yine de yemem gerekiyor mu?', 1, time '20:30', true);
  perform pg_temp.demo_msg(c_burak, 'dietitian', 'Evet; ilk 1-2 saat içinde. Katı yiyemiyorsan süt + muz ile başlayabilirsin.', 1, time '21:10', true);
  perform pg_temp.demo_msg_ago(c_burak, 'client', 'Süt ve muz işe yaradı. Yarın bacak günü, öncesinde ne yiyeyim?', 55, false);

  perform pg_temp.demo_msg(c_mert, 'client', 'Bu hafta 2 kez akşam atıştırması yaptım ama porsiyonu küçük tuttum.', 2, time '22:10', true);
  perform pg_temp.demo_msg(c_mert, 'dietitian', 'Güzel farkındalık. İkindi ara öğününü atlamamak akşamları kolaylaştırır.', 1, time '09:00', true);

  perform pg_temp.demo_msg_ago(c_emre, 'client', 'Pazar günü 15 km koşacağım, sabah ne yemeliyim?', 150, false);

  perform pg_temp.demo_msg(c_camille, 'client', 'Mercimek köftesi tarifini denedim, çok beğendik!', 4, time '19:30', true);
  perform pg_temp.demo_msg(c_camille, 'dietitian', 'Ne güzel! Haftaya nohutlu bir tarif ekleyelim.', 3, time '10:15', true);
end $extra$;
