import 'server-only';
import { randomBytes } from 'node:crypto';
import { asUser, json, type Tx } from '@/lib/db';
import { fallbackChain, type Locale } from '@/lib/i18n/config';
import { pgArray } from '@/lib/db';
import type { ProgramTreeInput } from '@/lib/validators/admin';
import type {
  FoodOption,
  ProgramDay,
  ProgramMeta,
  ProgramTree,
  RecipeOption,
  ShareLink,
} from '@/types/admin';
import { audit } from './clients';

const META_COLS = `p.id, p.client_id, c.full_name as client_name, p.is_template, p.title, p.language::text as language, p.status::text as status,
  p.starts_on, p.target_kcal, p.target_protein_g, p.target_carb_g, p.target_fat_g, p.notes, p.hydration, p.updated_at`;

export async function listPrograms(
  uid: string,
  opts: { clientId?: string } = {},
): Promise<(ProgramMeta & { day_count: number; link_count: number })[]> {
  return asUser(uid, (tx) =>
    tx.query(
      `select ${META_COLS},
              (select count(*)::int from program_days d where d.program_id = p.id) as day_count,
              (select count(*)::int from share_links s where s.program_id = p.id and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())) as link_count
         from programs p left join clients c on c.id = p.client_id
        ${opts.clientId ? 'where p.client_id = $1' : ''}
        order by p.is_template, p.updated_at desc`,
      opts.clientId ? [opts.clientId] : [],
    ),
  );
}

async function loadTree(tx: Tx, id: string): Promise<ProgramTree | null> {
  const [meta] = await tx.query<ProgramMeta>(
    `select ${META_COLS} from programs p left join clients c on c.id = p.client_id where p.id = $1`,
    [id],
  );
  if (!meta) return null;
  const days = await tx.query<{ id: string; label: string | null }>(
    `select id, label from program_days where program_id = $1 order by position`,
    [id],
  );
  const meals = await tx.query<{
    id: string;
    day_id: string;
    slot: ProgramDay['meals'][number]['slot'];
    time_label: string | null;
    note: string | null;
  }>(
    `select id, day_id, slot::text as slot, time_label, note from program_meals where program_id = $1 order by position`,
    [id],
  );
  const items = await tx.query<ProgramDay['meals'][number]['items'][number] & { meal_id: string }>(
    `select id, meal_id, food_id, recipe_id, name, grams, unit_key, unit_qty, servings, kcal, protein_g, carb_g, fat_g, fiber_g, note
       from program_meal_items where program_id = $1 order by position`,
    [id],
  );
  return {
    ...meta,
    days: days.map((d) => ({
      id: d.id,
      label: d.label,
      meals: meals
        .filter((m) => m.day_id === d.id)
        .map((m) => ({
          id: m.id,
          slot: m.slot,
          time_label: m.time_label,
          note: m.note,
          items: items.filter((i) => i.meal_id === m.id).map(({ meal_id: _m, ...i }) => i),
        })),
    })),
  };
}

export async function getProgramTree(uid: string, id: string): Promise<ProgramTree | null> {
  return asUser(uid, (tx) => loadTree(tx, id));
}

