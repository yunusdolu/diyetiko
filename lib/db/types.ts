export type Param = string | number | boolean | null;
export type Row = Record<string, unknown>;

export interface Tx {
  query<T = Row>(text: string, params?: readonly Param[]): Promise<T[]>;
}

export type DbRole = 'anon' | 'authenticated' | 'service_role';

export interface Driver {
  run<T>(role: DbRole, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Postgres array literal for text[] params (drivers disagree on JS array serialisation). */
export function pgArray(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
}

export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}
