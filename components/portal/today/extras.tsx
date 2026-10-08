'use client';

import { AnimatePresence, motion } from 'motion/react';
import NextLink from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setPortalTaskDoneAction } from '@/app/panel/_actions';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { appointmentIcs } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { PortalTask } from '@/types/portal';
import { PortalCard } from '../card';
import { ChevronIcon } from '../icons';

/* ------------------------------------------------------------------------------------------------
 * Tasks the dietitian shared: each with a tick. Ticking is saved at once and the dietitian sees it
 * in their panel; a tick can be taken back.
 * ---------------------------------------------------------------------------------------------- */

export function TasksCard({ tasks, today }: { tasks: PortalTask[]; today: string }) {
  const t = useTranslations('portal.hub.tasks');
  const locale = useLocale() as Locale;
  const reduced = usePrefersReducedMotion();
  const [, start] = useTransition();
  const [shown, flip] = useOptimistic<PortalTask[], { id: string; done: boolean }>(
    tasks,
    (cur, a) =>
      cur.map((x) =>
        x.id === a.id ? { ...x, doneAt: a.done ? new Date().toISOString() : null } : x,
      ),
  );
  const day = new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const toggle = (task: PortalTask) => {
    const done = !task.doneAt;
    start(async () => {
      flip({ id: task.id, done });
      const res = await setPortalTaskDoneAction(task.id, done);
      if (!res.ok) toast.error(t('error'));
      else if (done) toast.success(t('done'));
    });
  };
  const open = shown.filter((x) => !x.doneAt).length;
  return (
    <PortalCard
      id="tasks"
      className="h-full scroll-mt-24"
      title={t('title')}
      action={
        <p className="text-[0.8125rem] font-semibold text-ink-60">
          {open ? t('open', { count: open }) : t('allDone')}
        </p>
      }
    >
      <p className="text-[0.8125rem] text-ink-60">{t('hint')}</p>
      <ul className="mt-3 space-y-1.5">
        {shown.map((task) => {
          const done = Boolean(task.doneAt);
          const late = !done && task.dueOn != null && task.dueOn < today;
          return (
            <li key={task.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                onClick={() => toggle(task)}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-[14px] border-[1.5px] px-3.5 py-3 text-start transition-[border-color,background-color]',
                  done ? 'border-transparent bg-paper-2/70' : 'border-ink/15 hover:border-ink',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-[background-color,border-color]',
                    done ? 'border-ink bg-ink text-citrus' : 'border-ink/35 group-hover:border-ink',
                  )}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13">
                    <motion.path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={false}
                      animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
                      transition={{ duration: reduced ? 0 : 0.3, ease: ease.out }}
                    />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    dir="auto"
                    className={cn(
                      'block text-[0.9375rem] leading-snug font-semibold transition-colors',
                      done && 'text-ink-60 line-through decoration-ink/30',
                    )}
                  >
                    {task.title}
                  </span>
                  {task.dueOn && !done && (
                    <span
                      className={cn(
                        'mt-0.5 block text-[0.75rem]',
                        late ? 'font-semibold text-paprika-deep' : 'text-ink-60',
                      )}
                    >
                      {t(late ? 'late' : 'due', {
                        date: day.format(new Date(`${task.dueOn}T12:00:00Z`)),
                      })}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </PortalCard>
  );
}

/* ------------------------------------------------------------------------------------------------
 * A welcome for the first days: what the portal is for, in three steps. Closed for good with its
 * button (remembered in this browser).
 * ---------------------------------------------------------------------------------------------- */

const WELCOME_KEY = 'portal_welcome_closed';

export function WelcomeCard({ name, dietitian }: { name: string; dietitian: string | null }) {
  const t = useTranslations('portal.hub.welcome');
  // decided after mount: the server cannot know what this browser remembers
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(localStorage.getItem(WELCOME_KEY) !== '1');
    } catch {
      setOpen(true);
    }
  }, []);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      /* private mode: it will simply show again */
    }
  };
  const steps = [
    { href: '#checkin', title: t('steps.record'), text: t('steps.recordText') },
    { href: '/panel/program', title: t('steps.plan'), text: t('steps.planText') },
    { href: '/panel/messages', title: t('steps.write'), text: t('steps.writeText') },
  ];
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.35, ease: ease.out }}
          className="overflow-hidden"
        >
          <div className="mt-4 rounded-[18px] border border-ink/20 bg-citrus p-5 text-ink sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[1.25rem] leading-tight font-bold tracking-[-0.01em]">
                  {t('title', { name })}
                </h2>
                <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-relaxed">
                  {dietitian ? t('lead', { dietitian }) : t('leadPlain')}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <NextLink
                  href="/panel/help"
                  className="inline-flex h-9 items-center rounded-pill border-[1.5px] border-ink px-4 text-[0.8125rem] font-semibold transition-colors hover:bg-ink hover:text-paper"
                >
                  {t('guide')}
                </NextLink>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-9 shrink-0 items-center rounded-pill bg-ink px-4 text-[0.8125rem] font-semibold text-paper transition-transform hover:scale-[1.03] active:scale-95"
                >
                  {t('close')}
                </button>
              </div>
            </div>
            <ol className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.href}>
                  <NextLink
                    href={s.href}
                    className="group flex h-full items-start gap-3 rounded-[14px] bg-ink/[0.07] p-3.5 transition-colors hover:bg-ink/[0.12]"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-[0.8125rem] font-bold text-citrus">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.9375rem] leading-tight font-bold">
                        {s.title}
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-snug">{s.text}</span>
                    </span>
                  </NextLink>
                </li>
              ))}
            </ol>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Tools: the site's calculators, recipes and shopping list, one tap away (in the client's language).
 * ---------------------------------------------------------------------------------------------- */

