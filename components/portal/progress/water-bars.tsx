import { getLocale, getTranslations } from 'next-intl/server';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import { addDays } from '@/lib/portal/logic';
import type { Checkin } from '@/types/portal';

/** Water per day, last N days: thin bars anchored to the baseline, 4px rounded tops, one series. */
export async function WaterBars({
  checkins,
  to,
  days = 14,
}: {
  checkins: Checkin[];
  to: string;
  days?: number;
}) {
  const t = await getTranslations('portal.progress');
  const tu = await getTranslations('units');
  const raw = await getLocale();
  const il = intlLocale(isLocale(raw) ? raw : 'tr');
  const liters = new Intl.NumberFormat(il, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const dayNum = new Intl.DateTimeFormat(il, { day: 'numeric', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(il, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const range = Array.from({ length: days }, (_, i) => addDays(to, i - days + 1));
  const byDay = new Map(
    checkins.filter((c) => c.water_ml != null).map((c) => [c.day, c.water_ml!]),
  );
  const logged = [...byDay.entries()].filter(([d]) => range.includes(d)).map(([, v]) => v);

  if (!logged.length) return <p className="text-ink-60">{t('noWater')}</p>;

  // scale top rounded up to the next half litre, drawn as a labelled gridline
  const max = Math.ceil(Math.max(1000, ...logged) / 500) * 500;
  const avg = logged.reduce((a, b) => a + b, 0) / logged.length;

  return (
    <div>
      <p className="text-[0.875rem] font-semibold text-ink-70">
        {t('avgWater', { liters: liters.format(avg / 1000) })}
      </p>
      <div className="relative mt-8">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 border-t border-dashed border-ink/20"
        />
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink/10"
        />
        <span aria-hidden className="absolute end-0 -top-5 num text-[0.6875rem] text-ink-60">
          {liters.format(max / 1000)} {tu('liter')}
        </span>
        <ol
          className="relative grid h-36 items-end gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
        >
          {range.map((d) => {
            const v = byDay.get(d);
            const label = `${long.format(at(d))}: ${v == null ? '—' : `${liters.format(v / 1000)} ${tu('liter')}`}`;
            return (
              <li key={d} className="flex h-full flex-col justify-end" title={label}>
                <span className="sr-only">{label}</span>
                {v != null && v > 0 ? (
                  <span
                    className="block w-full rounded-t-[4px] bg-chart-self"
                    style={{ height: `${Math.max(3, (v / max) * 100)}%` }}
                    aria-hidden
                  />
                ) : (
                  <span className="block h-[2px] w-full rounded-pill bg-ink/15" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <ol
        className="mt-1.5 grid border-t border-ink/15 pt-1.5 text-center text-[0.6875rem] text-ink-60"
        style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {range.map((d) => (
          <li key={d} className={d === to ? 'font-bold text-ink' : undefined}>
            {dayNum.format(at(d))}
          </li>
        ))}
      </ol>
    </div>
  );
}
