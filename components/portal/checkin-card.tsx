'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { saveCheckinAction } from '@/app/panel/_actions';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { dur, ease, spring } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { WATER_GLASS_ML, WATER_GOAL_ML } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { Checkin, Habit } from '@/types/portal';
import { MotionButton } from '@/components/ui/motion-button';
import { CheckIcon, MinusIcon, PlusIcon } from './icons';

type Patch = Partial<
  Pick<Checkin, 'water_ml' | 'habits' | 'energy' | 'weight_kg' | 'activity_min' | 'activity_note'>
>;
/** quick picks for the day's movement, in minutes */
const MINUTES = [15, 30, 45, 60, 90] as const;
const MOVE_STEP = 5;
const MOVE_MAX = 300;
const GLASSES = WATER_GOAL_ML / WATER_GLASS_ML;
const BOTTLE_ML = 500;

/**
 * The day's record (DESIGN.md v1.34): five tiles — water, habits, energy, movement, weight — each
 * saved as it is touched. The row of marks under the title fills in as the tiles are done.
 */
export function CheckinCard({
  day,
  initial,
  habits,
  activity,
  lastWeight,
}: {
  day: string;
  initial: Checkin | null;
  habits: Habit[];
  /** the day's movement can be recorded (the project has the activity columns) */
  activity: boolean;
  /** the latest weight recorded before today, to compare with */
  lastWeight?: { kg: number; day: string } | null;
}) {
  const t = useTranslations('portal.today');
  const locale = useLocale() as Locale;
  const il = intlLocale(locale);
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const nf1 = new Intl.NumberFormat(il, { maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat(il, { maximumFractionDigits: 0 });
  const kg = new Intl.NumberFormat(il, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const [water, setWater] = useState(initial?.water_ml ?? 0);
  const [done, setDone] = useState<string[]>(initial?.habits ?? []);
  const [energy, setEnergy] = useState<number | null>(initial?.energy ?? null);
  const [moveMin, setMoveMin] = useState<number | null>(initial?.activity_min ?? null);
  const [moveKind, setMoveKind] = useState<string | null>(initial?.activity_note ?? null);
  const [weight, setWeight] = useState(initial?.weight_kg != null ? String(initial.weight_kg) : '');
  const [weighed, setWeighed] = useState(initial?.weight_kg != null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [weightState, setWeightState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [, startSave] = useTransition();
  const pending = useRef<Patch>({});
  const timer = useRef<number | undefined>(undefined);
  const lastGood = useRef({ water, done, energy, moveMin, moveKind });

  // Debounced autosave of the quick fields. One request per pause; the page's own figures (the
  // ring, the week) are refreshed after it.
  const queue = (patch: Patch) => {
    pending.current = { ...pending.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const body = pending.current;
      pending.current = {};
      startSave(async () => {
        const res = await saveCheckinAction(day, body);
        if (res.ok) {
          lastGood.current = {
            water: res.data?.water_ml ?? 0,
            done: res.data?.habits ?? [],
            energy: res.data?.energy ?? null,
            moveMin: res.data?.activity_min ?? null,
            moveKind: res.data?.activity_note ?? null,
          };
          setSavedAt(Date.now());
          router.refresh();
        } else {
          // Roll back to the last saved state rather than showing values that were not stored.
          setWater(lastGood.current.water);
          setDone(lastGood.current.done);
          setEnergy(lastGood.current.energy);
          setMoveMin(lastGood.current.moveMin);
          setMoveKind(lastGood.current.moveKind);
          toast.error(t('saveFailed'));
        }
      });
    }, 600);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setMl = (ml: number) => {
    const next = Math.max(0, Math.min(10000, Math.round(ml / 50) * 50));
    setWater(next);
    queue({ water_ml: next });
  };
  const toggleHabit = (id: string) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    queue({ habits: next });
  };
  const pickEnergy = (v: number) => {
    const next = energy === v ? null : v;
    setEnergy(next);
    queue({ energy: next });
  };
  const setMinutes = (v: number | null) => {
    const next = v == null || v <= 0 ? null : Math.min(MOVE_MAX, v);
    setMoveMin(next);
    // no minutes, no kind
    if (next == null) setMoveKind(null);
    queue(next == null ? { activity_min: null, activity_note: null } : { activity_min: next });
  };
  const pickKind = (k: string) => {
    const next = moveKind === k ? null : k;
    setMoveKind(next);
    queue({ activity_note: next });
  };

  const parsedWeight = Number(weight.replace(',', '.'));
  const weightOk = Number.isFinite(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 400;
  const nudgeWeight = (by: number) => {
    const base = weightOk ? parsedWeight : (lastWeight?.kg ?? null);
    if (base == null) return;
    setWeight(String(Math.round((base + by) * 10) / 10));
  };
  const saveWeight = async () => {
    if (!weightOk) {
      setWeightState('error');
      window.setTimeout(() => setWeightState('idle'), 1200);
      return;
    }
    setWeightState('loading');
    const res = await saveCheckinAction(day, { weight_kg: Math.round(parsedWeight * 10) / 10 });
    setWeightState(res.ok ? 'success' : 'error');
    if (res.ok) {
      setWeighed(true);
      toast.success(t('weightSaved'));
      router.refresh();
    }
    window.setTimeout(() => setWeightState('idle'), 1200);
  };

  const levels = t.raw('energyLevels') as string[];
  const pct = Math.min(1, water / WATER_GOAL_ML);
  const left = Math.max(0, WATER_GOAL_ML - water);
  const habitsDone = habits.filter((h) => done.includes(h.id)).length;
  const delta =
    weightOk && lastWeight ? Math.round((parsedWeight - lastWeight.kg) * 10) / 10 : null;
  const marks = [
    { key: 'water', label: t('water'), on: water > 0 },
    ...(habits.length ? [{ key: 'habits', label: t('habits'), on: habitsDone > 0 }] : []),
    { key: 'energy', label: t('energyShort'), on: energy != null },
    ...(activity ? [{ key: 'move', label: t('activity'), on: moveMin != null }] : []),
    { key: 'weight', label: t('weight'), on: weighed },
  ];
  const pop = reduced ? { duration: 0 } : spring.snappy;

  return (
    <section aria-labelledby="checkin-title" className="p-card @container h-full">
      <div className="flex min-h-[3.375rem] items-center justify-between gap-4 border-b border-ink/10 px-5 py-2.5 sm:px-6">
        <div>
          <h2
            id="checkin-title"
            className="text-[1.0625rem] leading-tight font-bold tracking-[-0.01em]"
          >
            {t('checkin')}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-60">{t('checkinHint')}</p>
        </div>
        <AnimatePresence>
          {savedAt && (
            <motion.p
              key={savedAt}
              role="status"
              className="flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-green-3"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: dur.sm, ease: ease.out }}
            >
              <CheckIcon size={14} />
              {t('saved')}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* what is filled in so far */}
      <ul className="flex flex-wrap gap-1.5 px-4 pt-4 sm:px-5" aria-label={t('checkinMarks')}>
        {marks.map((m) => (
          <li
            key={m.key}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-pill ps-1.5 pe-2.5 text-[0.75rem] font-semibold transition-colors duration-300',
              m.on ? 'bg-ink text-paper' : 'bg-ink/[0.06] text-ink-60',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-4 place-items-center rounded-full transition-colors duration-300',
                m.on ? 'bg-citrus text-ink' : 'bg-ink/15',
              )}
            >
              <Tick on={m.on} size={10} reduced={reduced} />
            </span>
            {m.label}
            <span className="sr-only">{m.on ? t('markDone') : t('markOpen')}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 @xl:grid-cols-2">
        {/* ---- Water: a tank that fills, one tap per glass or bottle ---- */}
        <Tile className="@xl:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-ui font-bold">{t('water')}</h3>
              <p className="mt-1 text-[0.8125rem] text-ink-60" aria-live="polite">
                {left > 0 ? t('waterLeft', { value: nf1.format(left / 1000) }) : t('waterReached')}
              </p>
            </div>
            <p className="text-end leading-none">
              <span className="num text-[2rem] font-semibold tracking-[-0.02em]">
                {nf1.format(water / 1000)}
              </span>
              <span className="num text-[0.875rem] text-ink-60">
                {' '}
                / {nf1.format(WATER_GOAL_ML / 1000)} L
              </span>
              <span className="sr-only">
                {t('waterOf', {
                  value: nf1.format(water / 1000),
                  goal: nf1.format(WATER_GOAL_ML / 1000),
                })}
              </span>
            </p>
          </div>

          <div
            dir="ltr"
            className="relative mt-3.5 h-12 overflow-hidden rounded-[14px] bg-ink/[0.07]"
          >
            <motion.div
              className="absolute inset-y-0 left-0 overflow-hidden rounded-[14px] bg-green-3"
              initial={false}
              animate={{ width: `${pct * 100}%` }}
              transition={
                reduced ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 20 }
              }
            >
              {/* light moving through the water */}
              <span
                aria-hidden
                className="absolute inset-0 animate-[water-sheen_3.2s_linear_infinite] bg-[linear-gradient(100deg,transparent_30%,rgb(255_255_255/0.22)_50%,transparent_70%)] bg-[length:220%_100%] motion-reduce:animate-none"
              />
            </motion.div>
            {/* one cell per glass: tap to set the level */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${GLASSES}, 1fr)` }}
            >
              {Array.from({ length: GLASSES }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() =>
                    setMl(
                      water === (i + 1) * WATER_GLASS_ML
                        ? i * WATER_GLASS_ML
                        : (i + 1) * WATER_GLASS_ML,
                    )
                  }
                  className={cn(
                    'h-full border-paper/70 transition-colors hover:bg-ink/[0.06]',
                    i > 0 && 'border-s-2',
                  )}
                />
              ))}
            </div>
            <AnimatePresence>
              {pct >= 1 && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-3 my-auto grid size-7 place-items-center rounded-full bg-citrus text-ink"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={pop}
                >
                  <CheckIcon size={15} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="mt-1.5 flex justify-between num text-[0.6875rem] text-ink-60" aria-hidden>
            <span>0</span>
            <span>{t('glasses', { count: Math.round((water / WATER_GLASS_ML) * 10) / 10 })}</span>
            <span>{nf1.format(WATER_GOAL_ML / 1000)} L</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMl(water - WATER_GLASS_ML)}
              disabled={water <= 0}
              aria-label={t('glassRemove')}
              className="grid size-11 shrink-0 place-items-center rounded-pill border-[1.5px] border-ink/20 transition-[border-color,scale] hover:border-ink active:scale-90 disabled:opacity-35"
            >
              <MinusIcon size={18} />
            </button>
            <AddButton
              onClick={() => setMl(water + WATER_GLASS_ML)}
              label={t('glassAdd')}
              title={t('glassShort')}
              amount={`${nf0.format(WATER_GLASS_ML)} ml`}
              primary
            />
            <AddButton
              onClick={() => setMl(water + BOTTLE_ML)}
              label={t('bottleAdd')}
              title={t('bottleShort')}
              amount={`${nf0.format(BOTTLE_ML)} ml`}
            />
          </div>
        </Tile>

        {/* ---- Habits: a list to tick ---- */}
        <Tile>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-ui font-bold">{t('habits')}</h3>
            {habits.length > 0 && (
              <p className="num text-[0.8125rem] font-semibold text-ink-60">
                {habitsDone}/{habits.length}
              </p>
            )}
          </div>
          {habits.length ? (
            <>
              <div className="mt-2 h-1 overflow-hidden rounded-pill bg-ink/10" aria-hidden>
                <motion.div
                  className="h-full origin-left rounded-pill bg-green-3 rtl:origin-right"
                  initial={false}
                  animate={{ scaleX: habitsDone / habits.length }}
                  transition={reduced ? { duration: 0 } : { duration: dur.md, ease: ease.out }}
                />
              </div>
              <ul className="mt-3 space-y-1.5">
                {habits.map((h) => {
                  const on = done.includes(h.id);
                  return (
                    <li key={h.id}>
                      <motion.button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleHabit(h.id)}
                        whileTap={reduced ? undefined : { scale: 0.98 }}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-3 rounded-[12px] border-[1.5px] px-3 py-2 text-start text-[0.9375rem] font-semibold transition-colors duration-200',
                          on
                            ? 'border-ink bg-ink text-paper'
                            : 'border-ink/15 bg-paper hover:border-ink',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-200',
                            on ? 'border-citrus bg-citrus text-ink' : 'border-ink/35',
                          )}
                        >
                          <Tick on={on} size={11} reduced={reduced} />
                        </span>
                        <bdi className="min-w-0 flex-1">{h.label}</bdi>
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[0.875rem] text-ink-60">{t('habitsEmpty')}</p>
          )}
        </Tile>

        <div className="grid grid-cols-1 content-start gap-3">
          {/* ---- Energy: five steps, the mark slides to the chosen one ---- */}
          <Tile>
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="energy-label" className="text-ui font-bold">
                {t('energy')}
              </h3>
              <p className="text-[0.8125rem] font-semibold text-ink-60">
                {energy != null ? levels[energy - 1] : '—'}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-labelledby="energy-label"
              className="mt-3 grid grid-cols-5 gap-1 rounded-[14px] bg-ink/[0.06] p-1"
            >
              {levels.map((label, i) => {
                const v = i + 1;
                const on = energy === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={label}
                    title={label}
                    onClick={() => pickEnergy(v)}
                    className="relative grid h-12 place-items-center rounded-[10px] transition-colors hover:bg-ink/[0.06]"
                  >
                    {on && (
                      <motion.span
                        layoutId="energy-pick"
                        className="absolute inset-0 rounded-[10px] bg-ink"
                        transition={pop}
                      />
                    )}
                    <span className="relative flex items-end gap-[3px]" aria-hidden>
                      {Array.from({ length: 5 }, (_, k) => (
                        <span
                          key={k}
                          style={{ height: 6 + k * 3 }}
                          className={cn(
                            'w-[3px] rounded-full transition-colors duration-200',
                            k < v
                              ? on
                                ? 'bg-citrus'
                                : 'bg-ink'
                              : on
                                ? 'bg-paper/25'
                                : 'bg-ink/15',
                          )}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 flex justify-between text-[0.6875rem] text-ink-60" aria-hidden>
              <span>{levels[0]}</span>
              <span>{levels[levels.length - 1]}</span>
            </p>
          </Tile>

          {/* ---- Weight: now and then, with the last one to compare ---- */}
          <Tile>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="checkin-weight" className="text-ui font-bold">
                {t('weight')}
              </label>
              {delta != null && delta !== 0 && (
                <p dir="ltr" className="num text-[0.8125rem] font-semibold text-ink-60">
                  {delta > 0 ? '+' : '−'}
                  {kg.format(Math.abs(delta))} kg
                </p>
              )}
            </div>
            <p className="mt-1 text-[0.8125rem] text-ink-60">
              {lastWeight
                ? t('weightLast', {
                    value: kg.format(lastWeight.kg),
                    date: new Intl.DateTimeFormat(il, {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    }).format(new Date(`${lastWeight.day}T12:00:00Z`)),
                  })
                : t('weightHint')}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div
                dir="ltr"
                className="flex h-12 items-center rounded-pill border-[1.5px] border-ink/20 bg-paper px-1 focus-within:border-ink"
              >
                <Nudge onClick={() => nudgeWeight(-0.1)} label={t('weightLess')}>
                  <MinusIcon size={16} />
                </Nudge>
                <input
                  id="checkin-weight"
                  inputMode="decimal"
                  dir="ltr"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
                  onKeyDown={(e) => e.key === 'Enter' && saveWeight()}
                  placeholder={lastWeight ? kg.format(lastWeight.kg) : '70,5'}
                  className="w-16 bg-transparent text-center num text-[1.125rem] font-semibold outline-none placeholder:font-normal placeholder:text-ink/30"
                />
                <span className="pe-1 num text-[0.8125rem] text-ink-60">kg</span>
                <Nudge onClick={() => nudgeWeight(0.1)} label={t('weightMore')}>
                  <PlusIcon size={16} />
                </Nudge>
              </div>
              <MotionButton
                type="button"
                variant="outline"
                state={weightState}
                onClick={saveWeight}
                disabled={!weight}
              >
                {t('weightSave')}
              </MotionButton>
            </div>
          </Tile>
        </div>

        {/* ---- Movement: how long, and what it was ---- */}
        {activity && (
          <Tile className="@xl:col-span-2">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 id="move-label" className="text-ui font-bold">
                  {t('activity')}
                </h3>
                <p className="mt-1 text-[0.8125rem] text-ink-60">{t('activityHint')}</p>
              </div>
              <div
                dir="ltr"
                className="flex h-11 shrink-0 items-center rounded-pill border-[1.5px] border-ink/20 bg-paper px-1"
              >
                <Nudge
                  onClick={() => setMinutes((moveMin ?? 0) - MOVE_STEP)}
                  label={t('activityLess')}
                  disabled={moveMin == null}
                >
                  <MinusIcon size={16} />
                </Nudge>
                <span className="min-w-[4.25rem] text-center num text-[1.0625rem] font-semibold">
                  {moveMin != null ? t('activityMin', { n: moveMin }) : '—'}
                </span>
                <Nudge
                  onClick={() => setMinutes((moveMin ?? 0) + MOVE_STEP)}
                  label={t('activityMore')}
                  disabled={(moveMin ?? 0) >= MOVE_MAX}
                >
                  <PlusIcon size={16} />
                </Nudge>
              </div>
            </div>
            <div
              role="radiogroup"
              aria-labelledby="move-label"
              className="mt-3 flex flex-wrap gap-2"
            >
              {MINUTES.map((v) => {
                const on = moveMin === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMinutes(on ? null : v)}
                    className={cn(
                      'inline-flex h-10 items-center rounded-pill border-[1.5px] px-4 num text-[0.875rem] font-semibold transition-[background-color,border-color,color,scale] active:scale-95',
                      on
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink/20 bg-paper hover:border-ink',
                    )}
                  >
                    {t('activityMin', { n: v })}
                  </button>
                );
              })}
            </div>
            <AnimatePresence initial={false}>
              {moveMin != null && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : dur.md, ease: ease.out }}
                  className="overflow-hidden"
                >
                  <div
                    role="radiogroup"
                    aria-label={t('activityKind')}
                    className="flex flex-wrap gap-2 pt-2.5"
                  >
                    {(t.raw('activityKinds') as string[]).map((k) => {
                      const on = moveKind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => pickKind(k)}
                          className={cn(
                            'inline-flex h-9 items-center rounded-pill px-3.5 text-[0.8125rem] font-semibold transition-[background-color,scale] active:scale-95',
                            on ? 'bg-citrus text-ink' : 'bg-paper hover:bg-paper-3',
                          )}
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Tile>
        )}
      </div>
    </section>
  );
}

function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-well p-4', className)}>{children}</div>;
}

/** A tick that draws itself. */
function Tick({ on, size, reduced }: { on: boolean; size: number; reduced: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <motion.path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.28, ease: ease.out }}
      />
    </svg>
  );
}

function AddButton({
  onClick,
  label,
  title,
  amount,
  primary,
}: {
  onClick: () => void;
  label: string;
  title: string;
  amount: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-pill border-[1.5px] px-3 text-[0.875rem] font-semibold whitespace-nowrap transition-[background-color,border-color,scale] active:scale-95',
        primary
          ? 'border-ink bg-ink text-paper hover:bg-green'
          : 'border-ink/20 bg-paper hover:border-ink',
      )}
    >
      <PlusIcon size={16} />
      {title}
      <span className={cn('num text-[0.75rem] font-normal', primary ? 'text-sage' : 'text-ink-60')}>
        {amount}
      </span>
    </button>
  );
}

function Nudge({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full transition-[background-color,scale] hover:bg-ink/[0.07] active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
