import 'server-only';
import { asUser, json, pgArray, type Tx } from '@/lib/db';
import type { ClientInput } from '@/lib/validators/admin';
import type {
  Appointment,
  ClientFile,
  ClientListItem,
  ClientNote,
  ClientRow,
  Lead,
  Measurement,
} from '@/types/admin';

/** Every read/export of client data is recorded (KVKK accountability). */
export async function audit(
  tx: Tx,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null,
  meta: Record<string, unknown> = {},
) {
  await tx.query(
    `insert into audit_log (owner_id, actor_id, action, entity, entity_id, meta) values ($1, $1, $2, $3, $4, $5::jsonb)`,
    [userId, action, entity, entityId, json(meta)],
  );
}

const CLIENT_COLS = `id, full_name, email, phone, birth_date, sex, height_cm, goal, goal_weight_kg, activity_level, allergies,
  medical_notes, preferred_language::text as preferred_language, status::text as status, tags, source, kvkk_consent_at,
  kvkk_consent_version, deleted_at, created_at, updated_at`;

export async function listClients(
  uid: string,
  opts: { deleted?: boolean } = {},
): Promise<ClientListItem[]> {
  return asUser(uid, (tx) =>
    tx.query<ClientListItem>(
      `select c.id, c.full_name, c.email, c.phone, c.status::text as status, c.tags, c.preferred_language::text as preferred_language,
              c.goal, c.goal_weight_kg, c.deleted_at, c.created_at, c.kvkk_consent_at,
              (select max(m.measured_at)::text from measurements m where m.client_id = c.id) as last_measured_at,
              (select m.weight_kg from measurements m where m.client_id = c.id and m.weight_kg is not null order by m.measured_at desc limit 1) as last_weight,
              (select m.weight_kg from measurements m where m.client_id = c.id and m.weight_kg is not null order by m.measured_at asc limit 1) as first_weight,
              (select min(a.starts_at) from appointments a where a.client_id = c.id and a.starts_at > now() and a.status = 'scheduled') as next_appointment,
              -- the card's little chart: the last eight weights, oldest first
              array(select w.weight_kg from (select m.weight_kg, m.measured_at from measurements m
                     where m.client_id = c.id and m.weight_kg is not null order by m.measured_at desc limit 8) w
                    order by w.measured_at) as weights,
              c.user_id is not null as on_portal,
              (select count(*)::int from messages ms where ms.client_id = c.id and ms.author = 'client' and ms.read_at is null) as unread
         from clients c
        where ${opts.deleted ? 'c.deleted_at is not null' : 'c.deleted_at is null'}
        order by c.status = 'active' desc, c.updated_at desc`,
    ),
  );
}

export async function getClient(
  uid: string,
  id: string,
  opts: { audit?: boolean } = {},
): Promise<ClientRow | null> {
  return asUser(uid, async (tx) => {
    const [row] = await tx.query<ClientRow>(`select ${CLIENT_COLS} from clients where id = $1`, [
      id,
    ]);
    if (row && opts.audit !== false) await audit(tx, uid, 'client.view', 'client', id);
    return row ?? null;
  });
}

function clientParams(d: ClientInput) {
  return [
    d.full_name,
    d.email,
    d.phone,
    d.birth_date,
    d.sex,
    d.height_cm,
    d.goal,
    d.goal_weight_kg,
    d.activity_level,
    d.allergies,
    d.medical_notes,
    d.preferred_language,
    d.status,
    pgArray(d.tags),
    d.source,
  ] as const;
}

export async function createClient(uid: string, d: ClientInput): Promise<string> {
  return asUser(uid, async (tx) => {
    const [row] = await tx.query<{ id: string }>(
      `insert into clients (full_name, email, phone, birth_date, sex, height_cm, goal, goal_weight_kg, activity_level, allergies,
                            medical_notes, preferred_language, status, tags, source, kvkk_consent_at, kvkk_consent_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::text[],$15, case when $16 then now() end, case when $16 then 'kvkk-2026-01' end)
       returning id`,
      [...clientParams(d), Boolean(d.record_consent)],
    );
    await audit(tx, uid, 'client.create', 'client', row!.id);
    return row!.id;
  });
}

