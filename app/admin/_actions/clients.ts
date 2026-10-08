'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import * as q from '@/lib/admin/clients';
import { requireUser } from '@/lib/auth';
import { deleteAccount } from '@/lib/auth/accounts';
import { removeObjects } from '@/lib/storage';
import {
  appointmentInput,
  clientInput,
  measurementInput,
  quickClientInput,
} from '@/lib/validators/admin';

export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; fieldErrors?: Record<string, string>; error?: string };

function errors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues)
    out[String(i.path[0] ?? 'form')] ??= i.code === 'too_small' ? 'required' : 'invalid';
  return out;
}

const uuid = z.uuid();

export async function createClientAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = clientInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  const id = await q.createClient(user.id, parsed.data);
  revalidatePath('/admin', 'layout');
  return { ok: true, data: { id } };
}

export async function quickAddClientAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = quickClientInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  const id = await q.createClient(user.id, {
    ...parsed.data,
    birth_date: null,
    sex: null,
    height_cm: null,
    goal: null,
    goal_weight_kg: null,
    activity_level: null,
    allergies: null,
    medical_notes: null,
    status: 'active',
    tags: [],
    source: null,
  });
  revalidatePath('/admin', 'layout');
  return { ok: true, data: { id } };
}

export async function updateClientAction(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'invalid' };
  const parsed = clientInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  await q.updateClient(user.id, id, parsed.data);
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath('/admin/clients');
  return { ok: true };
}

export async function archiveClientAction(id: string, archived: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.setClientDeleted(user.id, id, archived);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function hardDeleteClientAction(
  id: string,
  confirmName: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  const client = await q.getClient(user.id, id, { audit: false });
  if (!client || client.full_name.trim() !== confirmName.trim())
    return { ok: false, error: 'confirm' };
  const gone = await q.hardDeleteClient(user.id, id);
  await removeObjects('client-files', gone.files);
  if (gone.photos.length) await removeObjects('diary-photos', gone.photos).catch(() => undefined);
  if (gone.uploads.length)
    await removeObjects('client-uploads', gone.uploads).catch(() => undefined);
  if (gone.userId) await deleteAccount(gone.userId).catch(() => false);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function addMeasurementAction(clientId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success) return { ok: false };
  const parsed = measurementInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  await q.addMeasurement(user.id, clientId, parsed.data);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function deleteMeasurementAction(clientId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.deleteMeasurement(user.id, id);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function addNoteAction(clientId: string, body: string): Promise<ActionResult> {
  const user = await requireUser();
  const text = z.string().trim().min(1).max(20000).safeParse(body);
  if (!text.success || !uuid.safeParse(clientId).success) return { ok: false, error: 'required' };
  await q.addNote(user.id, clientId, text.data);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function pinNoteAction(
  clientId: string,
  id: string,
  pinned: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  await q.setNotePinned(user.id, id, pinned);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function deleteNoteAction(clientId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  await q.deleteNote(user.id, id);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function deleteFileAction(clientId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  const path = await q.deleteFileRow(user.id, id);
  if (path) await removeObjects('client-files', [path]);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function saveAppointmentAction(
  id: string | null,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = appointmentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: errors(parsed.error) };
  const startsAt = new Date(parsed.data.starts_at);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, fieldErrors: { starts_at: 'invalid' } };
  const appointment = { ...parsed.data, starts_at: startsAt.toISOString() };
  // a new appointment may repeat: every week or every two weeks, up to 12 in all
  const repeat = z
    .object({
      repeat_every: z.coerce.number().pipe(z.union([z.literal(0), z.literal(7), z.literal(14)])),
      repeat_count: z.coerce.number().int().min(1).max(12),
    })
    .safeParse(raw);
  if (!id && repeat.success && repeat.data.repeat_every > 0 && repeat.data.repeat_count > 1)
    await q.insertAppointmentSeries(
      user.id,
      appointment,
      repeat.data.repeat_every,
      repeat.data.repeat_count,
    );
  else await q.saveAppointment(user.id, id, appointment);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function deleteAppointmentAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await q.deleteAppointment(user.id, id);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function setLeadStatusAction(
  id: string,
  status: 'new' | 'contacted' | 'converted' | 'archived',
): Promise<ActionResult> {
  const user = await requireUser();
  await q.setLeadStatus(user.id, id, status);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function convertLeadAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const tg = await getTranslations('admin.leads.app.goals');
  const clientId = await q.convertLead(user.id, id, (k) =>
    tg.has(k as 'energy') ? tg(k as 'energy') : k,
  );
  revalidatePath('/admin', 'layout');
  return clientId ? { ok: true, data: { id: clientId } } : { ok: false };
}
