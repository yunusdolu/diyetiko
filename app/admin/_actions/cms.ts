'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as cms from '@/lib/admin/cms';
import { forgetFactors, requireUser } from '@/lib/auth';
import { backend } from '@/lib/env';
import { locales, type Locale } from '@/lib/i18n/config';
import { articleInput, foodInput, recipeInput } from '@/lib/validators/admin';
import type { ActionResult } from './clients';

const uuid = z.uuid();

/** Public pages are statically rendered: purge every locale after content changes. */
function purgePublic() {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/sitemap.xml');
}

function firstIssue(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join('.')}: ${i.message}` : 'invalid';
}

export async function saveRecipeAction(
  id: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (id && !uuid.safeParse(id).success) return { ok: false };
  const parsed = recipeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const rid = await cms.saveRecipe(user.id, id, parsed.data);
    purgePublic();
    revalidatePath('/admin/recipes');
    return { ok: true, data: { id: rid } };
  } catch (e) {
    return { ok: false, error: (e as { code?: string }).code === '23505' ? 'slug' : 'failed' };
  }
}

export async function deleteRecipeAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await cms.deleteRecipe(user.id, id);
  purgePublic();
  revalidatePath('/admin/recipes');
  return { ok: true };
}

export async function saveArticleAction(
  id: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (id && !uuid.safeParse(id).success) return { ok: false };
  const parsed = articleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const aid = await cms.saveArticle(user.id, id, parsed.data);
    purgePublic();
    revalidatePath('/admin/guides');
    return { ok: true, data: { id: aid } };
  } catch (e) {
    return { ok: false, error: (e as { code?: string }).code === '23505' ? 'slug' : 'failed' };
  }
}

export async function deleteArticleAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await cms.deleteArticle(user.id, id);
  purgePublic();
  revalidatePath('/admin/guides');
  return { ok: true };
}

export async function saveFoodAction(
  id: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = foodInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const fid = await cms.saveFood(user.id, id, parsed.data);
    purgePublic();
    revalidatePath('/admin/foods');
    return { ok: true, data: { id: fid } };
  } catch (e) {
    return { ok: false, error: (e as { code?: string }).code === '23505' ? 'key' : 'failed' };
  }
}

export async function deleteFoodAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const ok = await cms.deleteFood(user.id, id);
  revalidatePath('/admin/foods');
  return ok ? { ok: true } : { ok: false, error: 'inUse' };
}

const contactSchema = z.object({
  phoneE164: z.string().regex(/^\+[0-9]{8,15}$/),
  phoneDisplay: z.string().max(40),
  whatsapp: z.string().regex(/^[0-9]{8,15}$/),
  instagram: z.string().regex(/^[A-Za-z0-9._]{1,30}$/),
  email: z.union([z.literal(''), z.email()]).transform((v) => v || null),
  address: z
    .string()
    .max(400)
    .transform((v) => v.trim() || null),
});

export async function saveContactAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await cms.saveSetting(user.id, 'contact', parsed.data);
  purgePublic();
  return { ok: true };
}

export async function saveImagesAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({
      portrait: z.string().max(300).nullable(),
      logo: z.string().max(300).nullable(),
      og: z.string().max(300).nullable(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false };
  await cms.saveSetting(user.id, 'images', parsed.data);
  purgePublic();
  return { ok: true };
}

const localizedSchemas = {
  hero: z.object({ lines: z.array(z.string().max(60)).max(4), lead: z.string().max(400) }),
  about: z.object({ bio: z.string().max(6000) }),
  credentials: z.object({ items: z.array(z.string().max(300)).max(30) }),
  faq: z.object({
    items: z.array(z.object({ q: z.string().max(300), a: z.string().max(2000) })).max(20),
  }),
} as const;

export async function saveLocalizedAction(
  key: keyof typeof localizedSchemas,
  locale: Locale,
  raw: unknown,
  status: 'draft' | 'needs_review' | 'reviewed',
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(locales as readonly string[]).includes(locale) || !(key in localizedSchemas))
    return { ok: false };
  const parsed = localizedSchemas[key].safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await cms.saveLocalizedSetting(
    user.id,
    key,
    locale,
    parsed.data as Record<string, unknown>,
    status,
  );
  purgePublic();
  return { ok: true };
}

export async function saveProfileAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({
      full_name: z.string().max(160),
      admin_locale: z.enum(locales),
      arabic_digits: z.enum(['latn', 'arab']),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false };
  await cms.saveProfile(user.id, parsed.data);
  purgePublic();
  return { ok: true };
}

export async function changePasswordAction(password: string): Promise<ActionResult> {
  const user = await requireUser();
  if (password.length < 10 || password.length > 200) return { ok: false, error: 'length' };
  if (backend() === 'local') {
    const { hashPassword } = await import('@/lib/db/pglite');
    const { asService } = await import('@/lib/db');
    // Local mode keeps its stand-in auth table; service role writes it.
    await asService((tx) =>
      tx.query(`update auth.users set encrypted_password = $2 where id = $1`, [
        user.id,
        hashPassword(password),
      ]),
    );
    return { ok: true };
  }
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, error: 'failed' } : { ok: true };
}

/** Supabase TOTP enrolment: returns the QR (SVG data URI) to scan, then verify. */
export async function enrollMfaAction(): Promise<
  ActionResult<{ factorId: string; qr: string; secret: string }>
> {
  await requireUser();
  if (backend() !== 'supabase') return { ok: false, error: 'unavailable' };
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) return { ok: false, error: 'failed' };
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyMfaEnrollmentAction(
  factorId: string,
  code: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (backend() !== 'supabase' || !/^\d{6}$/.test(code)) return { ok: false };
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId });
  if (e1 || !ch) return { ok: false };
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
  if (error) return { ok: false };
  // the next page must ask for the second step: drop the remembered "no factor" answer
  forgetFactors(user.id);
  return { ok: true };
}
