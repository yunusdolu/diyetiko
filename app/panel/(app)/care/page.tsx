import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import { PORTAL_TZ } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import { PortalCard as Card } from '@/components/portal/card';
import { PortalHeader, PortalPage } from '@/components/portal/shell';
import { Countdown, PrepList } from '@/components/portal/care-extras';
import { CalendarButton } from '@/components/portal/today/extras';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.care');
  return { title: t('title') };
}

/**
 * What the dietitian arranged for the client, read-only: the meetings ahead (each can go into the
 * client's own calendar) and behind, and the package bought with what has been paid and what is
 * left — exactly as the dietitian recorded it, never their private notes.
 */
export default async function CarePage() {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const il = intlLocale(locale);
  const t = await getTranslations('portal.care');
  const tk = await getTranslations('portal.appointmentKinds');
  const tp = await getTranslations('portal.carePrep');
  const format = await getFormatter();
  const [appointments, billing, profile] = await Promise.all([
    portal.getAppointments(user.id),
    portal.getBilling(user.id),
    portal.getProfile(user.id),
  ]);
  const now = new Date();
  const upcoming = appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = appointments
    .filter((a) => !(a.status === 'scheduled' && new Date(a.startsAt) > now))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 8);
  const who = profile?.dietitianName ?? t('dietitian');

  const dayFmt = new Intl.DateTimeFormat(il, { day: 'numeric', timeZone: PORTAL_TZ });
  const monthFmt = new Intl.DateTimeFormat(il, { month: 'short', timeZone: PORTAL_TZ });
  const longFmt = new Intl.DateTimeFormat(il, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: PORTAL_TZ,
  });
  const timeFmt = new Intl.DateTimeFormat(il, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PORTAL_TZ,
  });
  const dateFmt = new Intl.DateTimeFormat(il, { dateStyle: 'medium', timeZone: 'UTC' });
  const iso = (d: string) => dateFmt.format(new Date(`${d}T12:00:00Z`));
  /** lira as "1.500 TL" (see the panel's useMoney); other currencies with their sign */
  const money = (amount: number, currency: 'TRY' | 'EUR' | 'USD') => {
    const places = Number.isInteger(amount) ? 0 : 2;
    const digits = { minimumFractionDigits: places, maximumFractionDigits: places };
    return currency === 'TRY'
      ? `${format.number(amount, digits)} TL`
      : format.number(amount, { style: 'currency', currency, ...digits });
  };

  return (
    <PortalPage wide>
      <PortalHeader help="care" eyebrow={who} title={t('title')} lead={t('lead')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
        {/* ---- meetings ---- */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
          <Card title={t('upcoming')}>
            {!upcoming.length ? (
              <p className="text-[0.9375rem] text-ink-60">{t('noUpcoming')}</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((a, i) => {
                  const d = new Date(a.startsAt);
                  return (
                    <li
                      key={a.startsAt}
                      className={cn(
                        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[16px] p-4',
                        i === 0
                          ? 'on-dark bg-green grain-light text-paper'
                          : 'border-[1.5px] border-ink/12 bg-paper',
                      )}
                    >
                      <span
                        className={cn(
                          'grid w-14 shrink-0 place-items-center rounded-[12px] py-2 text-center leading-none',
                          i === 0 ? 'bg-paper/10' : 'bg-paper-2',
                        )}
                      >
                        <span className="num text-[1.5rem] font-semibold">{dayFmt.format(d)}</span>
                        <span className="mt-1 label text-[0.5625rem]">{monthFmt.format(d)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1rem] leading-tight font-bold first-letter:uppercase">
                          {longFmt.format(d)}
                        </span>
                        <span
                          className={cn(
                            'mt-1 block text-[0.875rem]',
                            i === 0 ? 'text-sage' : 'text-ink-60',
                          )}
                        >
                          <span className="num font-semibold">{timeFmt.format(d)}</span> ·{' '}
                          {tk(a.kind)} · {t('minutes', { n: a.durationMin })} ·{' '}
                          {format.relativeTime(d, now)}
                        </span>
                      </span>
                      <CalendarButton
                        startsAt={a.startsAt}
                        durationMin={a.durationMin}
                        title={t('icsTitle', { name: who })}
                        description={tk(a.kind)}
                        label={t('addToCalendar')}
                        className={
                          i === 0 ? 'border-paper/25 hover:border-citrus hover:text-citrus' : ''
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            {upcoming[0] && (
              <div className="on-dark mt-3 rounded-[16px] bg-ink p-3 text-paper">
                <Countdown startsAt={upcoming[0].startsAt} />
              </div>
            )}
            <p className="mt-4 text-[0.8125rem] text-ink-60">{t('changeHint')}</p>
          </Card>

          {upcoming[0] && (
            <Card title={tp('title')}>
              <PrepList meeting={upcoming[0].startsAt} />
            </Card>
          )}

          {past.length > 0 && (
            <Card title={t('past')}>
              <ul className="divide-y divide-ink/10">
                {past.map((a) => {
                  const d = new Date(a.startsAt);
                  return (
                    <li key={a.startsAt} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1 text-[0.9375rem]">
                        <span className="font-semibold first-letter:uppercase">
                          {longFmt.format(d)}
                        </span>
                        <span className="text-ink-60">
                          {' · '}
                          <span className="num">{timeFmt.format(d)}</span> · {tk(a.kind)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-pill px-2.5 py-1 text-[0.75rem] font-semibold',
                          a.status === 'done'
                            ? 'bg-ink text-paper'
                            : a.status === 'scheduled'
                              ? 'bg-citrus text-ink'
                              : 'bg-paper-3 text-ink-70',
                        )}
                      >
                        {t(`status.${a.status}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        {/* ---- package and payments ---- */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
          <Card title={t('plan')}>
            {!billing || !billing.packages.length ? (
              <p className="text-[0.9375rem] text-ink-60">{t('noPlan')}</p>
            ) : (
              <ul className="space-y-4">
                {billing.packages.map((p) => {
                  const due = p.price == null ? null : Math.max(0, p.price - p.paid);
                  const used = p.sessionsTotal == null ? p.used : Math.min(p.used, p.sessionsTotal);
                  return (
                    <li key={p.id} className="p-well p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="text-[1.0625rem] leading-tight font-bold">{p.name}</h3>
                        {p.closed && (
                          <span className="rounded-pill bg-paper-3 px-2.5 py-0.5 text-[0.75rem] font-semibold text-ink-70">
                            {t('closed')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[0.8125rem] text-ink-60">
                        {p.endsOn
                          ? t('period', { from: iso(p.startsOn), to: iso(p.endsOn) })
                          : t('since', { from: iso(p.startsOn) })}
                      </p>
                      {p.sessionsTotal != null && (
                        <div className="mt-3.5">
                          <p className="flex justify-between text-[0.8125rem] font-semibold">
                            <span>{t('sessions')}</span>
                            <span className="num">
                              {used}/{p.sessionsTotal}
                            </span>
                          </p>
                          <div
                            className="mt-1.5 flex gap-1"
                            role="img"
                            aria-label={t('sessionsLabel', { used, total: p.sessionsTotal })}
                          >
                            {Array.from({ length: Math.min(p.sessionsTotal, 24) }, (_, k) => (
                              <span
                                key={k}
                                className={cn(
                                  'h-2 flex-1 rounded-pill',
                                  k < used ? 'bg-green-3' : 'bg-ink/10',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {p.price != null && (
                        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3 text-center">
                          <div>
                            <dt className="label text-[0.5625rem] text-ink-60">{t('price')}</dt>
                            <dd className="mt-1 num text-[1rem] font-semibold">
                              {money(p.price, p.currency)}
                            </dd>
                          </div>
                          <div>
                            <dt className="label text-[0.5625rem] text-ink-60">{t('paid')}</dt>
                            <dd className="mt-1 num text-[1rem] font-semibold text-green-3">
                              {money(p.paid, p.currency)}
                            </dd>
                          </div>
                          <div>
                            <dt className="label text-[0.5625rem] text-ink-60">{t('due')}</dt>
                            <dd
                              className={cn(
                                'mt-1 num text-[1rem] font-semibold',
                                due ? 'text-paprika-deep' : 'text-ink-60',
                              )}
                            >
                              {due ? money(due, p.currency) : t('settled')}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {billing && billing.payments.length > 0 && (
            <Card title={t('payments')}>
              <ul className="divide-y divide-ink/10">
                {billing.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 text-[0.9375rem]">
                      <span className="num font-semibold">{iso(p.paidOn)}</span>
                      <span className="text-ink-60"> · {t(`methods.${p.method}`)}</span>
                    </span>
                    <span className="shrink-0 num text-[0.9375rem] font-bold">
                      {money(p.amount, p.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.8125rem] text-ink-60">{t('paymentsHint')}</p>
            </Card>
          )}
        </div>
      </div>
    </PortalPage>
  );
}
