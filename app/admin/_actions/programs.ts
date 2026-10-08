'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as p from '@/lib/admin/programs';
import { requireUser } from '@/lib/auth';
import { locales } from '@/lib/i18n/config';
import { programTreeInput, shareInput } from '@/lib/validators/admin';
import type { ActionResult } from './clients';

const uuid = z.uuid();

const createInput = z.object({
  title: z.string().trim().min(1).max(160),
  clientId: z.uuid().nullable(),
  language: z.enum(locales),
  templateId: z.uuid().nullable(),
  isTemplate: z.boolean(),
});

export async function createProgramAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const d = parsed.data;
  const id = await p.createProgram(user.id, {
    title: d.title,
    clientId: d.clientId,
    language: d.language,
    fromTemplateId: d.templateId,
    isTemplate: d.isTemplate,
  });
  revalidatePath('/admin/programs');
  return { ok: true, data: { id } };
}

export async function saveProgramAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ updatedAt: string }>> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  const parsed = programTreeInput.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.path.join('.') ?? 'invalid' };
  const updatedAt = await p.saveProgramTree(user.id, id, parsed.data);
  return { ok: true, data: { updatedAt } };
}

export async function duplicateProgramAction(
  id: string,
  asTemplate: boolean,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const newId = await p.duplicateProgram(user.id, id, asTemplate);
  revalidatePath('/admin/programs');
  return newId ? { ok: true, data: { id: newId } } : { ok: false };
}

export async function deleteProgramAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await p.deleteProgram(user.id, id);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function snapshotAction(id: string, label: string | null): Promise<ActionResult> {
  const user = await requireUser();
  await p.snapshotProgram(user.id, id, label?.slice(0, 80) ?? null);
  return { ok: true };
}

export async function listVersionsAction(id: string) {
  const user = await requireUser();
  return p.listVersions(user.id, id);
}

export async function getVersionAction(versionId: string) {
  const user = await requireUser();
  if (!uuid.safeParse(versionId).success) return null;
  return p.getVersion(user.id, versionId);
}

const EXPIRY_DAYS = { d7: 7, d30: 30, d90: 90, never: null } as const;

export async function createShareAction(
  raw: unknown,
): Promise<ActionResult<{ link: Awaited<ReturnType<typeof p.createShareLink>> }>> {
  const user = await requireUser();
  const parsed = shareInput.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const link = await p.createShareLink(user.id, parsed.data.programId, {
    days: EXPIRY_DAYS[parsed.data.expiry],
    show_client_name: parsed.data.show_client_name,
    allow_pdf: parsed.data.allow_pdf,
  });
  revalidatePath(`/admin/programs/${parsed.data.programId}`);
  return { ok: true, data: { link } };
}

export async function revokeShareAction(programId: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false };
  await p.revokeShareLink(user.id, id);
  revalidatePath(`/admin/programs/${programId}`);
  return { ok: true };
}

export async function listSharesAction(programId: string) {
  const user = await requireUser();
  return p.listShareLinks(user.id, programId);
}
