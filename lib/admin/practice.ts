import 'server-only';
import { asUser, type Tx } from '@/lib/db';
import { audit } from './clients';
import { addDays, todayISO } from '@/lib/portal/logic';
import {
  packageMoney,
  packageState,
  sessionsUsed,
  sumByCurrency,
  type Currency,
  type LabSample,
  type PackageState,
  type PaymentMethod,
} from './practice-logic';

/**
 * Packages, payments and lab results (migration …000006_practice.sql). Every query runs as the
 * dietitian (RLS); the arithmetic lives in practice-logic.ts. Each reader returns `null` while
 * the migration is not applied, so the panel can explain instead of failing.
 */

/** "relation does not exist": the practice migration is not applied yet. */
function missingTable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '42P01';
}
async function orNull<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (e) {
    if (missingTable(e)) return null;
    throw e;
  }
}

export interface PackageRow {
  id: string;
  client_id: string;
  name: string;
  sessions_total: number | null;
  starts_on: string;
  ends_on: string | null;
  price: number | null;
  currency: Currency;
  note: string | null;
  closed_at: string | null;
  created_at: string;
  /** derived */
  used: number;
  paid: number;
  due: number | null;
  state: PackageState;
}

export interface PaymentRow {
  id: string;
  client_id: string;
  package_id: string | null;
  amount: number;
  currency: Currency;
  paid_on: string;
  method: PaymentMethod;
  note: string | null;
}

export interface LabRow extends LabSample {
  id: string;
  note: string | null;
}

export interface Billing {
  packages: PackageRow[];
  payments: PaymentRow[];
  /** payments not tied to a package, per currency */
  loose: { currency: Currency; amount: number }[];
  /** everything still owed on open packages, per currency */
  due: { currency: Currency; amount: number }[];
}

const PKG_COLS = `k.id, k.client_id, k.name, k.sessions_total, k.starts_on::text as starts_on, k.ends_on::text as ends_on,
  k.price, k.currency, k.note, k.closed_at, k.created_at`;
const PAY_COLS = `p.id, p.client_id, p.package_id, p.amount, p.currency, p.paid_on::text as paid_on, p.method, p.note`;
/** the Istanbul calendar day of an attended appointment (UTC+3 all year) */
const ATTENDED = `select client_id, (starts_at + interval '3 hours')::date::text as day
  from appointments where status = 'done' and client_id is not null`;

type RawPackage = Omit<PackageRow, 'used' | 'paid' | 'due' | 'state'>;

function derive(
  packages: RawPackage[],
  payments: PaymentRow[],
  attended: { client_id: string; day: string }[],
  today: string,
): PackageRow[] {
  const byClient = new Map<string, RawPackage[]>();
  for (const p of packages) byClient.set(p.client_id, [...(byClient.get(p.client_id) ?? []), p]);
  const out: PackageRow[] = [];
  for (const [clientId, list] of byClient) {
    const used = sessionsUsed(
      list,
      attended.filter((a) => a.client_id === clientId).map((a) => a.day),
    );
    for (const p of list) {
      const n = used.get(p.id) ?? 0;
      out.push({ ...p, used: n, ...packageMoney(p, payments), state: packageState(p, n, today) });
    }
  }
  return out;
}

async function billingFor(tx: Tx, clientId: string, today: string): Promise<Billing> {
  const [packages, payments, attended] = await Promise.all([
    tx.query<RawPackage>(
      `select ${PKG_COLS} from client_packages k where k.client_id = $1 order by k.starts_on desc, k.created_at desc`,
      [clientId],
    ),
    tx.query<PaymentRow>(
      `select ${PAY_COLS} from payments p where p.client_id = $1 order by p.paid_on desc, p.created_at desc`,
      [clientId],
    ),
    tx.query<{ client_id: string; day: string }>(`${ATTENDED} and client_id = $1`, [clientId]),
  ]);
  const rows = derive(packages, payments, attended, today);
  // keep the query's order (newest first)
  const order = new Map(packages.map((p, i) => [p.id, i]));
  rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return {
    packages: rows,
    payments,
    loose: sumByCurrency(payments.filter((p) => !p.package_id)),
    due: sumByCurrency(
      rows
        .filter((p) => !p.closed_at && p.due)
        .map((p) => ({ amount: p.due!, currency: p.currency })),
    ),
  };
}

export async function clientBilling(
  uid: string,
  clientId: string,
  today = todayISO(),
): Promise<Billing | null> {
  return orNull(() => asUser(uid, (tx) => billingFor(tx, clientId, today)));
}

