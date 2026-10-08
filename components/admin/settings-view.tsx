'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  changePasswordAction,
  enrollMfaAction,
  saveContactAction,
  saveImagesAction,
  saveLocalizedAction,
  saveProfileAction,
  verifyMfaEnrollmentAction,
} from '@/app/admin/_actions/cms';
import { setAdminPreference } from '@/app/admin/_actions/auth';
import type { SettingsBundle } from '@/lib/admin/cms';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Input,
  Label,
  PageTitle,
  Panel,
  Select,
  Textarea,
} from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';
import { MediaUpload } from './cms/media-upload';
import { statusTone } from './cms/cms-list';

type Contact = {
  phoneE164: string;
  phoneDisplay: string;
  whatsapp: string;
  instagram: string;
  email: string | null;
  address: string | null;
};
type Images = { portrait: string | null; logo: string | null; og: string | null };
type Defaults = Record<
  Locale,
  { heroLines: string[]; heroLead: string; faq: { q: string; a: string }[] }
>;

function useSaver() {
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setState('loading');
    const res = await fn();
    if (!res.ok) {
      setState('error');
      toast.error(res.error ?? tc('error'));
      setTimeout(() => setState('idle'), 900);
      return false;
    }
    setState('success');
    toast.success(tc('saved'));
    router.refresh();
    setTimeout(() => setState('idle'), 900);
    return true;
  };
  return { state, run };
}

function SaveRow({ state, onClick }: { state: ActionState; onClick: () => void }) {
  const tc = useTranslations('admin.common');
  return (
    <div className="mt-5 flex justify-end">
      <Button variant="primary" state={state} onClick={onClick}>
        {tc('save')}
      </Button>
    </div>
  );
}

export function SettingsView({
  settings,
  contact,
  images,
  defaults,
  supabase,
}: {
  settings: SettingsBundle;
  contact: Contact;
  images: Images;
  defaults: Defaults;
  supabase: boolean;
}) {
  const t = useTranslations('admin.settings');
  return (
    <div className="space-y-5">
      <PageTitle title={t('title')} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ProfilePanel profile={settings.profile} />
        <ContactPanel contact={contact} />
      </div>
      <SiteContent settings={settings} defaults={defaults} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ImagesPanel images={images} />
        <SecurityPanel supabase={supabase} />
      </div>
    </div>
  );
}

function ProfilePanel({ profile }: { profile: SettingsBundle['profile'] }) {
  const t = useTranslations('admin.settings');
  const [p, setP] = useState(profile);
  const { state, run } = useSaver();
  return (
    <Panel title={t('profile')}>
      <div className="grid gap-4">
        <Input
          label={t('fullName')}
          value={p.full_name}
          onChange={(e) => setP({ ...p, full_name: e.target.value })}
        />
        <Select
          label={t('adminLanguage')}
          value={p.admin_locale}
          onChange={(e) => setP({ ...p, admin_locale: e.target.value as Locale })}
          options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
        />
        <Select
          label={t('arabicDigits')}
          value={p.arabic_digits}
          onChange={(e) => setP({ ...p, arabic_digits: e.target.value as 'latn' | 'arab' })}
          options={(['latn', 'arab'] as const).map((d) => ({
            value: d,
            label: t(`arabicDigitsOptions.${d}`),
          }))}
        />
      </div>
      <SaveRow
        state={state}
        onClick={() =>
          run(async () => {
            const res = await saveProfileAction(p);
            if (res.ok) await setAdminPreference('locale', p.admin_locale);
            return res;
          })
        }
      />
    </Panel>
  );
}