export function ToolsCard() {
  const t = useTranslations('portal.hub.tools');
  const locale = useLocale() as Locale;
  const mine = [
    { href: '/panel/week', title: t('week'), text: t('weekText') },
    { href: '/panel/shopping', title: t('shopping'), text: t('shoppingText') },
    { href: '/panel/files', title: t('files'), text: t('filesText') },
    { href: '/panel/care', title: t('care'), text: t('careText') },
  ];
  const site = [
    { href: '/tools' as const, title: t('calc'), text: t('calcText') },
    { href: '/recipes' as const, title: t('recipes'), text: t('recipesText') },
  ];
  const row =
    'group flex h-full items-center gap-3 rounded-[12px] border border-ink/12 bg-paper px-3.5 py-2.5 transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-ink';
  const inner = (title: string, text: string) => (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] leading-tight font-bold">{title}</span>
        <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-60">{text}</span>
      </span>
      <ChevronIcon
        size={15}
        className="shrink-0 text-ink/40 transition-colors group-hover:text-ink"
      />
    </>
  );
  return (
    <PortalCard className="h-full" title={t('title')}>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {mine.map((tool) => (
          <li key={tool.href}>
            <NextLink href={tool.href} className={row}>
              {inner(tool.title, tool.text)}
            </NextLink>
          </li>
        ))}
        {site.map((tool) => (
          <li key={tool.href}>
            <Link href={tool.href} locale={locale} className={row}>
              {inner(tool.title, tool.text)}
            </Link>
          </li>
        ))}
      </ul>
    </PortalCard>
  );
}

/** "Add to calendar": the appointment as an .ics file, made in the browser. */
export function CalendarButton({
  startsAt,
  durationMin,
  title,
  description,
  label,
  className,
}: {
  startsAt: string;
  durationMin: number;
  title: string;
  description?: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const ics = appointmentIcs({ startsAt, durationMin, title, description });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
        a.download = 'randevu.ics';
        a.click();
        URL.revokeObjectURL(a.href);
      }}
      className={cn(
        'inline-flex h-9 shrink-0 items-center rounded-pill border-[1.5px] border-ink/20 px-3.5 text-[0.8125rem] font-semibold transition-colors hover:border-ink',
        className,
      )}
    >
      {label}
    </button>
  );
}