export interface PracticeMoney {
  /** received this calendar month, per currency */
  month: { currency: Currency; amount: number }[];
  /** received in the previous calendar month, per currency (for the comparison) */
  lastMonth: { currency: Currency; amount: number }[];
  /** still owed on all open packages, per currency */
  due: { currency: Currency; amount: number }[];
  /** packages that need a word with the client: last session/week, used up, or unpaid */
  watch: (PackageRow & { client_name: string })[];
}

/** The dashboard's money card: this month, what is owed, packages running out. */
export async function practiceMoney(
  uid: string,
  today = todayISO(),
): Promise<PracticeMoney | null> {
  const monthStart = `${today.slice(0, 8)}01`;
  const prevStart = `${addDays(monthStart, -1).slice(0, 8)}01`;
  return orNull(() =>
    asUser(uid, async (tx) => {
      const [packages, payments, attended, names] = await Promise.all([
        // open packages, plus ones that ended in the last two weeks (renewal talk)
        tx.query<RawPackage>(
          `select ${PKG_COLS} from client_packages k join clients c on c.id = k.client_id
            where c.deleted_at is null and (k.closed_at is null or k.closed_at > now() - interval '14 days')`,
        ),
        tx.query<PaymentRow & { created_at: string }>(
          `select ${PAY_COLS} from payments p
            where p.paid_on >= $1 or p.package_id in (select id from client_packages where closed_at is null)`,
          [prevStart],
        ),
        tx.query<{ client_id: string; day: string }>(ATTENDED),
        tx.query<{ id: string; full_name: string }>(
          `select id, full_name from clients where deleted_at is null`,
        ),
      ]);
      const name = new Map(names.map((n) => [n.id, n.full_name]));
      // the packages each client still has: a used-up one only matters if nothing newer follows
      const rows = derive(packages, payments, attended, today);
      const newest = new Map<string, string>();
      for (const p of rows)
        if (p.state !== 'upcoming' && (newest.get(p.client_id) ?? '') < p.starts_on)
          newest.set(p.client_id, p.starts_on);
      const watch = rows
        .filter(
          (p) =>
            name.has(p.client_id) &&
            !p.closed_at &&
            (p.state === 'ending' ||
              (p.state === 'done' && newest.get(p.client_id) === p.starts_on) ||
              (p.state !== 'upcoming' && (p.due ?? 0) > 0)),
        )
        .map((p) => ({ ...p, client_name: name.get(p.client_id)! }))
        .sort(
          (a, b) =>
            rank(a) - rank(b) ||
            (b.due ?? 0) - (a.due ?? 0) ||
            a.client_name.localeCompare(b.client_name),
        );
      return {
        month: sumByCurrency(payments.filter((p) => p.paid_on >= monthStart)),
        lastMonth: sumByCurrency(
          payments.filter((p) => p.paid_on >= prevStart && p.paid_on < monthStart),
        ),
        due: sumByCurrency(
          rows
            .filter((p) => !p.closed_at && p.due)
            .map((p) => ({ amount: p.due!, currency: p.currency })),
        ),
        watch,
      };
    }),
  );
}
const rank = (p: PackageRow) => (p.state === 'done' ? 0 : p.state === 'ending' ? 1 : 2);

export interface PackageInput {
  name: string;
  sessions_total: number | null;
  starts_on: string;
  ends_on: string | null;
  price: number | null;
  currency: Currency;
  note: string | null;
}

