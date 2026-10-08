'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getPortalStatus, requireClient, signInWithPassword, signOut } from '@/lib/auth';
import { setAccountPassword } from '@/lib/auth/accounts';
import { backend } from '@/lib/env';
import { PORTAL_LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import { peekInvite, redeemInvite } from '@/lib/portal/invites';
import { clampDay, programDayIndex, todayISO } from '@/lib/portal/logic';
import { rateLimit } from '@/lib/rate-limit';
import { removeObjects } from '@/lib/storage';
import {
  checkinPatch,
  diaryAdd,
  isoDay,
  mealPatch,
  mealSlot,
  messageInput,
  password,
} from '@/lib/validators/portal';
import type { Checkin } from '@/types/portal';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const LOCALE_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  httpOnly: false,
};

/** Keep the client's own language choice; otherwise start in the language on their record. */
async function rememberLocale(locale: Locale | undefined) {
  const jar = await cookies();
  if (!isLocale(jar.get(PORTAL_LOCALE_COOKIE)?.value) && locale)
    jar.set(PORTAL_LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTS);
}

/** A diary/check-in day must be today or up to 60 days back (no future, no ancient edits). */
function allowedDay(day: string): boolean {
  const today = todayISO();
  return clampDay(day, today) === day && Date.parse(day) >= Date.parse(today) - 60 * 864e5;
}

// ---------------------------------------------------------------------------
// Sign-in, invites, consent
// ---------------------------------------------------------------------------
const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) });

export type PortalLoginState = { error?: 'invalid' | 'rateLimited' } | undefined;

export async function portalLoginAction(
  _prev: PortalLoginState,
  form: FormData,
): Promise<PortalLoginState> {
  if (!(await rateLimit('portal-login', 900, 10))) return { error: 'rateLimited' };
  const parsed = credentials.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: 'invalid' };
  const res = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (!res.ok) return { error: 'invalid' };
  if (res.role === 'dietitian') redirect(res.mfa ? '/admin/login?step=mfa' : '/admin');
  if (res.role !== 'client') {
    await signOut();
    return { error: 'invalid' };
  }
  const status = await getPortalStatus(res.userId);
  await rememberLocale(status?.locale);
  redirect('/panel');
}

export type InviteState =
  | {
      error?:
        | 'mismatch'
        | 'tooShort'
        | 'consent'
        | 'invalid'
        | 'exists'
        | 'weak'
        | 'failed'
        | 'rateLimited';
    }
  | undefined;

export async function redeemInviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  if (!(await rateLimit('portal-invite', 900, 10))) return { error: 'rateLimited' };
  const token = String(form.get('token') ?? '');
  const pw = String(form.get('password') ?? '');
  const pw2 = String(form.get('confirm') ?? '');
  const peek = await peekInvite(token);
  if (!peek) return { error: 'invalid' };
  if (!password.safeParse(pw).success) return { error: 'tooShort' };
  if (pw !== pw2) return { error: 'mismatch' };
  const consent = form.get('consent') === 'on';
  if (peek.purpose === 'invite' && !consent) return { error: 'consent' };

  const redeemed = await redeemInvite(token, pw, peek.firstName);
  if (!redeemed.ok) return { error: redeemed.error };
  const signedIn = await signInWithPassword(redeemed.email, pw);
  if (!signedIn.ok) return { error: 'failed' };
  if (peek.purpose === 'invite')
    await portal.giveConsent(redeemed.userId, portal.PORTAL_CONSENT_VERSION);
  await rememberLocale(peek.locale);
  redirect('/panel');
}

export type ConsentState = { error?: 'consent' } | undefined;

export async function consentAction(_prev: ConsentState, form: FormData): Promise<ConsentState> {
  const { user } = await requireClient({ consent: false });
  if (form.get('consent') !== 'on') return { error: 'consent' };
  await portal.giveConsent(user.id, portal.PORTAL_CONSENT_VERSION);
  redirect('/panel');
}

