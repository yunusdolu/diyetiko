import { getTranslations } from 'next-intl/server';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { sum } from '@/lib/nutrition/totals';
import { cn } from '@/lib/utils';
import { MacroRings } from '@/components/site/macro-rings';
import { NutritionLabel } from '@/components/site/nutrition-label';
import type { PortalProgram, ProgramItem } from '@/types/portal';
import { DayNav } from './program-view-client';

/**
 * The client-facing program: targets, day navigation, meals, notes. Rendered in the PROGRAM's
 * language. Used by the share link (/p/[token]) and the client portal (/panel/program).
 */
export async function ProgramView({
  program: p,
  arabicDigits = 'latn',
  todayIndex = -1,
  navClassName,
}: {
  program: Pick<
    PortalProgram,
    'language' | 'startsOn' | 'targets' | 'days' | 'notes' | 'hydration'
  >;
  arabicDigits?: 'latn' | 'arab';
  /** Portal: marks today's day */
  todayIndex?: number;
  /** Portal: offsets the sticky day chips below the app bar */
  navClassName?: string;
}) {
  const locale: Locale = p.language;
  const t = await getTranslations({ locale, namespace: 'share' });
  const tm = await getTranslations({ locale, namespace: 'meals' });
  const tmac = await getTranslations({ locale, namespace: 'macros' });
  const tu = await getTranslations({ locale, namespace: 'units' });
  const il = intlLocale(locale, arabicDigits);
  const nf = new Intl.NumberFormat(il, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(il, { maximumFractionDigits: 1 });
  const weekday = new Intl.DateTimeFormat(il, { weekday: 'long', day: 'numeric', month: 'long' });
  const start = p.startsOn ? new Date(`${p.startsOn}T12:00:00Z`) : null;

  const dayName = (i: number) =>
    start ? weekday.format(new Date(start.getTime() + i * 864e5)) : t('day', { n: i + 1 });
  // Tab label: short weekday + day number from parts — never by slicing a formatted string
  // (locales put commas/order in different places, e.g. Arabic "السبت، 26").
  const shortDay = new Intl.DateTimeFormat(il, { weekday: 'short', day: 'numeric' });
  const dayTab = (i: number) => {
    if (!start) return String(i + 1);
    const parts = shortDay.formatToParts(new Date(start.getTime() + i * 864e5));
    return [
      parts.find((x) => x.type === 'weekday')?.value,
      parts.find((x) => x.type === 'day')?.value,
    ]
      .filter(Boolean)
      .join(' ');
  };
  const qty = (it: ProgramItem) =>
    it.servings != null
      ? `${nf1.format(it.servings)} ${tu('portion')}`
      : it.unitKey && it.unitQty
        ? `${nf1.format(it.unitQty)} ${tu(it.unitKey as 'piece')}`
        : it.grams
          ? `${nf.format(it.grams)} ${tu('g')}`
          : '';

  const tgt = p.targets;
  const hasTargets = tgt.kcal || tgt.protein || tgt.carb || tgt.fat;

  return (
    <>
      {hasTargets ? (
        <section className="container-x grid grid-cols-1 items-center gap-8 pb-12 sm:grid-cols-[auto_1fr]">
          {tgt.protein && tgt.carb && tgt.fat ? (
            <MacroRings
              protein={tgt.protein}
              carb={tgt.carb}
              fat={tgt.fat}
              size={170}
              stroke={13}
              gap={6}
              play
              label={t('targets')}
            >
              {tgt.kcal ? (
                <>
                  <span className="num text-[1rem] leading-none font-semibold">
                    {nf.format(tgt.kcal)}
                  </span>
                  <span className="mt-1 label text-[0.625rem] text-ink-60">{tu('kcal')}</span>
                </>
              ) : null}
            </MacroRings>
          ) : null}
          <NutritionLabel
            headingLevel="h2"
            title={t('targets')}
            rows={[
              ...(tgt.kcal
                ? [{ label: tmac('kcal'), value: `${nf.format(tgt.kcal)} ${tu('kcal')}` }]
                : []),
              ...(tgt.protein
                ? [{ label: tmac('protein'), value: `${nf.format(tgt.protein)} ${tu('g')}` }]
                : []),
              ...(tgt.carb
                ? [{ label: tmac('carb'), value: `${nf.format(tgt.carb)} ${tu('g')}` }]
                : []),
              ...(tgt.fat
                ? [{ label: tmac('fat'), value: `${nf.format(tgt.fat)} ${tu('g')}` }]
                : []),
            ]}
          />
        </section>
      ) : null}

      <DayNav
        label={t('jumpTo')}
        className={navClassName}
        todayId={todayIndex >= 0 ? `day-${todayIndex + 1}` : undefined}
        todayLabel={t('today')}
        days={p.days.map((_, i) => ({ id: `day-${i + 1}`, label: dayTab(i) }))}
      />

      <div className="container-x mt-8 space-y-14">
        {p.days.map((d, i) => {
          const total = sum(
            d.meals.flatMap((m) =>
              m.items.map((it) => ({
                kcal: it.kcal,
                protein: it.protein,
                carb: it.carb,
                fat: it.fat,
                fiber: it.fiber,
              })),
            ),
          );
          return (
            <section
              key={i}
              id={`day-${i + 1}`}
              aria-labelledby={`day-${i + 1}-h`}
              className="share-day scroll-mt-32"
            >
              <div className="flex flex-wrap items-end justify-between gap-3 border-b-[3px] border-ink pb-3">
                <h2
                  id={`day-${i + 1}-h`}
                  className="flex flex-wrap items-baseline gap-3 font-display text-[clamp(1.9rem,5vw,2.75rem)] leading-none ar:leading-[1.4] ar:font-bold"
                >
                  {d.label ?? dayName(i)}
                  {i === todayIndex && (
                    <span className="rounded-pill bg-citrus px-2.5 py-1 font-sans text-[0.75rem] font-bold text-ink">
                      {t('today')}
                    </span>
                  )}
                </h2>
                <p className="num text-[0.8125rem] text-ink-70">
                  {t('total')}:{' '}
                  <span className="font-semibold text-ink">
                    {nf.format(total.kcal)} {tu('kcal')}
                  </span>{' '}
                  · {tmac('short.protein')} {nf.format(total.protein)} · {tmac('short.carb')}{' '}
                  {nf.format(total.carb)} · {tmac('short.fat')} {nf.format(total.fat)}
                </p>
              </div>
              {!d.meals.some((m) => m.items.length) ? (
                <p className="mt-4 text-ink-60">{t('empty')}</p>
              ) : (
                <ol className="mt-2">
                  {d.meals
                    .filter((m) => m.items.length)
                    .map((m, mi) => (
                      <li
                        key={mi}
                        className="grid grid-cols-1 gap-2 border-b border-ink/15 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6"
                      >
                        <div>
                          <p className="text-[1.0625rem] font-bold">{tm(m.slot)}</p>
                          {m.time && <p className="num text-[0.8125rem] text-ink-60">{m.time}</p>}
                        </div>
                        <div>
                          <ul className="space-y-2">
                            {m.items.map((it, ii) => (
                              <li key={ii} className="flex items-baseline justify-between gap-4">
                                <span className="min-w-0">
                                  <span className="text-[1.0625rem]">{it.name}</span>
                                  {it.note && (
                                    <span className="block text-[0.8125rem] text-ink-60">
                                      {it.note}
                                    </span>
                                  )}
                                </span>
                                <span className="shrink-0 text-end num text-[0.875rem]">
                                  {qty(it)}
                                  <span className="block text-[0.75rem] text-ink-60">
                                    {nf.format(it.kcal)} {tu('kcal')}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                          {m.note && (
                            <p className="mt-3 border-s-2 border-paprika-deep ps-3 text-[0.875rem] text-ink-70">
                              {m.note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>

      {(p.notes || p.hydration) && (
        <section className={cn('container-x mt-16 grid grid-cols-1 gap-10 md:grid-cols-2')}>
          {p.notes && (
            <div className="border-t-[3px] border-ink pt-4">
              <h2 className="text-[1.25rem] font-bold">{t('notes')}</h2>
              <p className="mt-3 text-lead whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}
          {p.hydration && (
            <div className="border-t-[3px] border-ink pt-4">
              <h2 className="text-[1.25rem] font-bold">{t('hydration')}</h2>
              <p className="mt-3 text-lead whitespace-pre-wrap">{p.hydration}</p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