export async function updateClient(uid: string, id: string, d: ClientInput): Promise<void> {
  await asUser(uid, async (tx) => {
    await tx.query(
      `update clients set full_name=$2, email=$3, phone=$4, birth_date=$5, sex=$6, height_cm=$7, goal=$8, goal_weight_kg=$9,
              activity_level=$10, allergies=$11, medical_notes=$12, preferred_language=$13, status=$14, tags=$15::text[], source=$16,
              kvkk_consent_at = case when $17 and kvkk_consent_at is null then now() else kvkk_consent_at end,
              kvkk_consent_version = case when $17 and kvkk_consent_at is null then 'kvkk-2026-01' else kvkk_consent_version end
        where id = $1`,
      [id, ...clientParams(d), Boolean(d.record_consent)],
    );
    await audit(tx, uid, 'client.update', 'client', id);
  });
}

export async function setClientDeleted(uid: string, id: string, deleted: boolean) {
  await asUser(uid, async (tx) => {
    await tx.query(`update clients set deleted_at = ${deleted ? 'now()' : 'null'} where id = $1`, [
      id,
    ]);
    await audit(tx, uid, deleted ? 'client.archive' : 'client.restore', 'client', id);
  });
}

/** Permanent deletion. Returns storage paths so the caller can remove the files too. */
/**
 * Deletes the client and everything that cascades from it. Returns what lives outside the
 * database — stored files, diary photos and the portal login — so the caller can remove those.
 */
export async function hardDeleteClient(
  uid: string,
  id: string,
): Promise<{ files: string[]; photos: string[]; uploads: string[]; userId: string | null }> {
  return asUser(uid, async (tx) => {
    const files = await tx.query<{ storage_path: string }>(
      `select storage_path from client_files where client_id = $1`,
      [id],
    );
    const photos = await tx.query<{ photo_path: string }>(
      `select photo_path from diary_meals where client_id = $1 and photo_path is not null`,
      [id],
    );
    // files exchanged in messages (absent until the uploads migration is applied)
    const uploads = await tx
      .query<{ file_path: string }>(
        `select file_path from messages where client_id = $1 and file_path is not null`,
        [id],
      )
      .catch(() => [] as { file_path: string }[]);
    const [c] = await tx.query<{ user_id: string | null }>(
      `select user_id from clients where id = $1`,
      [id],
    );
    await tx.query(`delete from clients where id = $1`, [id]);
    await audit(tx, uid, 'client.delete_hard', 'client', id, {
      files: files.length,
      photos: photos.length,
      portal: Boolean(c?.user_id),
    });
    return {
      files: files.map((f) => f.storage_path),
      photos: photos.map((f) => f.photo_path),
      uploads: uploads.map((f) => f.file_path),
      userId: c?.user_id ?? null,
    };
  });
}

export async function listMeasurements(uid: string, clientId: string): Promise<Measurement[]> {
  return asUser(uid, (tx) =>
    tx.query<Measurement>(
      `select * from measurements where client_id = $1 order by measured_at asc`,
      [clientId],
    ),
  );
}

