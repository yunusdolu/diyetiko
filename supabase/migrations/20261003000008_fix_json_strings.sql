-- Repair: JSON values that were stored as a JSON *string* instead of the object or array they
-- hold. The production driver encoded json parameters twice (fixed in lib/db/postgres.ts), so on
-- a live project applications (leads.payload), site settings, food units, programme snapshots
-- and audit details written through the panel became strings like "{\"duration\":\"m6\"}".
-- This unwraps them once. Safe to run again: only rows that are still strings are touched, and
-- only when the string holds an object or array.

update public.leads
   set payload = (payload #>> '{}')::jsonb
 where jsonb_typeof(payload) = 'string' and (payload #>> '{}') ~ '^\s*[\[{]';

update public.site_settings
   set data = (data #>> '{}')::jsonb
 where jsonb_typeof(data) = 'string' and (data #>> '{}') ~ '^\s*[\[{]';

update public.site_setting_translations
   set data = (data #>> '{}')::jsonb
 where jsonb_typeof(data) = 'string' and (data #>> '{}') ~ '^\s*[\[{]';

update public.foods
   set units = (units #>> '{}')::jsonb
 where jsonb_typeof(units) = 'string' and (units #>> '{}') ~ '^\s*[\[{]';

update public.program_versions
   set snapshot = (snapshot #>> '{}')::jsonb
 where jsonb_typeof(snapshot) = 'string' and (snapshot #>> '{}') ~ '^\s*[\[{]';

update public.audit_log
   set meta = (meta #>> '{}')::jsonb
 where jsonb_typeof(meta) = 'string' and (meta #>> '{}') ~ '^\s*[\[{]';
