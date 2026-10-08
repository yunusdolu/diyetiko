import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { dirOf, intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import Link from 'next/link';
import { programDayIndex, todayISO } from '@/lib/portal/logic';
import { ProgramToday } from '@/components/portal/program-today';
import { ProgramIcon } from '@/components/portal/icons';
import { PortalHeader, PortalPage } from '@/components/portal/shell';
import { ProgramView } from '@/components/program/program-view';
import { PrintButton } from '@/components/program/program-view-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.program');
  return { title: t('title') };
}

export default async function ProgramPage() {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const t = await getTranslations('portal.program');
  const tt = await getTranslations('portal.programToday');
  const tm = await getTranslations('meals');
  const program = await portal.getProgram(user.id);

  if (!program) {
    return (
      <PortalPage wide>
        <PortalHeader help="program" eyebrow={t('title')} title={t('title')} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="p-card grid place-items-center gap-4 px-6 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-ink text-citrus">
              <ProgramIcon size={26} />
            </span>
            <h2 className="text-[1.375rem] font-bold tracking-[-0.01em]">{tt('emptyTitle')}</h2>
            <p className="max-w-sm text-ink-70">{t('empty')}</p>
          </div>
          <div className="p-card p-5 sm:p-6">
            <ol className="space-y-2">
              {(tt.raw('emptySteps') as string[]).map((step, i) => (
                <li key={i} className="p-well flex items-start gap-3 p-3.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[0.75rem] font-bold text-paper">
                    {i + 1}
                  </span>
                  <span className="text-[0.9375rem] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/panel/diary"
                className="inline-flex h-11 items-center rounded-pill bg-ink px-5 text-[0.9375rem] font-semibold text-paper transition-colors hover:bg-green"
              >
                {tt('emptyDiary')}
              </Link>
              <Link
                href="/panel/messages"
                className="inline-flex h-11 items-center rounded-pill border-[1.5px] border-ink/20 px-5 text-[0.9375rem] font-semibold transition-colors hover:border-ink"
              >
                {tt('emptyAsk')}
              </Link>
            </p>
          </div>
        </div>
      </PortalPage>
    );
  }

  const date = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'long' }).format(
    new Date(program.updatedAt),
  );
  // The program is written in its own language (chosen by the dietitian), which can differ from
  // the panel language — mark it so screen readers and RTL layout follow the content.
  const lang = program.language;
  // today in the programme: its meals, what is already in the diary, the day against the targets
  const today = todayISO();
  const idx = programDayIndex(program, today);
  const day = idx >= 0 ? program.days[idx] : null;
  const diary = day ? await portal.getDiary(user.id, today, today) : [];
  const logged = new Set(diary.filter((m) => m.items.length).map((m) => m.slot as string));
  const total = (
    key: 'kcal' | 'protein' | 'carb' | 'fat',
    meals: (typeof program.days)[number]['meals'],
  ) => meals.reduce((a, m) => a + m.items.reduce((b, it) => b + it[key], 0), 0);
  const shortDay = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const week = program.days.map((d, i) => ({
    label: program.startsOn
      ? shortDay.format(new Date(Date.parse(`${program.startsOn}T12:00:00Z`) + i * 864e5))
      : String(i + 1),
    kcal: total('kcal', d.meals),
    today: i === idx,
  }));

  return (
    // Portal gutters for the shared program view (it lays itself out with `container-x`).
    <div className="mx-auto max-w-[1680px] [--gutter:1rem] sm:[--gutter:1.5rem] lg:[--gutter:2.5rem]">
      <div className="container-x">
        <PortalHeader
          help="program"
          eyebrow={t('title')}
          title={
            <span lang={lang} dir={dirOf(lang)}>
              {program.title}
            </span>
          }
          lead={t('updated', { date })}
          actions={<PrintButton label={t('print')} />}
        />
      </div>
      {day && day.meals.some((m) => m.items.length) && (
        <div className="container-x mb-6">
          <ProgramToday
            meals={day.meals
              .filter((m) => m.items.length)
              .map((m) => ({
                slot: m.slot,
                label: tm(m.slot),
                time: m.time,
                kcal: m.items.reduce((a, it) => a + it.kcal, 0),
                items: m.items.map((it) => it.name).join(', '),
                logged: logged.has(m.slot),
              }))}
            planned={{
              kcal: total('kcal', day.meals),
              protein: total('protein', day.meals),
              carb: total('carb', day.meals),
              fat: total('fat', day.meals),
            }}
            targets={program.targets}
            week={week}
          />
        </div>
      )}
      <div lang={lang} dir={dirOf(lang)}>
        <ProgramView
          program={program}
          todayIndex={programDayIndex(program, todayISO())}
          navClassName="top-[calc(3.5rem+env(safe-area-inset-top))] lg:top-0"
        />
      </div>
    </div>
  );
}
