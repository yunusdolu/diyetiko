import 'server-only';
import { asUser } from '@/lib/db';

/*
 * Columns added by migration …000009_uploads_activity.sql (files in messages, movement in the
 * check-in). Until it has been run on a project, the app must keep working as before: queries ask
 * here which columns exist and select NULLs in their place otherwise. A "yes" is remembered for
 * the life of the process; a "no" is asked again after a minute, so running the migration is
 * picked up without a restart.
 */

export interface SchemaFeatures {
  /** messages.file_path / file_name / file_mime / file_size */
  uploads: boolean;
  /** checkins.activity_min / activity_note */
  activity: boolean;
  /** migration …000010_client_care.sql: tasks.shared, portal_tasks(), portal_billing() */
  care: boolean;
}

let known: SchemaFeatures | null = null;
let askedAt = 0;

export async function schemaFeatures(uid: string): Promise<SchemaFeatures> {
  if (known?.uploads && known.activity && known.care) return known;
  if (known && Date.now() - askedAt < 60_000) return known;
  const rows = await asUser(uid, (tx) =>
    tx.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public'
          and ((table_name = 'messages' and column_name = 'file_path')
            or (table_name = 'checkins' and column_name = 'activity_min')
            or (table_name = 'tasks' and column_name = 'shared'))`,
    ),
  ).catch(() => []);
  known = {
    uploads: rows.some((r) => r.table_name === 'messages'),
    activity: rows.some((r) => r.table_name === 'checkins'),
    care: rows.some((r) => r.table_name === 'tasks'),
  };
  askedAt = Date.now();
  return known;
}

/** message file columns, or NULLs of the same types */
export const messageFileCols = (f: SchemaFeatures, alias = 'm') =>
  f.uploads
    ? `${alias}.file_name, ${alias}.file_mime, ${alias}.file_size`
    : `null::text as file_name, null::text as file_mime, null::integer as file_size`;

/** check-in movement columns, or NULLs of the same types */
export const activityCols = (f: SchemaFeatures) =>
  f.activity
    ? `activity_min, activity_note`
    : `null::smallint as activity_min, null::text as activity_note`;
