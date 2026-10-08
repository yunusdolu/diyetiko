import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getClient, listMeasurements } from '@/lib/admin/clients';
import { clientWeights } from '@/lib/admin/insights';
import { auditReport, listLabs } from '@/lib/admin/practice';
import { isLabTestKey, labFlag, labSeries } from '@/lib/admin/practice-logic';
import { dailyWeights, goalJourney } from '@/lib/admin/signals';
import { requireUser } from '@/lib/auth';
import { dirOf } from '@/lib/i18n/config';
import { todayISO } from '@/lib/portal/logic';
import { BrandMark } from '@/components/site/header';
import { ReportActions } from '@/components/admin/clients/report-actions';

export const metadata: Metadata = { title: 'Rapor' };

/**
 * A one-page progress report for the client, in the client's own language: the way from the
 * first weight to today (and the goal), the measurements, and lab values with the lab's ranges.
 * Printed or saved as PDF from the browser; always on white paper, whatever the panel theme.
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [client, measurements, weights, labs] = await Promise.all([
    getClient(user.id, id),
    listMeasurements(user.id, id),
    clientWeights(user.id, id),
    listLabs(user.id, id),
  ]);
  if (!client) notFound();
  await auditReport(user.id, id);

  const locale = client.preferred_language;
  const t = await getTranslations({ locale, namespace: 'admin.report' });
  const tl = await getTranslations({ locale, namespace: 'admin.labs' });
  const site = await getTranslations({ locale, namespace: 'meta' });
  const format = await getFormatter({ locale });
  const day = (d: string, style: 'medium' | 'long' = 'medium') =>
    format.dateTime(new Date(`${d}T12:00:00Z`), { dateStyle: style, timeZone: 'UTC' });
  const n1 = (v: number, sign = false) =>
    format.number(v, { maximumFractionDigits: 1, signDisplay: sign ? 'exceptZero' : 'auto' });

  const days = dailyWeights(weights);
  const journey = goalJourney(weights, client.goal_weight_kg);
  const series = labs ? labSeries(labs) : [];
  const rows = [...measurements].reverse().slice(0, 12);
  // only the columns this client was actually measured on
  const cols = (
    [
      ['weight_kg', t('weight'), 'kg'],
      ['body_fat_pct', t('bodyFat'), '%'],
      ['muscle_kg', t('muscle'), 'kg'],
      ['waist_cm', t('waist'), 'cm'],
      ['hip_cm', t('hip'), 'cm'],
    ] as const
  ).filter(([k]) => rows.some((m) => m[k] != null));
  const first = (k: 'waist_cm' | 'hip_cm' | 'body_fat_pct') =>
    measurements.find((m) => m[k] != null)?.[k] ?? null;
  const last = (k: 'waist_cm' | 'hip_cm' | 'body_fat_pct') =>
    [...measurements].reverse().find((m) => m[k] != null)?.[k] ?? null;
  const circ = (
    [
      ['waist_cm', t('waist'), 'cm'],
      ['hip_cm', t('hip'), 'cm'],
      ['body_fat_pct', t('bodyFat'), '%'],
    ] as const
  )
    .map(([k, label, unit]) => ({ label, unit, a: first(k), b: last(k) }))
    .filter((x) => x.a != null && x.b != null);

  return (
    <div className="min-h-dvh bg-[#e9e6dd] px-4 py-6 print:bg-white print:p-0">
      <ReportActions
        printLabel={t('print')}
        closeLabel={t('close')}
        backHref={`/admin/clients/${id}?tab=overview`}
      />
      <article
        lang={locale}
        dir={dirOf(locale)}
        className="mx-auto max-w-[210mm] bg-white px-5 py-6 text-[#0f1b17] shadow-[0_30px_60px_-30px_rgb(15_27_23/0.35)] sm:px-[12mm] sm:py-[14mm] print:max-w-none print:px-0 print:py-0 print:shadow-none"
      >
        <header className="flex flex-col-reverse items-start justify-between gap-4 border-b-2 border-[#0f1b17] pb-5 sm:flex-row sm:gap-6">
          <div>
            <p className="text-[0.75rem] font-semibold tracking-[0.14em] text-[#5b6b64] uppercase">
              {t('title')}
            </p>
            <h1 className="mt-1 font-display text-[2rem] leading-tight ar:font-bold">
              {client.full_name}
            </h1>
            {days.length > 0 && (
              <p className="mt-1 text-[0.875rem] text-[#5b6b64]">
                {t('period', { from: day(days[0]!.day), to: day(days.at(-1)!.day) })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-end">
            <span className="text-[0.875rem] leading-tight font-semibold">{site('siteName')}</span>
            <BrandMark className="size-9" />
          </div>
        </header>

        {!days.length ? (
          <p className="py-10 text-center text-[#5b6b64]">{t('noData')}</p>
        ) : (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
              {(
                [
                  [t('start'), days[0]!.kg, 'kg'],
                  [t('now'), days.at(-1)!.kg, 'kg'],
                  [t('change'), days.at(-1)!.kg - days[0]!.kg, 'kg'],
                  [t('goal'), client.goal_weight_kg, 'kg'],
                ] as const
              ).map(([label, v, unit], i) => (
                <div
                  key={label}
                  className={
                    i === 1
                      ? 'rounded-[12px] bg-[#0f1b17] p-3 text-white'
                      : 'rounded-[12px] bg-[#f3f1ea] p-3'
                  }
                >
                  <p className="text-[0.6875rem] font-semibold tracking-wide uppercase opacity-70">
                    {label}
                  </p>
                  <p className="mt-1 num-wide text-[1.5rem] leading-none">
                    {v == null ? '—' : n1(v, i === 2)}
                    {v != null && <span className="ms-1 text-[0.75rem] opacity-70">{unit}</span>}
                  </p>
                </div>
              ))}
            </section>

            {journey && (
              <section className="mt-4">
                <div className="flex items-baseline justify-between text-[0.8125rem]">
                  <span className="font-semibold">{t('progress')}</span>
                  <span className="num font-semibold">{Math.round(journey.progress * 100)}%</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#f3f1ea]">
                  <div
                    className="h-full rounded-full bg-[#2f7a55] print:[print-color-adjust:exact]"
                    style={{ width: `${Math.round(journey.progress * 100)}%` }}
                  />
                </div>
              </section>
            )}

            {days.length > 1 && (
              <section className="mt-7 break-inside-avoid">
                <h2 className="text-[0.9375rem] font-bold">{t('weightTitle')}</h2>
                <WeightLine
                  points={days.map((d) => d.kg)}
                  goal={client.goal_weight_kg}
                  labels={[day(days[0]!.day), day(days.at(-1)!.day)]}
                />
              </section>
            )}

            {circ.length > 0 && (
              <section className="mt-7 break-inside-avoid">
                <h2 className="text-[0.9375rem] font-bold">{t('circumference')}</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 print:grid-cols-3">
                  {circ.map((c) => (
                    <div key={c.label} className="rounded-[12px] border border-[#dcd8cc] p-3">
                      <p className="text-[0.75rem] font-semibold text-[#5b6b64]">{c.label}</p>
                      <p className="mt-1 num text-[0.9375rem] font-semibold whitespace-nowrap">
                        {n1(c.a!)} → {n1(c.b!)} {c.unit}
                      </p>
                      <p className="num text-[0.75rem] text-[#5b6b64]">
                        {n1(c.b! - c.a!, true)} {c.unit}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {rows.length > 0 && (
              <section className="mt-7 break-inside-avoid">
                <h2 className="text-[0.9375rem] font-bold">{t('measurements')}</h2>
                <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
                  <table className="mt-3 w-full min-w-[30rem] border-collapse text-[0.8125rem] print:min-w-0">
                    <thead>
                      <tr className="border-b border-[#0f1b17] text-start text-[0.6875rem] tracking-wide text-[#5b6b64] uppercase">
                        <th className="py-1.5 text-start font-semibold">{t('date')}</th>
                        {cols.map(([k, label]) => (
                          <th key={k} className="py-1.5 text-end font-semibold">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="num">
                      {rows.map((m) => (
                        <tr key={m.id} className="border-b border-[#e6e2d6]">
                          <td className="py-1.5">{day(m.measured_at)}</td>
                          {cols.map(([k, , unit]) => (
                            <td key={k} className="py-1.5 text-end">
                              {m[k] != null ? `${n1(m[k])} ${unit}` : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {series.length > 0 && (
          <section className="mt-7 break-inside-avoid">
            <h2 className="text-[0.9375rem] font-bold">{t('labs')}</h2>
            <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              <table className="mt-3 w-full min-w-[30rem] border-collapse text-[0.8125rem] print:min-w-0">
                <thead>
                  <tr className="border-b border-[#0f1b17] text-[0.6875rem] tracking-wide text-[#5b6b64] uppercase">
                    <th className="py-1.5 text-start font-semibold" />
                    <th className="py-1.5 text-end font-semibold">{t('previous')}</th>
                    <th className="py-1.5 text-end font-semibold">{t('latest')}</th>
                    <th className="py-1.5 text-end font-semibold">{t('range')}</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => {
                    const flag = labFlag(s.latest.value, s.latest.ref_low, s.latest.ref_high);
                    const off = flag === 'low' || flag === 'high';
                    return (
                      <tr key={s.test} className="border-b border-[#e6e2d6]">
                        <td className="py-1.5 font-semibold">
                          {isLabTestKey(s.test) ? tl(`tests.${s.test}`) : s.test}
                        </td>
                        <td className="py-1.5 text-end num text-[#5b6b64]">
                          {s.previous
                            ? `${format.number(s.previous.value)} · ${day(s.previous.taken_on)}`
                            : '—'}
                        </td>
                        <td
                          className={`py-1.5 text-end num font-semibold ${off ? 'text-[#b4432f]' : ''}`}
                        >
                          {format.number(s.latest.value)} {s.unit}
                          {off && ` ${flag === 'high' ? '↑' : '↓'}`}
                        </td>
                        <td className="py-1.5 text-end text-[#5b6b64]">
                          {s.latest.ref_low != null || s.latest.ref_high != null
                            ? `${s.latest.ref_low != null ? format.number(s.latest.ref_low) : '…'}–${s.latest.ref_high != null ? format.number(s.latest.ref_high) : '…'}`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="mt-10 flex flex-col items-start justify-between gap-2 gap-6 border-t border-[#dcd8cc] pt-4 text-[0.75rem] text-[#5b6b64] sm:flex-row sm:items-end">
          <p className="sm:max-w-[65%]">{t('footer')}</p>
          <p className="num">{t('prepared', { date: day(todayISO(), 'long') })}</p>
        </footer>
      </article>
    </div>
  );
}

/** A plain line of the weights in time order (print-safe SVG, no script). */
function WeightLine({
  points,
  goal,
  labels,
}: {
  points: number[];
  goal: number | null;
  labels: [string, string];
}) {
  const W = 700;
  const H = 160;
  const pad = 10;
  const all = goal != null ? [...points, goal] : points;
  const min = Math.min(...all) - 1;
  const max = Math.max(...all) + 1;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <figure className="mt-3" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-hidden>
        {goal != null && (
          <line
            x1={pad}
            x2={W - pad}
            y1={y(goal)}
            y2={y(goal)}
            stroke="#2f7a55"
            strokeDasharray="5 5"
            strokeWidth="1.5"
          />
        )}
        <path
          d={`${d} L${x(points.length - 1)},${H - pad} L${x(0)},${H - pad} Z`}
          fill="#0f1b17"
          opacity="0.06"
        />
        <path
          d={d}
          fill="none"
          stroke="#0f1b17"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(points.length - 1)} cy={y(points.at(-1)!)} r="5" fill="#0f1b17" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[0.6875rem] text-[#5b6b64]">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </figcaption>
    </figure>
  );
}
