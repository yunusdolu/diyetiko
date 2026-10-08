'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  createShareAction,
  listSharesAction,
  revokeShareAction,
} from '@/app/admin/_actions/programs';
import { admin } from '@/lib/motion';
import { cn, whatsappHref } from '@/lib/utils';
import type { ShareLink } from '@/types/admin';
import { Badge, Button, Sheet } from '@/components/admin/ui';
import { Switch } from '@/components/ui/checkbox';
import { Tabs } from '@/components/ui/tabs';
import type { ActionState } from '@/components/ui/status-icon';

/** Localised in the PROGRAMME's language (the client reads it), not the admin UI language. */
export type ShareStrings = { messageTemplate: string; subject: string };

type Expiry = 'd7' | 'd30' | 'd90' | 'never';

export function ShareSheet({
  open,
  onOpenChange,
  programId,
  strings,
  clientFirstName,
  clientPhone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  programId: string;
  strings: ShareStrings;
  clientFirstName: string | null;
  clientPhone: string | null;
}) {
  const t = useTranslations('admin.share');
  const format = useFormatter();
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [expiry, setExpiry] = useState<Expiry>('d30');
  const [showName, setShowName] = useState(false);
  const [allowPdf, setAllowPdf] = useState(true);
  const [state, setState] = useState<ActionState>('idle');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listSharesAction(programId).then((l) => alive && setLinks(l));
    return () => {
      alive = false;
    };
  }, [open, programId]);

  const create = async () => {
    setState('loading');
    const res = await createShareAction({
      programId,
      expiry,
      show_client_name: showName,
      allow_pdf: allowPdf,
    });
    if (!res.ok || !res.data) {
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    setLinks((l) => [res.data!.link, ...(l ?? [])]);
    await navigator.clipboard
      ?.writeText(`${window.location.origin}/p/${res.data.link.token}`)
      .catch(() => undefined);
    toast.success(t('copied'));
    setTimeout(() => setState('idle'), 1200);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('safety')}
      width="md"
    >
      <section className="rounded-[16px] border border-a-border p-4">
        <p className="mb-2 text-[0.8125rem] font-semibold">{t('expiry')}</p>
        <Tabs
          label={t('expiry')}
          value={expiry}
          onChange={setExpiry}
          items={(['d7', 'd30', 'd90', 'never'] as const).map((e) => ({
            value: e,
            label: t(`expiries.${e}`),
          }))}
        />
        <div className="mt-4 space-y-4">
          <Switch
            checked={showName}
            onCheckedChange={setShowName}
            label={t('showName')}
            description={t('showNameHint')}
          />
          <Switch checked={allowPdf} onCheckedChange={setAllowPdf} label={t('allowPdf')} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" state={state} onClick={create}>
            {t('create')}
          </Button>
        </div>
      </section>

      <h3 className="mt-6 mb-3 text-[0.8125rem] font-bold tracking-[0.08em] text-a-muted uppercase">
        {t('links')}
      </h3>
      {links === null ? (
        <p className="text-[0.875rem] text-a-muted">…</p>
      ) : !links.length ? (
        <p className="text-[0.875rem] text-a-muted">{t('noLinks')}</p>
      ) : (
        <motion.ul layout className="space-y-3">
          <AnimatePresence initial={false}>
            {links.map((l) => (
              <LinkRow
                key={l.id}
                link={l}
                programId={programId}
                strings={strings}
                clientFirstName={clientFirstName}
                clientPhone={clientPhone}
                onRevoked={() =>
                  setLinks((ls) =>
                    (ls ?? []).map((x) =>
                      x.id === l.id ? { ...x, revoked_at: new Date().toISOString() } : x,
                    ),
                  )
                }
                format={format}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </Sheet>
  );
}

function LinkRow({
  link,
  programId,
  strings,
  clientFirstName,
  clientPhone,
  onRevoked,
  format,
}: {
  link: ShareLink;
  programId: string;
  strings: ShareStrings;
  clientFirstName: string | null;
  clientPhone: string | null;
  onRevoked: () => void;
  format: ReturnType<typeof useFormatter>;
}) {
  const t = useTranslations('admin.share');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === 'undefined'
      ? `/p/${link.token}`
      : `${window.location.origin}/p/${link.token}`;
  const expired = link.expires_at != null && new Date(link.expires_at) < new Date();
  const dead = Boolean(link.revoked_at) || expired;
  const message = strings.messageTemplate
    .replace('{name}', link.show_client_name && clientFirstName ? ` ${clientFirstName}` : '')
    .replace('{url}', url);
  const phone = clientPhone?.replace(/\D/g, '').replace(/^0/, '90') ?? '';

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setCopied(false), 1400);
  };
  const toggleQr = async () => {
    if (qr) return setQr(null);
    setQr(
      await QRCode.toDataURL(url, {
        margin: 1,
        width: 220,
        color: { dark: '#0F1B17', light: '#FBF8F1' },
      }),
    );
  };
  const nativeShare = async () => {
    if (navigator.share)
      await navigator
        .share({ title: strings.subject, text: message.replace(url, '').trim(), url })
        .catch(() => undefined);
    else await copy();
  };
  const revoke = async () => {
    const res = await revokeShareAction(programId, link.id);
    if (res.ok) {
      toast.success(t('revoked'));
      onRevoked();
    }
  };

  const action =
    'inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-a-border px-2.5 text-[0.75rem] font-semibold transition-colors hover:bg-a-surface-2 disabled:pointer-events-none disabled:opacity-40';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: admin.dur }}
      className={cn('rounded-[14px] border border-a-border p-4', dead && 'opacity-60')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Badge tone={link.revoked_at ? 'danger' : expired ? 'warn' : 'ok'}>
            {link.revoked_at
              ? t('revokedAt', {
                  date: format.dateTime(new Date(link.revoked_at), { dateStyle: 'short' }),
                })
              : expired
                ? t('expired')
                : t('active')}
          </Badge>
          <span className="text-[0.75rem] text-a-muted">
            {link.expires_at
              ? t('expiresAt', {
                  date: format.dateTime(new Date(link.expires_at), { dateStyle: 'medium' }),
                })
              : t('noExpiry')}
          </span>
        </span>
        <span className="num text-[0.75rem] text-a-muted">
          {t('views', { count: link.view_count })}
          {link.last_viewed_at &&
            ` · ${t('lastViewed', { date: format.relativeTime(new Date(link.last_viewed_at)) })}`}
        </span>
      </div>
      <p
        className="mt-3 truncate rounded-[8px] bg-a-bg px-3 py-2 num text-[0.75rem]"
        dir="ltr"
        title={url}
      >
        {url}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={dead} onClick={copy} className={action}>
          {copied ? t('copied') : t('copy')}
        </button>
        <a
          aria-disabled={dead}
          className={cn(action, dead && 'pointer-events-none opacity-40')}
          href={
            phone
              ? whatsappHref(phone, message)
              : `https://wa.me/?text=${encodeURIComponent(message)}`
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('whatsapp')}
        </a>
        <a
          aria-disabled={dead}
          className={cn(action, dead && 'pointer-events-none opacity-40')}
          href={`mailto:?subject=${encodeURIComponent(strings.subject)}&body=${encodeURIComponent(message)}`}
        >
          {t('email')}
        </a>
        <button type="button" disabled={dead} onClick={nativeShare} className={action}>
          {t('native')}
        </button>
        <button
          type="button"
          disabled={dead}
          onClick={toggleQr}
          aria-expanded={Boolean(qr)}
          className={action}
        >
          {t('qr')}
        </button>
        {!link.revoked_at && (
          <button type="button" onClick={revoke} className={cn(action, 'ms-auto text-a-danger')}>
            {t('revoke')}
          </button>
        )}
      </div>
      <AnimatePresence>
        {qr && !dead && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: admin.dur }}
            className="overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={t('qr')} width={220} height={220} className="mt-3 rounded-[10px]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