export async function savePackage(
  uid: string,
  clientId: string,
  id: string | null,
  p: PackageInput,
): Promise<void> {
  const v = [p.name, p.sessions_total, p.starts_on, p.ends_on, p.price, p.currency, p.note];
  await asUser(uid, (tx) =>
    id
      ? tx.query(
          `update client_packages set name=$3, sessions_total=$4, starts_on=$5, ends_on=$6, price=$7, currency=$8, note=$9
            where id=$1 and client_id=$2`,
          [id, clientId, ...v],
        )
      : tx.query(
          `insert into client_packages (client_id, name, sessions_total, starts_on, ends_on, price, currency, note)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [clientId, ...v],
        ),
  );
}

export async function setPackageClosed(uid: string, id: string, closed: boolean): Promise<void> {
  await asUser(uid, (tx) =>
    tx.query(
      `update client_packages set closed_at = case when $2 then coalesce(closed_at, now()) end where id = $1`,
      [id, closed],
    ),
  );
}

export async function deletePackage(uid: string, id: string): Promise<void> {
  await asUser(uid, (tx) => tx.query(`delete from client_packages where id = $1`, [id]));
}

export interface PaymentInput {
  package_id: string | null;
  amount: number;
  currency: Currency;
  paid_on: string;
  method: PaymentMethod;
  note: string | null;
}

export async function addPayment(uid: string, clientId: string, p: PaymentInput): Promise<void> {
  await asUser(uid, (tx) =>
    tx.query(
      `insert into payments (client_id, package_id, amount, currency, paid_on, method, note) values ($1,$2,$3,$4,$5,$6,$7)`,
      [clientId, p.package_id, p.amount, p.currency, p.paid_on, p.method, p.note],
    ),
  );
}

export async function deletePayment(uid: string, id: string): Promise<void> {
  await asUser(uid, (tx) => tx.query(`delete from payments where id = $1`, [id]));
}

// ---- labs --------------------------------------------------------------------------------------

export async function listLabs(uid: string, clientId: string): Promise<LabRow[] | null> {
  return orNull(() =>
    asUser(uid, (tx) =>
      tx.query<LabRow>(
        `select id, test, taken_on::text as taken_on, value, unit, ref_low, ref_high, note
           from lab_results where client_id = $1 order by taken_on, test`,
        [clientId],
      ),
    ),
  );
}

export interface LabInput {
  test: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
}

/** One report: several values drawn on the same day, saved together. */
export async function addLabs(
  uid: string,
  clientId: string,
  takenOn: string,
  rows: LabInput[],
  note: string | null,
): Promise<void> {
  await asUser(uid, async (tx) => {
    await Promise.all(
      rows.map((r) =>
        tx.query(
          `insert into lab_results (client_id, taken_on, test, value, unit, ref_low, ref_high, note)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [clientId, takenOn, r.test, r.value, r.unit, r.ref_low, r.ref_high, note],
        ),
      ),
    );
  });
}

export async function deleteLab(uid: string, id: string): Promise<void> {
  await asUser(uid, (tx) => tx.query(`delete from lab_results where id = $1`, [id]));
}

/** The printable progress report hands the client's data out of the panel: recorded like an export. */
export async function auditReport(uid: string, clientId: string): Promise<void> {
  await asUser(uid, (tx) =>
    audit(tx, uid, 'client.export', 'client', clientId, { format: 'report' }),
  );
}

// ---- the practice's ledger (every client) ------------------------------------------------------

export interface LedgerPayment extends PaymentRow {
  client_name: string;
  package_name: string | null;
}

export interface Ledger {
  /** every payment of every current client, newest first */
  payments: LedgerPayment[];
  /** open packages with something still owed, largest first */
  owed: (PackageRow & { client_name: string })[];
  /** for recording a payment from this page: each client with their open packages */
  clients: { id: string; full_name: string; packages: PackageRow[] }[];
}

/** "Ödemeler": all payments in one list, what is still owed, and who can be paid for. */
export async function practiceLedger(uid: string, today = todayISO()): Promise<Ledger | null> {
  return orNull(() =>
    asUser(uid, async (tx) => {
      const [packages, payments, attended, names] = await Promise.all([
        tx.query<RawPackage>(
          `select ${PKG_COLS} from client_packages k join clients c on c.id = k.client_id
            where c.deleted_at is null order by k.starts_on desc, k.created_at desc`,
        ),
        tx.query<PaymentRow>(
          `select ${PAY_COLS} from payments p join clients c on c.id = p.client_id
            where c.deleted_at is null order by p.paid_on desc, p.created_at desc`,
        ),
        tx.query<{ client_id: string; day: string }>(ATTENDED),
        tx.query<{ id: string; full_name: string }>(
          `select id, full_name from clients where deleted_at is null order by full_name`,
        ),
      ]);
      const name = new Map(names.map((n) => [n.id, n.full_name]));
      const order = new Map(packages.map((p, i) => [p.id, i]));
      const rows = derive(packages, payments, attended, today).sort(
        (a, b) => order.get(a.id)! - order.get(b.id)!,
      );
      const pkgName = new Map(rows.map((p) => [p.id, p.name]));
      return {
        payments: payments.map((p) => ({
          ...p,
          client_name: name.get(p.client_id) ?? '—',
          package_name: p.package_id ? (pkgName.get(p.package_id) ?? null) : null,
        })),
        owed: rows
          .filter((p) => !p.closed_at && (p.due ?? 0) > 0)
          .map((p) => ({ ...p, client_name: name.get(p.client_id) ?? '—' }))
          .sort((a, b) => (b.due ?? 0) - (a.due ?? 0)),
        clients: names.map((n) => ({
          ...n,
          packages: rows.filter((p) => p.client_id === n.id && !p.closed_at),
        })),
      };
    }),
  );
}
