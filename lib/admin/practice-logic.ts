/**
 * Practice arithmetic (pure, unit-tested in practice-logic.test.ts): how far a client is into a
 * package, what is still owed, and how a lab value sits against the lab's own reference range.
 * Dates are calendar days ('YYYY-MM-DD', Istanbul), compared as strings.
 */

export const CURRENCIES = ['TRY', 'EUR', 'USD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const PAYMENT_METHODS = ['transfer', 'card', 'cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface PackageBase {
  id: string;
  sessions_total: number | null;
  starts_on: string;
  ends_on: string | null;
  price: number | null;
  currency: Currency;
  closed_at: string | null;
}

export interface PaymentBase {
  package_id: string | null;
  amount: number;
  currency: Currency;
}

/** Days from `a` to `b` (calendar days; negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}

/**
 * Sessions used per package: the client's attended appointments ("done") on or after the
 * package's first day and before the next package of the same client starts (or after its own
 * last day). Every attended session is counted once, by the package it falls into.
 */
export function sessionsUsed(
  packages: Pick<PackageBase, 'id' | 'starts_on' | 'ends_on'>[],
  attendedDays: string[],
): Map<string, number> {
  const sorted = [...packages].sort((a, b) =>
    a.starts_on === b.starts_on ? a.id.localeCompare(b.id) : a.starts_on.localeCompare(b.starts_on),
  );
  const used = new Map(sorted.map((p) => [p.id, 0]));
  for (const day of attendedDays) {
    // the latest package that has started by that day
    let owner: (typeof sorted)[number] | undefined;
    for (const p of sorted) if (p.starts_on <= day) owner = p;
    if (!owner || (owner.ends_on && day > owner.ends_on)) continue;
    used.set(owner.id, (used.get(owner.id) ?? 0) + 1);
  }
  return used;
}

/** What has been paid against a package (in its own currency) and what is still owed. */
export function packageMoney(pkg: PackageBase, payments: PaymentBase[]) {
  const paid = payments
    .filter((p) => p.package_id === pkg.id && p.currency === pkg.currency)
    .reduce((sum, p) => sum + p.amount, 0);
  const due = pkg.price == null ? null : Math.max(0, round2(pkg.price - paid));
  return { paid: round2(paid), due };
}

export type PackageState =
  /** closed by hand, used up, or past its last day */
  | 'done'
  /** one session (or a week) left: time to talk about renewal */
  | 'ending'
  | 'active'
  /** starts later */
  | 'upcoming';

export function packageState(
  pkg: Pick<PackageBase, 'sessions_total' | 'starts_on' | 'ends_on' | 'closed_at'>,
  used: number,
  today: string,
): PackageState {
  if (pkg.closed_at) return 'done';
  if (pkg.starts_on > today) return 'upcoming';
  const left = pkg.sessions_total == null ? null : pkg.sessions_total - used;
  if (left != null && left <= 0) return 'done';
  if (pkg.ends_on && pkg.ends_on < today) return 'done';
  if (left === 1) return 'ending';
  if (pkg.ends_on && daysBetween(today, pkg.ends_on) <= 7) return 'ending';
  return 'active';
}

/** Totals per currency (never adds lira to euros). */
export function sumByCurrency(rows: { amount: number; currency: Currency }[]) {
  const out = new Map<Currency, number>();
  for (const r of rows) out.set(r.currency, round2((out.get(r.currency) ?? 0) + r.amount));
  return [...out.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => CURRENCIES.indexOf(a[0]) - CURRENCIES.indexOf(b[0]))
    .map(([currency, amount]) => ({ currency, amount }));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- labs --------------------------------------------------------------------------------------

/**
 * Common tests a dietitian follows, with the unit Turkish labs usually report them in. Units only:
 * reference ranges differ between labs, so they are always copied from the report itself.
 */
export const LAB_TESTS = [
  { key: 'glucose_fasting', unit: 'mg/dL' },
  { key: 'hba1c', unit: '%' },
  { key: 'insulin_fasting', unit: 'µIU/mL' },
  { key: 'total_cholesterol', unit: 'mg/dL' },
  { key: 'ldl', unit: 'mg/dL' },
  { key: 'hdl', unit: 'mg/dL' },
  { key: 'triglycerides', unit: 'mg/dL' },
  { key: 'tsh', unit: 'mIU/L' },
  { key: 'ft4', unit: 'ng/dL' },
  { key: 'vitamin_b12', unit: 'pg/mL' },
  { key: 'vitamin_d', unit: 'ng/mL' },
  { key: 'ferritin', unit: 'ng/mL' },
  { key: 'iron', unit: 'µg/dL' },
  { key: 'hemoglobin', unit: 'g/dL' },
  { key: 'alt', unit: 'U/L' },
  { key: 'ast', unit: 'U/L' },
  { key: 'creatinine', unit: 'mg/dL' },
  { key: 'uric_acid', unit: 'mg/dL' },
  { key: 'crp', unit: 'mg/L' },
] as const;
export type LabTestKey = (typeof LAB_TESTS)[number]['key'];
export const isLabTestKey = (s: string): s is LabTestKey => LAB_TESTS.some((t) => t.key === s);

export type LabFlag = 'low' | 'high' | 'ok';

/** Where a value sits in the lab's range; null when the report gave no range. */
export function labFlag(value: number, low: number | null, high: number | null): LabFlag | null {
  if (low == null && high == null) return null;
  if (low != null && value < low) return 'low';
  if (high != null && value > high) return 'high';
  return 'ok';
}

export interface LabSample {
  test: string;
  taken_on: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
}

export interface LabSeries {
  test: string;
  unit: string | null;
  /** oldest → newest */
  samples: LabSample[];
  latest: LabSample;
  previous: LabSample | null;
  flag: LabFlag | null;
}

/** One series per test, the app's own tests in their list order first, then the dietitian's. */
export function labSeries(rows: LabSample[]): LabSeries[] {
  const by = new Map<string, LabSample[]>();
  for (const r of rows) by.set(r.test, [...(by.get(r.test) ?? []), r]);
  const order = (t: string) => {
    const i = LAB_TESTS.findIndex((x) => x.key === t);
    return i === -1 ? LAB_TESTS.length : i;
  };
  return [...by.entries()]
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([test, list]) => {
      const samples = [...list].sort((a, b) => a.taken_on.localeCompare(b.taken_on));
      const latest = samples[samples.length - 1]!;
      return {
        test,
        unit: latest.unit,
        samples,
        latest,
        previous: samples.length > 1 ? samples[samples.length - 2]! : null,
        flag: labFlag(latest.value, latest.ref_low, latest.ref_high),
      };
    });
}

/**
 * HOMA-IR from a fasting glucose (mg/dL) and fasting insulin (µIU/mL) drawn the same day:
 * glucose × insulin / 405 (Matthews et al., 1985). Shown as a number only — the cut-off a
 * dietitian applies is theirs to choose.
 */
export function homaIr(rows: LabSample[]): { value: number; taken_on: string } | null {
  const days = new Map<string, { g?: number; i?: number }>();
  for (const r of rows) {
    if (r.test === 'glucose_fasting' && r.unit === 'mg/dL')
      days.set(r.taken_on, { ...days.get(r.taken_on), g: r.value });
    if (r.test === 'insulin_fasting' && r.unit === 'µIU/mL')
      days.set(r.taken_on, { ...days.get(r.taken_on), i: r.value });
  }
  const latest = [...days.entries()]
    .filter(([, v]) => v.g != null && v.i != null)
    .sort(([a], [b]) => b.localeCompare(a))[0];
  if (!latest) return null;
  const [taken_on, { g, i }] = latest;
  return { value: Math.round(((g! * i!) / 405) * 100) / 100, taken_on };
}

/**
 * A number typed by hand, in any of the panel's languages: "1.500,50" (tr), "1,500.50" (en),
 * "1 500,5" (fr), "1500" or "98,5". The separator that comes last is the decimal one; a lone
 * dot or comma followed by exactly three digits in groups ("1.500", "12,000") is a thousands
 * separator. Arabic-Indic digits are read too. Returns null for anything else.
 */
export function parseDecimal(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let s = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫]/g, ',')
    .replace(/[\s  '’]/g, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const dec = lastDot > lastComma ? '.' : ',';
    const group = dec === '.' ? ',' : '.';
    s = s.split(group).join('').replace(dec, '.');
  } else {
    const sep = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : null;
    if (sep) {
      const parts = s.split(sep);
      const grouped = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
      // "1.500" / "12,000" / "1.000.000" are thousands; "98,5" / "1.25" are decimals
      if (
        grouped &&
        (parts.length > 2 || parts[0]!.replace('-', '').length <= 3) &&
        !/^-?0$/.test(parts[0]!)
      )
        s = parts.join('');
      else if (parts.length === 2) s = parts.join('.');
      else return null;
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
