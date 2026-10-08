import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { asService, asUser } from '@/lib/db';
import { env } from '@/lib/env';
import { audit } from '@/lib/admin/clients';
import {
  createClientAccount,
  deleteAccount,
  setAccountPassword,
  type AccountError,
} from '@/lib/auth/accounts';

/** Invite links: 32 random bytes (base64url, 43 chars). Only the SHA-256 is stored. */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const DAYS = { invite: 7, reset: 2 } as const;

export type InvitePurpose = keyof typeof DAYS;

export interface InvitePeek {
  purpose: InvitePurpose;
  clientId: string;
  email: string | null;
  firstName: string;
  locale: 'tr' | 'en' | 'ar' | 'fr';
  userId: string | null;
  expiresAt: string;
}

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

export function inviteUrl(token: string): string {
  return new URL(`/panel/invite/${token}`, env.siteUrl).toString();
}

/**
 * Dietitian side. 'invite' needs an e-mail on the client record and no linked account;
 * 'reset' needs a linked account. Older open links of the client are closed.
 */
export async function createInvite(
  staffId: string,
  clientId: string,
  purpose: InvitePurpose,
): Promise<
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; error: 'noEmail' | 'alreadyLinked' | 'notLinked' | 'notFound' }
> {
  return asUser(staffId, async (tx) => {
    const [client] = await tx.query<{
      email: string | null;
      user_id: string | null;
      deleted_at: string | null;
    }>(`select email, user_id, deleted_at from clients where id = $1`, [clientId]);
    if (!client || client.deleted_at) return { ok: false as const, error: 'notFound' as const };
    if (purpose === 'invite' && !client.email)
      return { ok: false as const, error: 'noEmail' as const };
    if (purpose === 'invite' && client.user_id)
      return { ok: false as const, error: 'alreadyLinked' as const };
    if (purpose === 'reset' && !client.user_id)
      return { ok: false as const, error: 'notLinked' as const };
    await tx.query(`delete from client_invites where client_id = $1 and used_at is null`, [
      clientId,
    ]);
    const token = randomBytes(32).toString('base64url');
    const [row] = await tx.query<{ expires_at: string }>(
      `insert into client_invites (client_id, purpose, token_hash, expires_at)
       values ($1, $2, $3, now() + make_interval(days => $4)) returning expires_at`,
      [clientId, purpose, sha256(token), DAYS[purpose]],
    );
    await audit(
      tx,
      staffId,
      purpose === 'invite' ? 'client.portal_invite' : 'client.portal_reset',
      'client',
      clientId,
    );
    return { ok: true as const, url: inviteUrl(token), expiresAt: row!.expires_at };
  });
}

/** What a link is for — null when unknown, used or expired. */
export async function peekInvite(token: string): Promise<InvitePeek | null> {
  if (!INVITE_TOKEN_RE.test(token)) return null;
  const [row] = await asService((tx) =>
    tx.query<{ p: InvitePeek | null }>(`select peek_client_invite($1) as p`, [sha256(token)]),
  );
  return row?.p ?? null;
}

export type RedeemResult =
  { ok: true; email: string; userId: string } | { ok: false; error: 'invalid' | AccountError };

/**
 * Client side (not signed in yet). Creates the account (invite) or sets a new password (reset),
 * then consumes the link. If linking fails after the account was created, the account is removed.
 */
export async function redeemInvite(
  token: string,
  password: string,
  fullName: string,
): Promise<RedeemResult> {
  const peek = await peekInvite(token);
  if (!peek) return { ok: false, error: 'invalid' };
  const hash = sha256(token);

  if (peek.purpose === 'reset') {
    if (!peek.userId || !peek.email) return { ok: false, error: 'invalid' };
    if (!(await setAccountPassword(peek.userId, password).catch(() => false)))
      return { ok: false, error: 'failed' };
    await asService((tx) => tx.query(`select redeem_client_invite($1)`, [hash]));
    return { ok: true, email: peek.email, userId: peek.userId };
  }

  if (!peek.email) return { ok: false, error: 'invalid' };
  const created = await createClientAccount(peek.email, password, fullName).catch(() => ({
    error: 'failed' as const,
  }));
  if ('error' in created) return { ok: false, error: created.error };
  try {
    await asService((tx) => tx.query(`select redeem_client_invite($1, $2)`, [hash, created.id]));
  } catch {
    await deleteAccount(created.id);
    return { ok: false, error: 'invalid' };
  }
  return { ok: true, email: peek.email, userId: created.id };
}
