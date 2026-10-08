/** Normalise Postgres output so both drivers return identical JS values. */
export const OID = {
  int8: 20,
  json: 114,
  date: 1082,
  timestamp: 1114,
  timestamptz: 1184,
  numeric: 1700,
  jsonb: 3802,
} as const;

export function parseTimestamp(value: string): string {
  // Session TimeZone is UTC, DateStyle ISO: "2026-09-28 16:26:00.123+00"
  const iso = value.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

export const identity = (value: string) => value;
export const toNumber = (value: string) => Number(value);

/**
 * json / jsonb parameters. Callers already pass text made by `json()`; postgres.js would run
 * JSON.stringify over it once more and store a JSON *string* instead of the object (the bug
 * that left applications, settings and audit details unreadable). Text goes through as it is.
 */
export const serializeJson = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

/**
 * json / jsonb results. Values written before the fix above are JSON strings that hold an
 * object or array: unwrap them once, so old rows read like new ones.
 */
export function parseJson(value: string): unknown {
  const v: unknown = JSON.parse(value);
  if (typeof v === 'string' && /^\s*[[{]/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}
