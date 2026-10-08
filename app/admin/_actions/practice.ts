'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as q from '@/lib/admin/practice';
import { CURRENCIES, PAYMENT_METHODS, parseDecimal } from '@/lib/admin/practice-logic';
import { requireUser } from '@/lib/auth';
import { ISO_DAY } from '@/lib/portal/logic';
import type { ActionResult } from './clients';

/* Packages, payments, lab results (lib/admin/practice.ts). RLS decides what may be touched;
   these only validate the shape. */

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable());
const day = z.string().regex(ISO_DAY);
const optDay = z.preprocess(blank, day.nullable());
/** numbers typed in any panel language ("1.500,50", "1,500.50") */
const decimal = (min: number, max: number) =>
  z.preprocess(
    (v) => (blank(v) == null ? null : (parseDecimal(v) ?? Number.NaN)),
    z.number().min(min).max(max).nullable(),
  );
const uuid = z.uuid();

const packageInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    sessions_total: z.preprocess(blank, z.coerce.number().int().min(1).max(200).nullable()),
    starts_on: day,
    ends_on: optDay,
    price: decimal(0, 9_999_999),
    currency: z.enum(CURRENCIES),
    note: optText(2000),
  })
  .refine((p) => !p.ends_on || p.ends_on >= p.starts_on, { path: ['ends_on'] });

const paymentInput = z.object({
  package_id: z.preprocess(blank, uuid.nullable()),
  amount: decimal(0.01, 9_999_999).refine((v) => v != null),
  currency: z.enum(CURRENCIES),
  paid_on: day,
  method: z.enum(PAYMENT_METHODS),
  note: optText(500),
});

const labRow = z
  .object({
    test: z.string().trim().min(1).max(80),
    value: decimal(0, 999_999).refine((v) => v != null),
    unit: optText(20),
    ref_low: decimal(0, 999_999),
    ref_high: decimal(0, 999_999),
  })
  .refine((r) => r.ref_low == null || r.ref_high == null || r.ref_low <= r.ref_high, {
    path: ['ref_high'],
  });
const labInput = z.object({
  taken_on: day,
  note: optText(500),
  rows: z.array(labRow).min(1).max(40),
});

function errors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[i.path.map(String).join('.') || 'form'] ??= 'invalid';
  return out;
}

function done(clientId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/payments');
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function savePackageAction(
  clientId: string,
  id: string | null,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success || (id && !uuid.safeParse(id).success))
    return { ok: false };
  const parsed = packageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  await q.savePackage(user.id, clientId, id, parsed.data);
  done(clientId);
  return { ok: true };
}

export async function setPackageClosedAction(
  clientId: string,
  id: string,
  closed: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.setPackageClosed(user.id, id, closed);
  done(clientId);
  return { ok: true };
}

export async function deletePackageAction(clientId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.deletePackage(user.id, id);
  done(clientId);
  return { ok: true };
}

export async function addPaymentAction(clientId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success) return { ok: false };
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  await q.addPayment(user.id, clientId, { ...parsed.data, amount: parsed.data.amount! });
  done(clientId);
  return { ok: true };
}

export async function deletePaymentAction(clientId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.deletePayment(user.id, id);
  done(clientId);
  return { ok: true };
}

export async function addLabsAction(clientId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success) return { ok: false };
  const parsed = labInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  await q.addLabs(
    user.id,
    clientId,
    parsed.data.taken_on,
    parsed.data.rows.map((r) => ({ ...r, value: r.value! })),
    parsed.data.note,
  );
  done(clientId);
  return { ok: true };
}

export async function deleteLabAction(clientId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.deleteLab(user.id, id);
  done(clientId);
  return { ok: true };
}
