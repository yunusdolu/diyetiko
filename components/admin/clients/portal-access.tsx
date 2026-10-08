'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useState } from 'react';
import { toast } from 'sonner';
import { createPortalLinkAction, revokePortalAccessAction } from '@/app/admin/_actions/portal';
import type { PortalAccess } from '@/lib/admin/portal';
import { admin } from '@/lib/motion';
import { whatsappHref } from '@/lib/utils';
import type { ClientRow } from '@/types/admin';
import { Badge, Button, Panel, Sheet } from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';

/** Message templates in the CLIENT's language, with raw {name} / {url} placeholders. */
export type InviteText = { invite: string; reset: string };

type Created = { url: string; expiresAt: string; purpose: 'invite' | 'reset' };

/**
 * Portal access for one client: status, invite / reset links (shown once — only a hash is
 * stored), WhatsApp / QR hand-off, and closing access (deletes the login, keeps the records).
 */
export function PortalAccessPanel({
  client,
  access,
  inviteText,
  ready,
}: {
  client: ClientRow;
  access: PortalAccess;
  inviteText: InviteText;
  ready: boolean;
}) {
  const t = useTranslations('admin.portal');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const now = useNow();
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [created, setCreated] = useState<Created | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [revoking, setRevoking] = useState<ActionState>('idle');

  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const tone = access.state === 'active' ? 'ok' : access.state === 'none' ? 'neutral' : 'warn';

  const create = async (purpose: 'invite' | 'reset') => {
    setState('loading');
    const res = await createPortalLinkAction(client.id, purpose);
    if (!res.ok || !res.data) {
      setState('error');
      const key = res.ok ? null : res.error;
      toast.error(
        key && ['noEmail', 'alreadyLinked', 'notLinked', 'notFound'].includes(key)
          ? t(`errors.${key}` as 'errors.noEmail')
          : tc('error'),
      );
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setCreated({ ...res.data, purpose });
    setState('success');
    setTimeout(() => setState('idle'), 900);
    router.refresh();
  };

  const revoke = async () => {
    setRevoking('loading');
    const res = await revokePortalAccessAction(client.id);
    if (!res.ok) {
      setRevoking('error');
      toast.error(tc('error'));
      setTimeout(() => setRevoking('idle'), 900);
      return;
    }
    setRevoking('idle');
    setConfirm(false);
    setCreated(null);
    toast.success(t('revoked'));
    router.refresh();
  };

  return (
    <Panel title={t('title')} action={<Badge tone={tone}>{t(`states.${access.state}`)}</Badge>}>
      <p className="text-[0.875rem] text-a-muted">
        {access.state === 'invited' && access.invite
          ? t('hints.invited', { date: date(access.invite.expiresAt) })
          : access.state === 'active' && access.consentAt
            ? t('hints.active', { date: date(access.consentAt) })
            : t(
                access.state === 'invited'
                  ? 'hints.none'
                  : `hints.${access.state === 'active' ? 'noConsent' : access.state}`,
              )}
      </p>
      {access.linked && (
        <p className="mt-1 text-[0.8125rem] text-a-muted">
          {access.lastActivity
            ? t('lastActivity', { when: format.relativeTime(new Date(access.lastActivity), now) })
            : t('noActivity')}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!access.linked ? (
          <Button
            variant={access.state === 'none' ? 'primary' : 'secondary'}
            state={state}
            onClick={() => create('invite')}
            disabled={!ready || !client.email || Boolean(client.deleted_at)}
          >
            {access.state === 'invited' ? t('newInvite') : t('createInvite')}
          </Button>
        ) : (
          <Button state={state} onClick={() => create('reset')} disabled={!ready}>
            {t('createReset')}
          </Button>
        )}
        {(access.linked || access.state === 'invited') && (
          <Button variant="ghost" className="text-a-danger" onClick={() => setConfirm(true)}>
            {t('revoke')}
          </Button>
        )}
      </div>
      {!ready && (
        <p className="mt-2 text-[0.8125rem] font-semibold text-a-danger">{t('notConfigured')}</p>
      )}
      {ready && !client.email && !access.linked && (
        <p className="mt-2 text-[0.8125rem] font-semibold text-a-danger">{t('errors.noEmail')}</p>
      )}

      <AnimatePresence initial={false}>
        {created && (
          <motion.div
            key={created.url}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: admin.dur }}
            className="overflow-hidden"
          >
            <LinkBox
              created={created}
              client={client}
              inviteText={inviteText}
              onClose={() => setCreated(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet
        open={confirm}
        onOpenChange={setConfirm}
        side="center"
        width="sm"
        title={t('revokeTitle')}
        description={t('revokeBody')}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{tc('cancel')}</Button>
            <Button variant="danger" state={revoking} onClick={revoke}>
              {t('revoke')}
            </Button>
          </>
        }
      >
        <p className="text-[0.875rem] font-semibold">{client.full_name}</p>
      </Sheet>
    </Panel>
  );
}

function LinkBox({
  created,
  client,
  inviteText,
  onClose,
}: {
  created: Created;
  client: ClientRow;
  inviteText: InviteText;
  onClose: () => void;
}) {
  const t = useTranslations('admin.portal');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const [qr, setQr] = useState<string | null>(null);
  const firstName = client.full_name.trim().split(/\s+/)[0] ?? '';
  const message = (created.purpose === 'invite' ? inviteText.invite : inviteText.reset)
    .replace('{name}', firstName)
    .replace('{url}', created.url);
  const phone = client.phone?.replace(/\D/g, '').replace(/^0/, '90') ?? '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.url);
      toast.success(t('copied'));
    } catch {
      toast.error(tc('error'));
    }
  };
  const toggleQr = async () => {
    if (qr) return setQr(null);
    setQr(
      await QRCode.toDataURL(created.url, {
        margin: 1,
        width: 220,
        color: { dark: '#0F1B17', light: '#FBF8F1' },
      }),
    );
  };

  return (
    <div className="mt-4 rounded-[14px] border border-a-text/30 bg-a-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] font-bold">
          {t('linkReady')} · {created.purpose === 'invite' ? t('purposeInvite') : t('purposeReset')}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[0.8125rem] font-semibold text-a-muted hover:text-a-text"
        >
          {tc('close')}
        </button>
      </div>
      <label className="sr-only" htmlFor="portal-link">
        {t('linkReady')}
      </label>
      <input
        id="portal-link"
        readOnly
        value={created.url}
        dir="ltr"
        onFocus={(e) => e.currentTarget.select()}
        className="mt-3 h-10 w-full rounded-[10px] border border-a-border bg-a-surface px-3 num text-[0.8125rem] text-a-text"
      />
      <p className="mt-2 text-[0.75rem] text-a-muted">
        {t('expires', {
          date: format.dateTime(new Date(created.expiresAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
        })}{' '}
        · {t('linkOnce')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={copy}>
          {t('copy')}
        </Button>
        <a
          href={whatsappHref(phone, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center rounded-[10px] border border-a-border px-3 text-[0.8125rem] font-semibold hover:bg-a-surface"
        >
          {t('whatsapp')}
        </a>
        <Button size="sm" onClick={toggleQr}>
          {qr ? t('hideQr') : t('qr')}
        </Button>
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser
        <img
          src={qr}
          alt={t('qr')}
          width={180}
          height={180}
          className="mt-3 rounded-[10px] border border-a-border"
        />
      )}
    </div>
  );
}
