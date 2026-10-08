import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import { addDays, clampDay, diaryTotals, programDayIndex, todayISO } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import { DayTotals } from '@/components/portal/day-totals';
import { DiaryDay } from '@/components/portal/diary/diary-day';
import { ChevronIcon } from '@/components/portal/icons';
import { PortalHeader, PortalPage } from '@/components/portal/shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.diary');
  return { title: t('title') };
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const t = await getTranslations('portal.diary');
  const today = todayISO();
  const { day: param } = await searchParams;
  const day = clampDay(param, today);

  // A week strip around the selected day, never past today.
  const stripEnd = [addDays(day, 3), today].sort()[0]!;
  const stripStart = addDays(stripEnd, -6);
  const windowStart = [stripStart, addDays(today, -14)].sort()[0]!;
  const [meals, program, foods] = await Promise.all([
    portal.getDiary(user.id, windowStart, today),
    portal.getProgram(user.id),
    portal.getFoods(user.id, locale),
  ]);

  const dayMeals = meals.filter((m) => m.eaten_on === day);
  const filledDays = new Set(
    meals.filter((m) => m.items.length || m.photo_key || m.note).map((m) => m.eaten_on),
  );
  const recentFoodIds = [
    ...new Set(
      [...meals]
        .reverse()
        .flatMap((m) => [...m.items].reverse())
        .map((i) => i.food_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ].slice(0, 8);
  const idx = program ? programDayIndex(program, day) : -1;
  const planned = program && idx >= 0 ? (program.days[idx]?.meals ?? []) : [];
  const editable = Date.parse(day) >= Date.parse(today) - 60 * 864e5;

  const il = intlLocale(locale);
  const weekday = new Intl.DateTimeFormat(il, { weekday: 'short', timeZone: 'UTC' });
  const dayNum = new Intl.DateTimeFormat(il, { day: 'numeric', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(il, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const strip = Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));
  const atUTC = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const prev = addDays(stripStart, -4);
  const next = addDays(stripEnd, 4);

  return (
    <PortalPage wide>
      <PortalHeader
        help="diary"
        eyebrow={t('title')}
        title={day === today ? t('today') : long.format(atUTC(day))}
        lead={t('lead')}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-x-8 2xl:grid-cols-[minmax(0,1fr)_23rem]">
        <nav
          aria-label={t('days')}
          className="flex min-w-0 items-center gap-1.5 sm:gap-2 xl:col-start-1 xl:row-start-1"
        >
          <Link
            href={`/panel/diary?day=${prev}`}
            aria-label={t('prevWeek')}
            className="grid size-10 shrink-0 place-items-center rounded-pill border-[1.5px] border-ink/15 hover:border-ink"
          >
            <ChevronIcon size={18} className="rotate-180" />
          </Link>
          <ol className="grid min-w-0 flex-1 grid-cols-7 gap-1 sm:gap-1.5">
            {strip.map((d) => {
              const selected = d === day;
              return (
                <li key={d}>
                  <Link
                    href={`/panel/diary?day=${d}`}
                    aria-current={selected ? 'date' : undefined}
                    className={cn(
                      'flex h-16 flex-col items-center justify-center rounded-[14px] border-[1.5px] transition-colors',
                      selected
                        ? 'border-ink bg-ink text-paper'
                        : 'border-transparent hover:border-ink/20',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[0.6875rem] font-semibold',
                        selected ? 'text-sage' : 'text-ink-60',
                      )}
                    >
                      {weekday.format(atUTC(d))}
                    </span>
                    <span className="num text-[1.125rem] leading-tight font-semibold">
                      {dayNum.format(atUTC(d))}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 size-1.5 rounded-full',
                        filledDays.has(d)
                          ? selected
                            ? 'bg-citrus'
                            : 'bg-paprika-deep'
                          : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
          {stripEnd < today ? (
            <Link
              href={`/panel/diary?day=${[next, today].sort()[0]}`}
              aria-label={t('nextWeek')}
              className="grid size-10 shrink-0 place-items-center rounded-pill border-[1.5px] border-ink/15 hover:border-ink"
            >
              <ChevronIcon size={18} />
            </Link>
          ) : (
            <span className="size-10 shrink-0" aria-hidden />
          )}
        </nav>

        {/* Mobile order: days → totals → meals. Desktop: totals sticks beside both. */}
        <section className="p-card p-5 sm:p-6 xl:sticky xl:top-8 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
          <h2 className="font-display text-[1.5rem] leading-none ar:leading-[1.3] ar:font-bold">
            {t('totalsTitle')}
          </h2>
          <div className="mt-5">
            <DayTotals totals={diaryTotals(dayMeals)} targets={program?.targets ?? null} compact />
          </div>
        </section>
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <DiaryDay
            key={day}
            day={day}
            meals={dayMeals}
            planned={planned}
            foods={foods}
            recentFoodIds={recentFoodIds}
            editable={editable}
          />
        </div>
      </div>
    </PortalPage>
  );
}