export async function addMeasurement(
  uid: string,
  clientId: string,
  m: Omit<Measurement, 'id' | 'client_id'>,
) {
  await asUser(uid, (tx) =>
    tx.query(
      `insert into measurements (client_id, measured_at, weight_kg, body_fat_pct, muscle_kg, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        clientId,
        m.measured_at,
        m.weight_kg,
        m.body_fat_pct,
        m.muscle_kg,
        m.waist_cm,
        m.hip_cm,
        m.chest_cm,
        m.arm_cm,
        m.thigh_cm,
        m.note,
      ],
    ),
  );
}

export async function deleteMeasurement(uid: string, id: string) {
  await asUser(uid, (tx) => tx.query(`delete from measurements where id = $1`, [id]));
}

export async function listNotes(uid: string, clientId: string): Promise<ClientNote[]> {
  return asUser(uid, (tx) =>
    tx.query<ClientNote>(
      `select id, body, pinned, created_at from client_notes where client_id = $1 order by pinned desc, created_at desc`,
      [clientId],
    ),
  );
}

export async function addNote(uid: string, clientId: string, body: string) {
  await asUser(uid, (tx) =>
    tx.query(`insert into client_notes (client_id, body) values ($1, $2)`, [clientId, body]),
  );
}

export async function setNotePinned(uid: string, id: string, pinned: boolean) {
  await asUser(uid, (tx) =>
    tx.query(`update client_notes set pinned = $2 where id = $1`, [id, pinned]),
  );
}

export async function deleteNote(uid: string, id: string) {
  await asUser(uid, (tx) => tx.query(`delete from client_notes where id = $1`, [id]));
}

export async function listFiles(uid: string, clientId: string): Promise<ClientFile[]> {
  return asUser(uid, (tx) =>
    tx.query<ClientFile>(
      `select id, file_name, mime_type, size_bytes, created_at from client_files where client_id = $1 order by created_at desc`,
      [clientId],
    ),
  );
}

export async function getFile(uid: string, id: string) {
  return asUser(uid, async (tx) => {
    const [row] = await tx.query<{
      id: string;
      client_id: string;
      storage_path: string;
      file_name: string;
      mime_type: string;
    }>(`select id, client_id, storage_path, file_name, mime_type from client_files where id = $1`, [
      id,
    ]);
    if (row) await audit(tx, uid, 'client_file.read', 'client_file', id);
    return row ?? null;
  });
}

export async function insertFile(
  uid: string,
  f: {
    client_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
  },
) {
  await asUser(uid, (tx) =>
    tx.query(
      `insert into client_files (client_id, storage_path, file_name, mime_type, size_bytes) values ($1,$2,$3,$4,$5)`,
      [f.client_id, f.storage_path, f.file_name, f.mime_type, f.size_bytes],
    ),
  );
}

export async function deleteFileRow(uid: string, id: string): Promise<string | null> {
  return asUser(uid, async (tx) => {
    const [row] = await tx.query<{ storage_path: string }>(
      `delete from client_files where id = $1 returning storage_path`,
      [id],
    );
    return row?.storage_path ?? null;
  });
}

export async function listAppointments(
  uid: string,
  opts: { clientId?: string; from?: string; to?: string } = {},
): Promise<Appointment[]> {
  const where: string[] = [];
  const params: (string | null)[] = [];
  if (opts.clientId) {
    params.push(opts.clientId);
    where.push(`a.client_id = $${params.length}`);
  }
  if (opts.from) {
    params.push(opts.from);
    where.push(`a.starts_at >= $${params.length}`);
  }
  if (opts.to) {
    params.push(opts.to);
    where.push(`a.starts_at < $${params.length}`);
  }
  return asUser(uid, (tx) =>
    tx.query<Appointment>(
      `select a.id, a.client_id, c.full_name as client_name, a.lead_id, a.title, a.starts_at, a.duration_min, a.kind::text as kind,
              a.status::text as status, a.note
         from appointments a left join clients c on c.id = a.client_id
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by a.starts_at asc`,
      params,
    ),
  );
}

export async function saveAppointment(
  uid: string,
  id: string | null,
  a: {
    client_id: string | null;
    title: string | null;
    starts_at: string;
    duration_min: number;
    kind: string;
    status: string;
    note: string | null;
  },
) {
  await asUser(uid, (tx) =>
    id
      ? tx.query(
          `update appointments set client_id=$2, title=$3, starts_at=$4, duration_min=$5, kind=$6, status=$7, note=$8 where id=$1`,
          [id, a.client_id, a.title, a.starts_at, a.duration_min, a.kind, a.status, a.note],
        )
      : tx.query(
          `insert into appointments (client_id, title, starts_at, duration_min, kind, status, note) values ($1,$2,$3,$4,$5,$6,$7)`,
          [a.client_id, a.title, a.starts_at, a.duration_min, a.kind, a.status, a.note],
        ),
  );
}

/** A repeating series: the same appointment every `everyDays` days, `count` times in all. */
export async function insertAppointmentSeries(
  uid: string,
  a: Parameters<typeof saveAppointment>[2],
  everyDays: number,
  count: number,
): Promise<void> {
  const first = Date.parse(a.starts_at);
  await asUser(uid, async (tx) => {
    // Istanbul keeps UTC+3 all year: whole days are exact multiples of 24 h
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        tx.query(
          `insert into appointments (client_id, title, starts_at, duration_min, kind, status, note) values ($1,$2,$3,$4,$5,$6,$7)`,
          [
            a.client_id,
            a.title,
            new Date(first + i * everyDays * 864e5).toISOString(),
            a.duration_min,
            a.kind,
            a.status,
            a.note,
          ],
        ),
      ),
    );
  });
}

export async function setAppointmentStatus(
  uid: string,
  id: string,
  status: Appointment['status'],
): Promise<void> {
  await asUser(uid, (tx) =>
    tx.query(`update appointments set status = $2 where id = $1`, [id, status]),
  );
}

export async function deleteAppointment(uid: string, id: string) {
  await asUser(uid, (tx) => tx.query(`delete from appointments where id = $1`, [id]));
}

/**
 * Applications sent before migration …000007 are stored as contact leads, marked in the payload.
 * The payload may still be a JSON string on rows written before the json fix (…000008 repairs
 * them): read it either way.
 */
const PAYLOAD =
  "(case when jsonb_typeof(payload) = 'string' then (payload #>> '{}')::jsonb else payload end)";
const LEAD_KIND = `case when ${PAYLOAD}->>'form' = 'application' then 'application' else kind::text end`;

export async function listLeads(uid: string): Promise<Lead[]> {
  return asUser(uid, (tx) =>
    tx.query<Lead>(
      // applications sent before migration …000007 are stored as contact leads, marked in the payload
      `select id, ${LEAD_KIND} as kind,
              name, email, phone, organization, message, payload, locale::text as locale, consent_at, consent_version,
              status::text as status, converted_client_id, created_at
         from leads order by status = 'new' desc, created_at desc`,
    ),
  );
}

export async function setLeadStatus(uid: string, id: string, status: Lead['status']) {
  await asUser(uid, (tx) => tx.query(`update leads set status = $2 where id = $1`, [id, status]));
}

export async function convertLead(
  uid: string,
  id: string,
  /** application goal keys → words, in the panel's language (the record keeps text, not codes) */
  goalLabel: (key: string) => string = (k) => k,
): Promise<string | null> {
  return asUser(uid, async (tx) => {
    const [lead] = await tx.query<Lead>(
      `select id, name, email, phone, locale::text as locale,
              ${LEAD_KIND} as kind,
              payload, converted_client_id from leads where id = $1`,
      [id],
    );
    if (!lead) return null;
    if (lead.converted_client_id) return lead.converted_client_id;
    // an application already says a lot about the person: carry it into the record
    const a = lead.kind === 'application' ? applicationFacts(lead.payload, goalLabel) : null;
    const [c] = await tx.query<{ id: string }>(
      `insert into clients (full_name, email, phone, preferred_language, source, sex, height_cm, activity_level, allergies, medical_notes, goal)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [
        lead.name,
        lead.email,
        lead.phone,
        lead.locale,
        `lead:${lead.kind}`,
        a?.sex ?? null,
        a?.heightCm ?? null,
        a?.activity ?? null,
        a?.allergies ?? null,
        a?.medical ?? null,
        a?.goal ?? null,
      ],
    );
    if (a?.weightKg != null)
      await tx.query(`insert into measurements (client_id, weight_kg, note) values ($1, $2, $3)`, [
        c!.id,
        a.weightKg,
        'Başvuru formundaki kilo (beyan)',
      ]);
    await tx.query(
      `update leads set status = 'converted', converted_client_id = $2 where id = $1`,
      [id, c!.id],
    );
    await audit(tx, uid, 'lead.convert', 'lead', id, { client: c!.id });
    return c!.id;
  });
}