async function writeChildren(tx: Tx, programId: string, days: ProgramTreeInput['days']) {
  await tx.query(`delete from program_days where program_id = $1`, [programId]);
  for (const [di, day] of days.entries()) {
    const [d] = await tx.query<{ id: string }>(
      `insert into program_days (program_id, position, label) values ($1, $2, $3) returning id`,
      [programId, di, day.label],
    );
    for (const [mi, meal] of day.meals.entries()) {
      const [m] = await tx.query<{ id: string }>(
        `insert into program_meals (program_id, day_id, slot, position, time_label, note) values ($1, $2, $3, $4, $5, $6) returning id`,
        [programId, d!.id, meal.slot, mi, meal.time_label, meal.note],
      );
      for (const [ii, it] of meal.items.entries()) {
        await tx.query(
          `insert into program_meal_items (program_id, meal_id, food_id, recipe_id, name, grams, unit_key, unit_qty, servings,
                                           kcal, protein_g, carb_g, fat_g, fiber_g, note, position)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            programId,
            m!.id,
            it.food_id,
            it.recipe_id,
            it.name,
            it.grams,
            it.unit_key,
            it.unit_qty,
            it.servings,
            it.kcal,
            it.protein_g,
            it.carb_g,
            it.fat_g,
            it.fiber_g,
            it.note,
            ii,
          ],
        );
      }
    }
  }
}

const EMPTY_WEEK: ProgramTreeInput['days'] = Array.from({ length: 7 }, (_, i) => ({
  id: `d${i}`,
  label: null,
  meals: (['breakfast', 'lunch', 'snack_pm', 'dinner'] as const).map((slot, j) => ({
    id: `m${i}${j}`,
    slot,
    time_label: null,
    note: null,
    items: [],
  })),
}));

export async function createProgram(
  uid: string,
  opts: {
    title: string;
    clientId: string | null;
    language: Locale;
    fromTemplateId?: string | null;
    isTemplate?: boolean;
  },
): Promise<string> {
  return asUser(uid, async (tx) => {
    const tpl = opts.fromTemplateId ? await loadTree(tx, opts.fromTemplateId) : null;
    const [p] = await tx.query<{ id: string }>(
      `insert into programs (client_id, is_template, title, language, target_kcal, target_protein_g, target_carb_g, target_fat_g, notes, hydration)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        opts.clientId,
        Boolean(opts.isTemplate),
        opts.title,
        opts.language,
        tpl?.target_kcal ?? null,
        tpl?.target_protein_g ?? null,
        tpl?.target_carb_g ?? null,
        tpl?.target_fat_g ?? null,
        tpl?.notes ?? null,
        tpl?.hydration ?? null,
      ],
    );
    await writeChildren(tx, p!.id, tpl?.days.length ? tpl.days : EMPTY_WEEK);
    return p!.id;
  });
}

