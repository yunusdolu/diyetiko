import { getLocale, getTranslations } from 'next-intl/server';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import { addDays } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { Checkin, Habit } from '@/types/portal';

/**
 * Habits × last N days. Three states, told apart by shape as well as colour:
 * done = filled square, not done (checked in, unticked) = outlined, no check-in = small dot.
 * Rate counts only days with a check-in (a missed log is not a failed habit).
 */
export async function HabitGrid({
  habits,
  checkins,
  to,
  days = 28,
}: {
  habits: Habit[];
  checkins: Checkin[];
  to: string;
  days?: number;
}) {
  const t = await getTranslations('portal.progress');
  const raw = await getLocale();
  const il = intlLocale(isLocale(raw) ? raw : 'tr');
  const fmt = new Intl.DateTimeFormat(il, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const range = Array.from({ length: days }, (_, i) => addDays(to, i - days + 1));
  const byDay = new Map(checkins.map((c) => [c.day, c]));
  const logged = range.filter((d) => byDay.has(d)).length;

  if (!habits.length) return <p className="text-ink-60">{t('habitsEmpty')}</p>;

  return (
    <div>
      <ul className="space-y-5">
        {habits.map((h) => {
          const done = range.filter((d) => byDay.get(d)?.habits.includes(h.id)).length;
          return (
            <li key={h.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[0.9375rem] font-semibold">
                  <bdi>{h.label}</bdi>
                </p>
                <p className="shrink-0 num text-[0.8125rem] text-ink-70">
                  {t('habitDays', { done, total: logged })}
                </p>
              </div>
              <ol
                className="mt-2 grid gap-[3px]"
                style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
                aria-label={`${h.label}: ${t('habitDays', { done, total: logged })}`}
              >
                {range.map((d) => {
                  const c = byDay.get(d);
                  const state = !c ? 'none' : c.habits.includes(h.id) ? 'done' : 'missed';
                  return (
                    <li
                      key={d}
                      title={`${fmt.format(at(d))} · ${t(state === 'done' ? 'legendDone' : state === 'missed' ? 'legendMissed' : 'legendNoEntry')}`}
                      aria-hidden
                      className="grid aspect-square place-items-center"
                    >
                      <span
                        className={cn(
                          'block rounded-[3px]',
                          state === 'done' && 'size-full bg-chart-self',
                          state === 'missed' && 'size-full border-[1.5px] border-ink/30',
                          state === 'none' && 'size-1 rounded-full bg-ink/20',
                        )}
                      />
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex justify-between text-[0.6875rem] text-ink-60">
        <span>{fmt.format(at(range[0]!))}</span>
        <span>{fmt.format(at(to))}</span>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.75rem] text-ink-70">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-chart-self" aria-hidden />
          {t('legendDone')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] border-[1.5px] border-ink/30" aria-hidden />
          {t('legendMissed')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="grid size-2.5 place-items-center" aria-hidden>
            <span className="size-1 rounded-full bg-ink/20" />
          </span>
          {t('legendNoEntry')}
        </li>
      </ul>
      <p className="mt-2 text-[0.75rem] text-ink-60">{t('habitsNote')}</p>
    </div>
  );
}