export interface DashboardData {
  activeClients: number;
  newLeads: number;
  upcoming: Appointment[];
  checkinsDue: { id: string; full_name: string; last: string | null }[];
  /** the last 12 months, oldest first */
  clientsByMonth: { month: string; count: number }[];
  /** the last 12 weeks, oldest first */
  leadsByWeek: { week: string; count: number }[];
  latestLeads: Lead[];
  /** current clients by status */
  clientMix: { status: string; count: number }[];
  /** past appointments by outcome, within the last 30 / 90 / 365 days */
  outcomes: { status: string; d30: number; d90: number; d365: number }[];
}

/** The parts of an application payload that fit the client record (anything odd is dropped). */
function applicationFacts(p: Record<string, unknown>, goalLabel: (key: string) => string) {
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && v >= min && v <= max ? v : null;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  const conditions = Array.isArray(p.conditions)
    ? p.conditions.filter((x): x is string => typeof x === 'string')
    : [];
  const medical = [
    conditions.length ? `Başvuru — sağlık: ${conditions.join(', ')}` : null,
    str(p.medications, 600) ? `İlaç/takviye: ${str(p.medications, 600)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  return {
    sex: p.sex === 'female' || p.sex === 'male' || p.sex === 'other' ? p.sex : null,
    heightCm: num(p.heightCm, 50, 260),
    weightKg: num(p.weightKg, 20, 400),
    activity:
      typeof p.activity === 'string' &&
      ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(p.activity)
        ? p.activity
        : null,
    allergies: str(p.allergies, 2000),
    medical: medical || null,
    goal:
      [str(p.goal, 40) && goalLabel(str(p.goal, 40)!), str(p.goalNote, 600)]
        .filter(Boolean)
        .join(' — ') || null,
  };
}

export async function dashboard(uid: string): Promise<DashboardData> {
  return asUser(uid, async (tx) => {
    // independent queries started together: pipelined on the connection (one round trip)
    const [
      [a],
      [l],
      upcoming,
      checkinsDue,
      clientsByMonth,
      leadsByWeek,
      latestLeads,
      clientMix,
      outcomes,
    ] = await Promise.all([
      tx.query<{ n: number }>(
        `select count(*)::int as n from clients where deleted_at is null and status = 'active'`,
      ),
      tx.query<{ n: number }>(`select count(*)::int as n from leads where status = 'new'`),
      tx.query<Appointment>(
        `select a.id, a.client_id, c.full_name as client_name, a.lead_id, a.title, a.starts_at, a.duration_min, a.kind::text as kind, a.status::text as status, a.note
         from appointments a left join clients c on c.id = a.client_id
        where a.starts_at >= now() and a.starts_at < now() + interval '7 days' and a.status = 'scheduled'
        order by a.starts_at limit 8`,
      ),
      tx.query<{ id: string; full_name: string; last: string | null }>(
        `select c.id, c.full_name, (select max(m.measured_at)::text from measurements m where m.client_id = c.id) as last
         from clients c
        where c.deleted_at is null and c.status = 'active'
          and coalesce((select max(m.measured_at) from measurements m where m.client_id = c.id), c.created_at::date) < current_date - 14
        order by last nulls first limit 8`,
      ),
      tx.query<{ month: string; count: number }>(
        `select to_char(m, 'YYYY-MM') as month,
              (select count(*)::int from clients c where c.deleted_at is null and c.created_at < m + interval '1 month') as count
         from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
        order by m`,
      ),
      tx.query<{ week: string; count: number }>(
        `select to_char(w, 'YYYY-MM-DD') as week,
              (select count(*)::int from leads x where x.created_at >= w and x.created_at < w + interval '7 days') as count
         from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days') w
        order by w`,
      ),
      tx.query<Lead>(
        `select id, ${LEAD_KIND} as kind, name, email, phone, organization, message, payload, locale::text as locale, consent_at, consent_version,
              status::text as status, converted_client_id, created_at
         from leads where status = 'new' order by created_at desc limit 6`,
      ),
      tx.query<{ status: string; count: number }>(
        `select status::text as status, count(*)::int as count from clients
            where deleted_at is null and status <> 'archived' group by status`,
      ),
      tx.query<{ status: string; d30: number; d90: number; d365: number }>(
        `select status::text as status,
                  count(*) filter (where starts_at >= now() - interval '30 days')::int as d30,
                  count(*) filter (where starts_at >= now() - interval '90 days')::int as d90,
                  count(*)::int as d365
             from appointments
            where starts_at < now() and starts_at >= now() - interval '365 days'
              and status in ('done', 'no_show', 'cancelled')
            group by status`,
      ),
    ]);
    return {
      activeClients: a?.n ?? 0,
      newLeads: l?.n ?? 0,
      upcoming,
      checkinsDue,
      clientsByMonth,
      leadsByWeek,
      latestLeads,
      clientMix,
      outcomes,
    };
  });
}

export async function exportClientsCsv(uid: string): Promise<string> {
  return asUser(uid, async (tx) => {
    const rows = await tx.query<Record<string, unknown>>(
      `select full_name, email, phone, birth_date, sex, height_cm, goal_weight_kg, activity_level, preferred_language::text as preferred_language,
              status::text as status, array_to_string(tags, ';') as tags, kvkk_consent_at, created_at
         from clients where deleted_at is null order by full_name`,
    );
    await audit(tx, uid, 'client.export', 'client', null, { rows: rows.length, format: 'csv' });
    const header = Object.keys(rows[0] ?? { full_name: '' });
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      // Prevent CSV formula injection in spreadsheet apps.
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    return [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join(
      '\n',
    );
  });
}

export async function exportClientJson(uid: string, id: string) {
  return asUser(uid, async (tx) => {
    const [client] = await tx.query(`select ${CLIENT_COLS} from clients where id = $1`, [id]);
    if (!client) return null;
    const measurements = await tx.query(
      `select measured_at, weight_kg, body_fat_pct, muscle_kg, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, note from measurements where client_id = $1 order by measured_at`,
      [id],
    );
    const notes = await tx.query(
      `select body, pinned, created_at from client_notes where client_id = $1 order by created_at`,
      [id],
    );
    const appointments = await tx.query(
      `select starts_at, duration_min, kind, status, note from appointments where client_id = $1 order by starts_at`,
      [id],
    );
    const programs = await tx.query(
      `select id, title, language, status, starts_on, updated_at from programs where client_id = $1`,
      [id],
    );
    const files = await tx.query(
      `select file_name, mime_type, size_bytes, created_at from client_files where client_id = $1`,
      [id],
    );
    // client portal: what the client logged themselves (photos are listed, not embedded)
    const habits = await tx.query(
      `select label, active, created_at from client_habits where client_id = $1 order by position, created_at`,
      [id],
    );
    const checkins = await tx.query(
      `select day, weight_kg, water_ml, habits, energy, note, updated_at from checkins where client_id = $1 order by day`,
      [id],
    );
    const diary = await tx.query(
      `select m.eaten_on, m.slot, m.time_label, m.note, m.photo_path is not null as has_photo,
              coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'grams', i.grams, 'unit', i.unit_key, 'qty', i.unit_qty,
                'servings', i.servings, 'kcal', i.kcal, 'protein_g', i.protein_g, 'carb_g', i.carb_g, 'fat_g', i.fat_g)
                order by i.position) filter (where i.id is not null), '[]'::jsonb) as items
         from diary_meals m left join diary_items i on i.meal_id = m.id
        where m.client_id = $1 group by m.id order by m.eaten_on, m.slot`,
      [id],
    );
    const messages = await tx.query(
      `select author, body, created_at, read_at from messages where client_id = $1 order by created_at`,
      [id],
    );
    // the dietitian's tasks about this client (table from migration …000005; may not exist yet)
    const [hasTasks] = await tx.query<{ ok: boolean }>(
      `select to_regclass('public.tasks') is not null as ok`,
    );
    const tasks = hasTasks?.ok
      ? await tx.query(
          `select title, due_on, done_at, created_at from tasks where client_id = $1 order by created_at`,
          [id],
        )
      : [];
    // packages, payments, lab results (migration …000006; may not exist yet)
    const [hasPractice] = await tx.query<{ ok: boolean }>(
      `select to_regclass('public.lab_results') is not null as ok`,
    );
    const [packages, payments, labs] = hasPractice?.ok
      ? await Promise.all([
          tx.query(
            `select name, sessions_total, starts_on::text as starts_on, ends_on::text as ends_on, price, currency, note, closed_at, created_at
               from client_packages where client_id = $1 order by starts_on`,
            [id],
          ),
          tx.query(
            `select amount, currency, paid_on::text as paid_on, method, note, created_at from payments where client_id = $1 order by paid_on`,
            [id],
          ),
          tx.query(
            `select taken_on::text as taken_on, test, value, unit, ref_low, ref_high, note from lab_results where client_id = $1 order by taken_on, test`,
            [id],
          ),
        ])
      : [[], [], []];
    await audit(tx, uid, 'client.export', 'client', id, { format: 'json' });
    return {
      exported_at: new Date().toISOString(),
      client,
      measurements,
      notes,
      appointments,
      programs,
      files,
      tasks,
      packages,
      payments,
      lab_results: labs,
      portal: { habits, checkins, diary, messages },
    };
  });
}

export async function recentAudit(uid: string, entityId?: string) {
  return asUser(uid, (tx) =>
    tx.query<{ action: string; entity: string; created_at: string }>(
      `select action, entity, created_at from audit_log ${entityId ? 'where entity_id = $1' : ''} order by created_at desc limit 20`,
      entityId ? [entityId] : [],
    ),
  );
}