function ContactPanel({ contact }: { contact: Contact }) {
  const t = useTranslations('admin.settings');
  const tf = useTranslations('form');
  const [c, setC] = useState({
    ...contact,
    email: contact.email ?? '',
    address: contact.address ?? '',
  });
  const { state, run } = useSaver();
  return (
    <Panel title={t('contactInfo')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={`${tf('phone')} (E.164)`}
          dir="ltr"
          value={c.phoneE164}
          onChange={(e) => setC({ ...c, phoneE164: e.target.value })}
        />
        <Input
          label={tf('phone')}
          dir="ltr"
          value={c.phoneDisplay}
          onChange={(e) => setC({ ...c, phoneDisplay: e.target.value })}
        />
        <Input
          label="WhatsApp"
          dir="ltr"
          hint={t('whatsappHint')}
          placeholder="905XXXXXXXXX"
          value={c.whatsapp}
          onChange={(e) => setC({ ...c, whatsapp: e.target.value.replace(/\D/g, '') })}
        />
        <Input
          label="Instagram"
          dir="ltr"
          value={c.instagram}
          onChange={(e) => setC({ ...c, instagram: e.target.value.replace(/^@/, '') })}
        />
        <Input
          label={tf('email')}
          type="email"
          dir="ltr"
          value={c.email}
          onChange={(e) => setC({ ...c, email: e.target.value })}
          className="sm:col-span-2"
        />
        <Textarea
          label={t('address')}
          rows={2}
          value={c.address}
          onChange={(e) => setC({ ...c, address: e.target.value })}
          className="sm:col-span-2"
        />
      </div>
      <SaveRow state={state} onClick={() => run(() => saveContactAction(c))} />
    </Panel>
  );
}

function SiteContent({ settings, defaults }: { settings: SettingsBundle; defaults: Defaults }) {
  const t = useTranslations('admin.settings');
  const tcms = useTranslations('admin.cms');
  const [locale, setLocale] = useState<Locale>('tr');
  const loc = (key: string) => settings.localized[key]?.[locale];
  return (
    <Panel title={t('site')}>
      <p className="mb-4 max-w-3xl text-[0.8125rem] text-a-muted">{tcms('reviewRule')}</p>
      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label={t('localeTabs')}>
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={locale === l}
            onClick={() => setLocale(l)}
            className={cn(
              'h-9 rounded-[10px] border px-3 text-[0.8125rem] font-semibold',
              locale === l
                ? 'border-a-text bg-a-accent text-a-accent-text'
                : 'border-a-border hover:bg-a-surface-2',
            )}
          >
            {localeNames[l]}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={locale}
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: admin.dur }}
          lang={locale}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
        >
          <LocalizedBlock
            title={t('sections.hero')}
            settingKey="hero"
            locale={locale}
            status={loc('hero')?.status}
            initial={{
              lines: ((loc('hero')?.data.lines as string[]) ?? defaults[locale].heroLines).join(
                '\n',
              ),
              lead: (loc('hero')?.data.lead as string) ?? defaults[locale].heroLead,
            }}
            render={(v, set) => (
              <>
                <Textarea
                  label={t('heroLines')}
                  hint={t('heroLinesHint')}
                  rows={3}
                  value={v.lines}
                  onChange={(e) => set({ ...v, lines: e.target.value })}
                />
                <Textarea
                  label={t('heroLead')}
                  rows={3}
                  value={v.lead}
                  onChange={(e) => set({ ...v, lead: e.target.value })}
                />
              </>
            )}
            toPayload={(v) => ({
              lines: v.lines
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 4),
              lead: v.lead.trim(),
            })}
          />
          <LocalizedBlock
            title={t('sections.about')}
            settingKey="about"
            locale={locale}
            status={loc('about')?.status}
            initial={{ bio: (loc('about')?.data.bio as string) ?? '' }}
            render={(v, set) => (
              <Textarea
                label={t('bio')}
                rows={8}
                value={v.bio}
                onChange={(e) => set({ bio: e.target.value })}
              />
            )}
            toPayload={(v) => ({ bio: v.bio.trim() })}
          />
          <LocalizedBlock
            title={t('sections.credentials')}
            settingKey="credentials"
            locale={locale}
            status={loc('credentials')?.status}
            initial={{ items: ((loc('credentials')?.data.items as string[]) ?? []).join('\n') }}
            render={(v, set) => (
              <Textarea
                label={t('sections.credentials')}
                hint={t('credentialsHint')}
                rows={6}
                value={v.items}
                onChange={(e) => set({ items: e.target.value })}
              />
            )}
            toPayload={(v) => ({
              items: v.items
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean),
            })}
          />
          <LocalizedBlock
            title={t('sections.faq')}
            settingKey="faq"
            locale={locale}
            status={loc('faq')?.status}
            initial={{
              text: ((loc('faq')?.data.items as { q: string; a: string }[]) ?? defaults[locale].faq)
                .map((x) => `${x.q}\n${x.a}`)
                .join('\n\n'),
            }}
            render={(v, set) => (
              <Textarea
                label={t('sections.faq')}
                hint={t('faqHint')}
                rows={10}
                value={v.text}
                onChange={(e) => set({ text: e.target.value })}
              />
            )}
            toPayload={(v) => ({
              items: v.text
                .split(/\n{2,}/)
                .map((block) => block.split('\n'))
                .filter((lines) => lines.length >= 2 && lines[0]!.trim())
                .map(([q, ...a]) => ({ q: q!.trim(), a: a.join(' ').trim() })),
            })}
          />
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}