export async function portalLogoutAction() {
  await signOut();
  redirect('/panel/login');
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------
export async function saveCheckinAction(day: string, patch: unknown): Promise<Result<Checkin>> {
  const { user, status } = await requireClient();
  const p = checkinPatch.safeParse(patch);
  if (!isoDay.safeParse(day).success || !allowedDay(day) || !p.success)
    return { ok: false, error: 'invalid' };
  try {
    const data = await portal.saveCheckin(user.id, status.clientId, day, p.data);
    revalidatePath('/panel/progress');
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

// ---------------------------------------------------------------------------
// Diary
// ---------------------------------------------------------------------------
function refreshDiary() {
  revalidatePath('/panel');
  revalidatePath('/panel/diary');
}

export async function addDiaryItemsAction(input: unknown): Promise<Result> {
  const { user, status } = await requireClient();
  const d = diaryAdd.safeParse(input);
  if (!d.success || !allowedDay(d.data.day)) return { ok: false, error: 'invalid' };
  try {
    await portal.addDiaryItems(user.id, status.clientId, d.data.day, d.data.slot, d.data.items);
    refreshDiary();
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/** "I ate this": copies the planned meal of that day into the diary. */
export async function logPlannedMealAction(day: string, slot: string): Promise<Result> {
  const { user, status } = await requireClient();
  const s = mealSlot.safeParse(slot);
  if (!isoDay.safeParse(day).success || !allowedDay(day) || !s.success)
    return { ok: false, error: 'invalid' };
  const program = await portal.getProgram(user.id);
  if (!program) return { ok: false, error: 'noProgram' };
  const planned = program.days[programDayIndex(program, day)]?.meals.find((m) => m.slot === s.data);
  if (!planned?.items.length) return { ok: false, error: 'noPlan' };
  const items: portal.NewDiaryItem[] = planned.items.map((i) =>
    i.recipeId
      ? { kind: 'recipe', recipeId: i.recipeId, name: i.name, servings: i.servings ?? 1 }
      : i.foodId && (i.grams || (i.unitKey && i.unitQty))
        ? {
            kind: 'food',
            foodId: i.foodId,
            name: i.name,
            unitKey: i.unitKey,
            unitQty: i.unitKey ? i.unitQty : null,
            grams: i.unitKey ? null : i.grams,
          }
        : { kind: 'free', name: i.name },
  );
  try {
    await portal.addDiaryItems(user.id, status.clientId, day, s.data, items);
    refreshDiary();
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function removeDiaryItemAction(itemId: string): Promise<Result> {
  const { user } = await requireClient();
  if (!z.uuid().safeParse(itemId).success) return { ok: false, error: 'invalid' };
  await portal.removeDiaryItem(user.id, itemId);
  refreshDiary();
  return { ok: true };
}

export async function updateMealAction(input: unknown): Promise<Result> {
  const { user, status } = await requireClient();
  const m = mealPatch.safeParse(input);
  if (!m.success || !allowedDay(m.data.day)) return { ok: false, error: 'invalid' };
  const { day, slot, ...patch } = m.data;
  await portal.updateMeal(user.id, status.clientId, day, slot, patch);
  refreshDiary();
  return { ok: true };
}

export async function removeMealPhotoAction(day: string, slot: string): Promise<Result> {
  const { user, status } = await requireClient();
  const s = mealSlot.safeParse(slot);
  if (!isoDay.safeParse(day).success || !s.success) return { ok: false, error: 'invalid' };
  const { previous } = await portal.setMealPhoto(user.id, status.clientId, day, s.data, null);
  if (previous) await removeObjects('diary-photos', [previous]).catch(() => undefined);
  refreshDiary();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export async function sendMessageAction(input: unknown): Promise<Result> {
  const { user, status } = await requireClient();
  const m = messageInput.safeParse(input);
  if (!m.success) return { ok: false, error: 'invalid' };
  if (!(await rateLimit('portal-message', 600, 20))) return { ok: false, error: 'rateLimited' };
  try {
    await portal.sendMessage(user.id, status.clientId, m.data.body, m.data.diaryMealId);
    revalidatePath('/panel/messages');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function markMessagesReadAction(): Promise<void> {
  const { user } = await requireClient();
  await portal.markMessagesRead(user.id);
  revalidatePath('/panel', 'layout');
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
export async function changePortalPasswordAction(pw: string, pw2: string): Promise<Result> {
  const { user } = await requireClient();
  if (!password.safeParse(pw).success) return { ok: false, error: 'tooShort' };
  if (pw !== pw2) return { ok: false, error: 'mismatch' };
  if (!(await rateLimit('portal-password', 900, 5))) return { ok: false, error: 'rateLimited' };
  if (backend() === 'local') {
    return (await setAccountPassword(user.id, pw)) ? { ok: true } : { ok: false, error: 'failed' };
  }
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  return error ? { ok: false, error: 'failed' } : { ok: true };
}

export async function setPortalLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(PORTAL_LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTS);
  revalidatePath('/panel', 'layout');
}

export async function withdrawConsentAction(): Promise<void> {
  const { user } = await requireClient();
  await portal.withdrawConsent(user.id);
  redirect('/panel/consent');
}

// ---------------------------------------------------------------------------
// Tasks shared by the dietitian
// ---------------------------------------------------------------------------
export async function setPortalTaskDoneAction(id: string, done: boolean): Promise<Result> {
  const { user } = await requireClient();
  if (!/^[0-9a-f-]{36}$/.test(id) || typeof done !== 'boolean')
    return { ok: false, error: 'invalid' };
  try {
    const ok = await portal.setTaskDone(user.id, id, done);
    if (!ok) return { ok: false, error: 'failed' };
    revalidatePath('/panel');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