export async function duplicateProgram(
  uid: string,
  id: string,
  asTemplate: boolean,
): Promise<string | null> {
  return asUser(uid, async (tx) => {
    const src = await loadTree(tx, id);
    if (!src) return null;
    const [p] = await tx.query<{ id: string }>(
      `insert into programs (client_id, is_template, title, language, starts_on, target_kcal, target_protein_g, target_carb_g, target_fat_g, notes, hydration)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [
        asTemplate ? null : src.client_id,
        asTemplate,
        `${src.title} (2)`,
        src.language,
        asTemplate ? null : src.starts_on,
        src.target_kcal,
        src.target_protein_g,
        src.target_carb_g,
        src.target_fat_g,
        src.notes,
        src.hydration,
      ],
    );
    await writeChildren(tx, p!.id, src.days);
    return p!.id;
  });
}

export async function saveProgramTree(
  uid: string,
  id: string,
  t: ProgramTreeInput,
): Promise<string> {
  return asUser(uid, async (tx) => {
    await tx.query(
      `update programs set title=$2, client_id=$3, is_template=$4, language=$5, status=$6, starts_on=$7, target_kcal=$8, target_protein_g=$9,
              target_carb_g=$10, target_fat_g=$11, notes=$12, hydration=$13 where id = $1`,
      [
        id,
        t.title,
        t.client_id,
        t.is_template,
        t.language,
        t.status,
        t.starts_on,
        t.target_kcal,
        t.target_protein_g,
        t.target_carb_g,
        t.target_fat_g,
        t.notes,
        t.hydration,
      ],
    );
    await writeChildren(tx, id, t.days);
    const [row] = await tx.query<{ updated_at: string }>(
      `select updated_at from programs where id = $1`,
      [id],
    );
    return row?.updated_at ?? new Date().toISOString();
  });
}

export async function deleteProgram(uid: string, id: string) {
  await asUser(uid, (tx) => tx.query(`delete from programs where id = $1`, [id]));
}

export async function listVersions(uid: string, programId: string) {
  return asUser(uid, (tx) =>
    tx.query<{ id: string; label: string | null; created_at: string }>(
      `select id, label, created_at from program_versions where program_id = $1 order by created_at desc limit 30`,
      [programId],
    ),
  );
}

export async function snapshotProgram(uid: string, programId: string, label: string | null) {
  await asUser(uid, async (tx) => {
    const tree = await loadTree(tx, programId);
    if (!tree) return;
    await tx.query(
      `insert into program_versions (program_id, label, snapshot) values ($1, $2, $3::jsonb)`,
      [programId, label, json(tree)],
    );
  });
}

export async function getVersion(uid: string, versionId: string): Promise<ProgramTree | null> {
  return asUser(uid, async (tx) => {
    const [row] = await tx.query<{ snapshot: ProgramTree }>(
      `select snapshot from program_versions where id = $1`,
      [versionId],
    );
    return row?.snapshot ?? null;
  });
}

// --------------------------------------------------------------------------- sharing
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function listShareLinks(uid: string, programId: string): Promise<ShareLink[]> {
  return asUser(uid, (tx) =>
    tx.query<ShareLink>(
      `select id, token, expires_at, revoked_at, show_client_name, allow_pdf, view_count, last_viewed_at, created_at
         from share_links where program_id = $1 order by created_at desc`,
      [programId],
    ),
  );
}

export async function createShareLink(
  uid: string,
  programId: string,
  opts: { days: number | null; show_client_name: boolean; allow_pdf: boolean },
): Promise<ShareLink> {
  return asUser(uid, async (tx) => {
    const [row] = await tx.query<ShareLink>(
      `insert into share_links (program_id, token, expires_at, show_client_name, allow_pdf)
       values ($1, $2, case when $3::int is null then null else now() + make_interval(days => $3::int) end, $4, $5)
       returning id, token, expires_at, revoked_at, show_client_name, allow_pdf, view_count, last_viewed_at, created_at`,
      [programId, newToken(), opts.days, opts.show_client_name, opts.allow_pdf],
    );
    await audit(tx, uid, 'program.share', 'program', programId, { link: row!.id });
    return row!;
  });
}

export async function revokeShareLink(uid: string, id: string) {
  await asUser(uid, async (tx) => {
    const [row] = await tx.query<{ program_id: string }>(
      `update share_links set revoked_at = now() where id = $1 and revoked_at is null returning program_id`,
      [id],
    );
    if (row) await audit(tx, uid, 'program.unshare', 'program', row.program_id, { link: id });
  });
}

// --------------------------------------------------------------------------- builder data
export async function foodOptions(uid: string, locale: Locale): Promise<FoodOption[]> {
  const chain = fallbackChain(locale);
  return asUser(uid, (tx) =>
    tx.query<FoodOption>(
      `select f.id, f.key, f.category, f.kcal, f.protein_g, f.carb_g, f.fat_g, f.fiber_g, f.units, f.review_status::text as review_status,
              coalesce((select ft.name from food_translations ft where ft.food_id = f.id and ft.locale = any($1::locale_code[])
                          order by array_position($1::locale_code[], ft.locale) limit 1), f.key) as name
         from foods f order by name`,
      [pgArray(chain)],
    ),
  );
}

export async function recipeOptions(uid: string, locale: Locale): Promise<RecipeOption[]> {
  const chain = fallbackChain(locale);
  return asUser(uid, (tx) =>
    tx.query<RecipeOption>(
      `select r.id, r.kcal, r.protein_g, r.carb_g, r.fat_g, r.fiber_g, r.illustration,
              coalesce((select t.title from recipe_translations t where t.recipe_id = r.id and t.locale = any($1::locale_code[])
                          order by array_position($1::locale_code[], t.locale) limit 1), '—') as title
         from recipes r order by title`,
      [pgArray(chain)],
    ),
  );
}

export async function clientOptions(uid: string) {
  return asUser(uid, (tx) =>
    tx.query<{ id: string; full_name: string; preferred_language: Locale }>(
      `select id, full_name, preferred_language::text as preferred_language from clients where deleted_at is null order by full_name`,
    ),
  );
}