function LocalizedBlock<V extends Record<string, string>>({
  title,
  settingKey,
  locale,
  status,
  initial,
  render,
  toPayload,
}: {
  title: string;
  settingKey: 'hero' | 'about' | 'credentials' | 'faq';
  locale: Locale;
  status?: string;
  initial: V;
  render: (v: V, set: (v: V) => void) => ReactNode;
  toPayload: (v: V) => Record<string, unknown>;
}) {
  const t = useTranslations('admin.settings');
  const tcms = useTranslations('admin.cms');
  const tc = useTranslations('admin.common');
  const [v, setV] = useState<V>(initial);
  const [st, setSt] = useState<'draft' | 'needs_review' | 'reviewed'>(
    (status as 'draft') ?? (locale === 'tr' ? 'reviewed' : 'needs_review'),
  );
  const { state, run } = useSaver();
  return (
    <section className="rounded-[16px] border border-a-border p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        {status ? (
          <Badge tone={statusTone[status as typeof st]}>
            {tcms(`translationStatus.${status as typeof st}`)}
          </Badge>
        ) : (
          <Badge>{t('notSaved')}</Badge>
        )}
      </header>
      <div className="grid gap-3">{render(v, setV)}</div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="w-52">
          <Select
            label={tc('status')}
            value={st}
            onChange={(e) => setSt(e.target.value as typeof st)}
            options={(['draft', 'needs_review', 'reviewed'] as const).map((s) => ({
              value: s,
              label: tcms(`translationStatus.${s}`),
            }))}
          />
        </div>
        <Button
          variant="primary"
          state={state}
          onClick={() => run(() => saveLocalizedAction(settingKey, locale, toPayload(v), st))}
        >
          {tc('save')}
        </Button>
      </div>
    </section>
  );
}

function ImagesPanel({ images }: { images: Images }) {
  const t = useTranslations('admin.settings');
  const [img, setImg] = useState(images);
  const { state, run } = useSaver();
  return (
    <Panel title={t('images')}>
      <div className="grid gap-4">
        {(['portrait', 'og'] as const).map((k) => (
          <div key={k}>
            <Label>{t(k === 'og' ? 'ogImage' : 'portrait')}</Label>
            <MediaUpload kind="site" value={img[k]} onChange={(p) => setImg({ ...img, [k]: p })} />
          </div>
        ))}
      </div>
      <SaveRow state={state} onClick={() => run(() => saveImagesAction(img))} />
    </Panel>
  );
}

function SecurityPanel({ supabase }: { supabase: boolean }) {
  const t = useTranslations('admin.settings');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const { state, run } = useSaver();
  const [mfa, setMfa] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [mfaState, setMfaState] = useState<ActionState>('idle');
  return (
    <Panel title={t('security')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          type="password"
          autoComplete="new-password"
          label={t('password')}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          hint={t('passwordHint')}
        />
        <Input
          type="password"
          autoComplete="new-password"
          label={t('passwordConfirm')}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          error={pw2 && pw !== pw2 ? t('passwordMismatch') : undefined}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          state={state}
          disabled={pw.length < 10 || pw !== pw2}
          onClick={() =>
            run(async () => {
              const r = await changePasswordAction(pw);
              if (r.ok) {
                setPw('');
                setPw2('');
              }
              return r;
            })
          }
        >
          {t('changePassword')}
        </Button>
      </div>
      <div className="mt-6 border-t border-a-border pt-5">
        <p className="font-bold">{t('mfa')}</p>
        {!supabase ? (
          <p className="mt-2 text-[0.8125rem] text-a-muted">{t('mfaUnavailable')}</p>
        ) : mfa ? (
          <div className="mt-3 grid gap-3">
            <p className="text-[0.8125rem] text-a-muted">{t('mfaScan')}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mfa.qr} alt="TOTP QR" className="size-44 rounded-[10px] bg-white p-2" />
            <p className="num text-[0.75rem] break-all" dir="ltr">
              {mfa.secret}
            </p>
            <div className="flex items-end gap-2">
              <Input
                label={t('mfaCode')}
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                dir="ltr"
              />
              <Button
                variant="primary"
                state={mfaState}
                onClick={async () => {
                  setMfaState('loading');
                  const res = await verifyMfaEnrollmentAction(mfa.factorId, code);
                  setMfaState(res.ok ? 'success' : 'error');
                  if (res.ok) toast.success(t('mfaEnabled'));
                  setTimeout(() => setMfaState('idle'), 900);
                }}
              >
                {t('mfaEnable')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-3"
            onClick={async () => {
              const res = await enrollMfaAction();
              if (res.ok && res.data) setMfa(res.data);
              else toast.error(t('mfaUnavailable'));
            }}
          >
            {t('mfaEnable')}
          </Button>
        )}
      </div>
    </Panel>
  );
}
