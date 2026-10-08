'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as q from '@/lib/admin/insights';
import { setAppointmentStatus } from '@/lib/admin/clients';
import { requireUser } from '@/lib/auth';
import { ISO_DAY } from '@/lib/portal/logic';
import type { ActionResult } from './clients';

const taskInput = z.object({
  title: z.string().trim().min(1).max(200),
  due_on: z.string().regex(ISO_DAY).nullable(),
  client_id: z.uuid().nullable(),
  shared: z.boolean().optional(),
});
const uuid = z.uuid();
const day = z.string().regex(ISO_DAY).nullable();

function done(clientId?: string | null) {
  revalidatePath('/admin');
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
}

export async function addTaskAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = taskInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: { title: 'required' } };
  await q.addTask(user.id, parsed.data);
  done(parsed.data.client_id);
  return { ok: true };
}

export async function setTaskDoneAction(
  id: string,
  isDone: boolean,
  clientId?: string | null,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.setTaskDone(user.id, id, isDone);
  done(clientId);
  return { ok: true };
}

export async function setTaskDueAction(
  id: string,
  due: string | null,
  clientId?: string | null,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success || !day.safeParse(due).success) return { ok: false };
  await q.setTaskDue(user.id, id, due);
  done(clientId);
  return { ok: true };
}

export async function deleteTaskAction(
  id: string,
  clientId?: string | null,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await q.deleteTask(user.id, id);
  done(clientId);
  return { ok: true };
}

const statuses = z.enum(['scheduled', 'done', 'cancelled', 'no_show']);

/** One-tap status from the dashboard's agenda ("came", "did not come"). */
export async function setAppointmentStatusAction(
  id: string,
  status: z.infer<typeof statuses>,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success || !statuses.safeParse(status).success) return { ok: false };
  await setAppointmentStatus(user.id, id, status);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
