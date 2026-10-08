'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as q from '@/lib/admin/portal';
import { requireUser } from '@/lib/auth';
import { deleteAccount } from '@/lib/auth/accounts';
import { createInvite } from '@/lib/portal/invites';
import { rateLimit } from '@/lib/rate-limit';
import type { ActionResult } from './clients';

/*
 * Dietitian actions for the client portal. Everything runs as the dietitian (RLS); the only
 * service-role step is deleting a client's login in lib/auth/accounts.ts (client role only).
 */

const uuid = z.uuid();
const habitLabel = z.string().trim().min(1).max(80);
const messageBody = z.string().trim().min(1).max(2000);

const refresh = (clientId: string) => revalidatePath(`/admin/clients/${clientId}`);

export async function createPortalLinkAction(
  clientId: string,
  purpose: 'invite' | 'reset',
): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success || (purpose !== 'invite' && purpose !== 'reset'))
    return { ok: false };
  const res = await createInvite(user.id, clientId, purpose);
  if (!res.ok) return { ok: false, error: res.error };
  refresh(clientId);
  return { ok: true, data: { url: res.url, expiresAt: res.expiresAt } };
}

/** Closes open links and deletes the client's login. Their records stay with the practice. */
export async function revokePortalAccessAction(clientId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success) return { ok: false };
  const res = await q.closePortalAccess(user.id, clientId);
  if (!res) return { ok: false };
  if (res.userId && !(await deleteAccount(res.userId).catch(() => false)))
    return { ok: false, error: 'failed' };
  refresh(clientId);
  return { ok: true };
}

export async function addHabitAction(clientId: string, label: string): Promise<ActionResult> {
  const user = await requireUser();
  const l = habitLabel.safeParse(label);
  if (!uuid.safeParse(clientId).success || !l.success) return { ok: false, error: 'invalid' };
  await q.addHabit(user.id, clientId, l.data);
  refresh(clientId);
  return { ok: true };
}

export async function updateHabitAction(
  clientId: string,
  id: string,
  patch: { label?: string; active?: boolean },
): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success || !uuid.safeParse(id).success) return { ok: false };
  const p: { label?: string; active?: boolean } = {};
  if (patch.label !== undefined) {
    const l = habitLabel.safeParse(patch.label);
    if (!l.success) return { ok: false, error: 'invalid' };
    p.label = l.data;
  }
  if (typeof patch.active === 'boolean') p.active = patch.active;
  await q.updateHabit(user.id, id, p);
  refresh(clientId);
  return { ok: true };
}

export async function deleteHabitAction(clientId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success || !uuid.safeParse(id).success) return { ok: false };
  await q.deleteHabit(user.id, id);
  refresh(clientId);
  return { ok: true };
}

export async function replyAction(clientId: string, body: string): Promise<ActionResult> {
  const user = await requireUser();
  const b = messageBody.safeParse(body);
  if (!uuid.safeParse(clientId).success || !b.success) return { ok: false, error: 'invalid' };
  if (!(await rateLimit('admin-message', 600, 120))) return { ok: false, error: 'rateLimited' };
  await q.sendMessage(user.id, clientId, b.data);
  refresh(clientId);
  revalidatePath('/admin/messages');
  return { ok: true };
}

export async function markClientReadAction(clientId: string): Promise<void> {
  const user = await requireUser();
  if (!uuid.safeParse(clientId).success) return;
  await q.markRead(user.id, clientId);
  revalidatePath('/admin', 'layout');
}
