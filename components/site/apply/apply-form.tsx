'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { submitApplication } from '@/app/actions/leads';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/config';
import { ease, spring } from '@/lib/motion';
import { useDir, usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn, whatsappHref } from '@/lib/utils';
import {
  APPLY_CONDITIONS,
  APPLY_DURATIONS,
  APPLY_FORMATS,
  APPLY_GOALS,
  APPLY_STARTS,
  APPLY_TIMES,
} from '@/lib/validators/lead';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Field, TextArea } from '@/components/ui/field';
import { ArrowIcon, MotionButton } from '@/components/ui/motion-button';
import type { ActionState } from '@/components/ui/status-icon';
import { APPLIED_KEY } from '@/components/site/apply-prompt';
import { Ingredient } from '@/components/site/ingredients';

type Duration = (typeof APPLY_DURATIONS)[number];
type Condition = (typeof APPLY_CONDITIONS)[number];

interface Answers {
  duration: Duration | null;
  format: (typeof APPLY_FORMATS)[number] | null;
  start: (typeof APPLY_STARTS)[number] | null;
  goal: (typeof APPLY_GOALS)[number] | null;
  goalNote: string;
  sex: 'female' | 'male' | 'other' | null;
  age: string;
  heightCm: string;
  weightKg: string;
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null;
  conditions: Condition[];
  medications: string;
  allergies: string;
  priorDietitian: 'yes' | 'no' | null;
  name: string;
  phone: string;
  email: string;
  preferred: 'whatsapp' | 'phone' | 'email';
  contactTime: (typeof APPLY_TIMES)[number];
  message: string;
  terms: boolean;
  consent: boolean;
  website: string;
}

const EMPTY: Answers = {
  duration: null,
  format: null,
  start: null,
  goal: null,
  goalNote: '',
  sex: null,
  age: '',
  heightCm: '',
  weightKg: '',
  activity: null,
  conditions: [],
  medications: '',
  allergies: '',
  priorDietitian: null,
  name: '',
  phone: '',
  email: '',
  preferred: 'whatsapp',
  contactTime: 'any',
  message: '',
  terms: false,
  consent: false,
  website: '',
};

const STEPS = ['programme', 'about', 'health', 'contact'] as const;
type Step = (typeof STEPS)[number];
/** which step shows a field's error */
const FIELD_STEP: Record<string, Step> = {
  duration: 'programme',
  format: 'programme',
  start: 'programme',
  goal: 'about',
  goalNote: 'about',
  age: 'about',
  heightCm: 'about',
  weightKg: 'about',
  medications: 'health',
  allergies: 'health',
};
const MONTHS: Record<Duration, number> = { m3: 3, m6: 6, m12: 12 };
/** a drawing per goal, the same family as the home page's goal grid */
const GOAL_ART: Record<(typeof APPLY_GOALS)[number], string> = {
  energy: 'lemon',
  weight_down: 'cucumber',
  weight_up: 'walnut',
  regular: 'bread',
  sport: 'egg',
  family: 'tomato',
  health: 'apple',
};
/**
 * Unsent answers survive a reload (this tab only). Health answers and the confirmations are
 * never kept: they are typed again, or sent.
 */
const DRAFT_KEY = 'dm_apply_draft';
const NOT_KEPT = [
  'conditions',
  'medications',
  'allergies',
  'priorDietitian',
  'terms',
  'consent',
  'website',
] as const;
const num = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(v) ? v : null;
};

/**
 * Programme application ("Başvuru"): four short steps — the programme (at least three months;
 * there is no one-month option, and the form says why), the person, optional health background,
 * and how to reach them. Sent once, with consent, through the rate-limited lead intake; the
 * dietitian reads it in the panel under Requests.
 */
export function ApplyForm({ whatsapp }: { whatsapp: string }) {
  const t = useTranslations('apply');
  const tf = useTranslations('form');
  const locale = useLocale() as Locale;
  const dir = useDir();
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [heading, setHeading] = useState(1); // 1 forward, -1 back
  const [a, setA] = useState<Answers>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<ActionState>('idle');
  const [done, setDone] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  /** saved only once the visitor has changed something (never an empty form over a draft) */
  const touched = useRef(false);

  // the draft: read once after hydration, then kept up to date
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setA((x) => ({ ...x, ...(JSON.parse(raw) as Partial<Answers>) }));
    } catch {}
  }, []);
  useEffect(() => {
    if (!touched.current || done) return;
    try {
      const keep: Partial<Answers> = { ...a };
      for (const k of NOT_KEPT) delete keep[k];
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(keep));
    } catch {}
  }, [a, done]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => {
    touched.current = true;
    setA((x) => ({ ...x, [k]: v }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const rest = { ...e };
      delete rest[k as string];
      return rest;
    });
  };
  const msg = (code?: string) => (code ? tf(`errors.${code}` as 'errors.required') : undefined);

  /** what this step still needs (client-side, so the visitor never fills four steps in vain) */
  const missing = (s: Step): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 'programme') {
      if (!a.duration) e.duration = 'required';
      if (!a.format) e.format = 'required';
      if (!a.start) e.start = 'required';
    }
    if (s === 'about') {
      if (!a.goal) e.goal = 'required';
      const age = num(a.age);
      const h = num(a.heightCm);
      const w = num(a.weightKg);
      if (a.age && (age == null || age < 16 || age > 100)) e.age = 'range';
      if (a.heightCm && (h == null || h < 120 || h > 230)) e.heightCm = 'range';
      if (a.weightKg && (w == null || w < 35 || w > 300)) e.weightKg = 'range';
    }
    if (s === 'contact') {
      if (!a.name.trim()) e.name = 'required';
      if (!a.phone.trim() && !a.email.trim()) e.phone = 'contact';
      if (!a.terms) e.terms = 'terms';
      if (!a.consent) e.consent = 'consent';
    }
    return e;
  };

  const go = (to: number) => {
    setHeading(to > step ? 1 : -1);
    setStep(to);
    top.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  const next = () => {
    const e = missing(STEPS[step]!);
    if (Object.keys(e).length) return setErrors(e);
    go(step + 1);
  };

  const submit = async () => {
    const e = missing('contact');
    if (Object.keys(e).length) return setErrors(e);
    setState('loading');
    const res = await submitApplication({
      ...a,
      age: num(a.age),
      heightCm: num(a.heightCm),
      weightKg: num(a.weightKg),
      locale,
    }).catch(() => ({ ok: false as const, error: 'generic' as const }));
    if (res.ok) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
        localStorage.setItem(APPLIED_KEY, '1');
      } catch {}
      setState('success');
      window.setTimeout(() => setDone(true), 650);
      return;
    }
    const fe =
      'fieldErrors' in res && res.fieldErrors
        ? res.fieldErrors
        : { form: res.error === 'rateLimited' ? 'rateLimited' : 'generic' };
    setErrors(fe);
    // an error on an earlier step: take the visitor there
    const first = Object.keys(fe)
      .map((k) => FIELD_STEP[k])
      .find(Boolean);
    if (first) go(STEPS.indexOf(first));
    setState('error');
    window.setTimeout(() => setState('idle'), 1200);
  };

  if (done)
    return (
      <div
        className="scroll-mt-28"
        // the thank-you is the answer: bring it into view
        ref={(el) => el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })}
      >
        <Sent name={a.name} whatsapp={whatsapp} duration={a.duration!} />
      </div>
    );

  const s = STEPS[step]!;
  const slide = reduced ? 0 : 48 * dir;
  return (
    <div ref={top} className="scroll-mt-28">
      {/* the rail: where you are, what is left */}
      <ol className="grid grid-cols-4 gap-2" aria-label={t('stepsLabel')}>
        {STEPS.map((k, i) => (
          <li key={k}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => i < step && go(i)}
              aria-current={i === step ? 'step' : undefined}
              className="group block w-full text-start disabled:cursor-default"
            >
              <span className="relative block h-1 overflow-hidden rounded-pill bg-ink/12">
                <motion.span
                  className="absolute inset-0 origin-left rounded-pill bg-ink rtl:origin-right"
                  initial={false}
                  animate={{ scaleX: i < step ? 1 : i === step ? 0.5 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.6, ease: ease.out }}
                />
              </span>
              <span
                className={cn(
                  'mt-2.5 flex items-baseline gap-2 text-[0.8125rem] font-semibold transition-colors',
                  i <= step ? 'text-ink' : 'text-ink-60',
                )}
              >
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <span className="hidden truncate sm:inline">{t(`steps.${k}`)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="relative mt-10 min-h-[24rem]">
        <AnimatePresence mode="wait" initial={false} custom={heading}>
          <motion.section
            key={s}
            custom={heading}
            initial={{ opacity: 0, x: slide * heading }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slide * heading }}
            transition={{ duration: reduced ? 0.12 : 0.38, ease: ease.out }}
            aria-labelledby={`apply-${s}`}
          >
            <h2 id={`apply-${s}`} className="font-display text-display-md ar:font-bold">
              {t(`${s}.title`)}
            </h2>
            <p className="mt-3 max-w-2xl text-lead text-ink-70">{t(`${s}.lead`)}</p>

            <div
              className="mt-10 grid gap-10"
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
                if (e.target.type === 'checkbox') return;
                e.preventDefault();
                if (step < STEPS.length - 1) next();
                else void submit();
              }}
            >
              {s === 'programme' && (
                <>
                  <Question label={t('programme.duration')} error={msg(errors.duration)}>
                    <Durations value={a.duration} onChange={(v) => set('duration', v)} />
                  </Question>
                  <Question label={t('programme.format')} error={msg(errors.format)}>
                    <Chips
                      options={APPLY_FORMATS}
                      value={a.format}
                      label={(k) => t(`formats.${k}`)}
                      onChange={(v) => set('format', v)}
                    />
                  </Question>
                  <Question label={t('programme.start')} error={msg(errors.start)}>
                    <Chips
                      options={APPLY_STARTS}
                      value={a.start}
                      label={(k) => t(`starts.${k}`)}
                      onChange={(v) => set('start', v)}
                    />
                  </Question>
                </>
              )}

              {s === 'about' && (
                <>
                  <Question label={t('about.goal')} error={msg(errors.goal)}>
                    <GoalTiles value={a.goal} onChange={(v) => set('goal', v)} />
                  </Question>
                  <TextArea
                    label={t('about.goalNote')}
                    rows={3}
                    maxLength={600}
                    value={a.goalNote}
                    onChange={(e) => set('goalNote', e.target.value)}
                    error={msg(errors.goalNote)}
                  />
                  <Question label={t('about.sex')} optional={t('optional')}>
                    <Chips
                      options={['female', 'male', 'other'] as const}
                      value={a.sex}
                      label={(k) => t(`sexes.${k}`)}
                      onChange={(v) => set('sex', a.sex === v ? null : v)}
                    />
                  </Question>
                  <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
                    <Field
                      label={t('about.age')}
                      inputMode="numeric"
                      value={a.age}
                      onChange={(e) => set('age', e.target.value)}
                      error={msg(errors.age)}
                    />
                    <Field
                      label={t('about.height')}
                      inputMode="decimal"
                      suffix="cm"
                      value={a.heightCm}
                      onChange={(e) => set('heightCm', e.target.value)}
                      error={msg(errors.heightCm)}
                    />
                    <Field
                      label={t('about.weight')}
                      inputMode="decimal"
                      suffix="kg"
                      value={a.weightKg}
                      onChange={(e) => set('weightKg', e.target.value)}
                      error={msg(errors.weightKg)}
                    />
                  </div>
                  <Question label={t('about.activity')} optional={t('optional')}>
                    <Chips
                      options={['sedentary', 'light', 'moderate', 'active', 'very_active'] as const}
                      value={a.activity}
                      label={(k) => t(`activities.${k}`)}
                      onChange={(v) => set('activity', a.activity === v ? null : v)}
                    />
                  </Question>
                </>
              )}

              {s === 'health' && (
                <>
                  <Question label={t('health.conditions')} optional={t('optional')}>
                    <div className="flex flex-wrap gap-2">
                      {APPLY_CONDITIONS.map((k) => (
                        <Chip
                          key={k}
                          selected={a.conditions.includes(k)}
                          onToggle={() =>
                            set(
                              'conditions',
                              a.conditions.includes(k)
                                ? a.conditions.filter((x) => x !== k)
                                : [...a.conditions, k],
                            )
                          }
                        >
                          {t(`conditions.${k}`)}
                        </Chip>
                      ))}
                    </div>
                  </Question>
                  <TextArea
                    label={t('health.medications')}
                    rows={2}
                    maxLength={600}
                    value={a.medications}
                    onChange={(e) => set('medications', e.target.value)}
                    error={msg(errors.medications)}
                  />
                  <TextArea
                    label={t('health.allergies')}
                    rows={2}
                    maxLength={600}
                    value={a.allergies}
                    onChange={(e) => set('allergies', e.target.value)}
                    error={msg(errors.allergies)}
                  />
                  <Question label={t('health.prior')} optional={t('optional')}>
                    <Chips
                      options={['yes', 'no'] as const}
                      value={a.priorDietitian}
                      label={(k) => t(`yesNo.${k}`)}
                      onChange={(v) => set('priorDietitian', a.priorDietitian === v ? null : v)}
                    />
                  </Question>
                  <p className="max-w-2xl border-s-2 border-paprika ps-4 text-[0.875rem] leading-relaxed text-ink-70">
                    {t('health.privacy')}
                  </p>
                </>
              )}

              {s === 'contact' && (
                <>
                  <Field
                    label={tf('name')}
                    value={a.name}
                    autoComplete="name"
                    onChange={(e) => set('name', e.target.value)}
                    error={msg(errors.name)}
                  />
                  <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
                    <Field
                      label={tf('phone')}
                      type="tel"
                      dir="ltr"
                      autoComplete="tel"
                      value={a.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      error={msg(errors.phone)}
                    />
                    <Field
                      label={tf('email')}
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      value={a.email}
                      onChange={(e) => set('email', e.target.value)}
                      error={msg(errors.email)}
                    />
                  </div>
                  <Question label={tf('preferred')}>
                    <Chips
                      options={['whatsapp', 'phone', 'email'] as const}
                      value={a.preferred}
                      label={(k) =>
                        tf(
                          k === 'whatsapp'
                            ? 'preferredWhatsapp'
                            : k === 'phone'
                              ? 'preferredPhone'
                              : 'preferredEmail',
                        )
                      }
                      onChange={(v) => set('preferred', v)}
                    />
                  </Question>
                  <Question label={t('contact.time')}>
                    <Chips
                      options={APPLY_TIMES}
                      value={a.contactTime}
                      label={(k) => t(`times.${k}`)}
                      onChange={(v) => set('contactTime', v)}
                    />
                  </Question>
                  <TextArea
                    label={t('contact.message')}
                    rows={4}
                    maxLength={2000}
                    value={a.message}
                    onChange={(e) => set('message', e.target.value)}
                    error={msg(errors.message)}
                  />
                  <div aria-hidden className="sr-only">
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={a.website}
                      onChange={(e) => set('website', e.target.value)}
                    />
                  </div>
                  <Summary answers={a} onEdit={(i) => go(i)} />
                  <div className="grid gap-5 border-t-2 border-ink pt-6">
                    <Checkbox
                      label={<span className="font-semibold">{t('contact.terms')}</span>}
                      checked={a.terms}
                      onChange={(e) => set('terms', e.target.checked)}
                      error={msg(errors.terms)}
                    />
                    <Checkbox
                      label={
                        <span>
                          {t('contact.consent')}{' '}
                          <Link
                            href="/legal/kvkk"
                            className="font-semibold underline"
                            target="_blank"
                          >
                            {tf('consentLink')}
                          </Link>
                        </span>
                      }
                      checked={a.consent}
                      onChange={(e) => set('consent', e.target.checked)}
                      error={msg(errors.consent)}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      {errors.form && (
        <p role="alert" className="mt-6 text-ui font-semibold text-paprika-deep">
          {msg(errors.form)}
        </p>
      )}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-ink/15 pt-6">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="inline-flex h-12 items-center gap-2 rounded-pill px-2 text-ui font-semibold text-ink-70 hover:text-ink"
          >
            <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
            {t('back')}
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <MotionButton type="button" size="lg" onClick={next} icon={<ArrowIcon />}>
            {t('next')}
          </MotionButton>
        ) : (
          <MotionButton
            type="button"
            tone="paprika"
            size="lg"
            state={state}
            disabled={state === 'loading'}
            onClick={submit}
          >
            {t('send')}
          </MotionButton>
        )}
      </div>
    </div>
  );
}

// ---- pieces ------------------------------------------------------------------------------------

/** Goals as drawn tiles: the choice is easier to make at a glance than in a row of words. */
function GoalTiles({
  value,
  onChange,
}: {
  value: Answers['goal'];
  onChange: (v: (typeof APPLY_GOALS)[number]) => void;
}) {
  const t = useTranslations('apply');
  const reduced = usePrefersReducedMotion();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
      {APPLY_GOALS.map((k) => {
        const on = value === k;
        return (
          <motion.button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k)}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            className={cn(
              'group relative flex min-h-28 flex-col justify-between gap-3 overflow-hidden rounded-[16px] border-[1.5px] p-3.5 text-start transition-colors duration-200',
              on ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink',
            )}
          >
            <motion.span
              aria-hidden
              className="block size-16 self-end"
              animate={
                on && !reduced
                  ? { rotate: [0, -12, 8, 0], scale: [1, 1.15, 1] }
                  : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.5, ease: ease.out }}
            >
              <Ingredient name={GOAL_ART[k]} className="size-full" />
            </motion.span>
            <span className="text-[0.875rem] leading-snug font-semibold">{t(`goals.${k}`)}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** What will be sent, with a way back to each step — read before the last tap. */
function Summary({ answers: a, onEdit }: { answers: Answers; onEdit: (step: number) => void }) {
  const t = useTranslations('apply');
  const rows: { label: string; value: string; step: number }[] = [
    {
      label: t('summary.programme'),
      value: [
        a.duration && t(`durations.${a.duration}`),
        a.format && t(`formats.${a.format}`),
        a.start && t(`starts.${a.start}`),
      ]
        .filter(Boolean)
        .join(' · '),
      step: 0,
    },
    {
      label: t('summary.goal'),
      value: [
        a.goal && t(`goals.${a.goal}`),
        a.heightCm && `${a.heightCm} cm`,
        a.weightKg && `${a.weightKg} kg`,
      ]
        .filter(Boolean)
        .join(' · '),
      step: 1,
    },
    {
      label: t('summary.health'),
      value: a.conditions.length
        ? a.conditions.map((c) => t(`conditions.${c}`)).join(', ')
        : t('summary.none'),
      step: 2,
    },
  ];
  return (
    <section aria-label={t('summary.title')} className="rounded-[18px] bg-paper-2 p-5">
      <p className="label text-ink-60">{t('summary.title')}</p>
      <dl className="mt-3 grid gap-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-3 text-[0.9375rem] sm:grid-cols-[8rem_1fr_auto]"
          >
            <dt className="text-[0.8125rem] font-semibold text-ink-60">{r.label}</dt>
            <dd className="min-w-0 break-words">{r.value || '—'}</dd>
            <dd>
              <button
                type="button"
                onClick={() => onEdit(r.step)}
                className="text-[0.8125rem] font-semibold underline underline-offset-4 hover:text-paprika-deep"
              >
                {t('summary.edit')}
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Question({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-4 text-[1.0625rem] font-semibold">
        {label}
        {optional && (
          <span className="ms-2 text-[0.8125rem] font-normal text-ink-60">{optional}</span>
        )}
      </legend>
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            role="alert"
            className="mt-3 text-[0.875rem] font-semibold text-paprika-deep"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </fieldset>
  );
}

function Chips<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T | null;
  label: (k: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((k) => (
        <Chip key={k} selected={value === k} onToggle={() => onChange(k)}>
          {label(k)}
        </Chip>
      ))}
    </div>
  );
}

/**
 * Programme length as months on a calendar strip: 3, 6 or 12 — and a crossed-out single month,
 * because a lasting change does not happen in four weeks.
 */
function Durations({
  value,
  onChange,
}: {
  value: Duration | null;
  onChange: (d: Duration) => void;
}) {
  const t = useTranslations('apply');
  const reduced = usePrefersReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* the option that does not exist, on purpose */}
      <div
        aria-hidden
        className="relative flex min-h-40 flex-col justify-between overflow-hidden rounded-[18px] border-[1.5px] border-dashed border-ink/25 p-5 text-ink-60"
      >
        <span className="font-display text-[2.5rem] leading-none line-through decoration-paprika decoration-[3px] ar:font-bold">
          {t('durations.m1')}
        </span>
        <span className="text-[0.8125rem] leading-snug">{t('noMonth')}</span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full text-paprika/50"
        >
          <motion.line
            x1="4"
            y1="96"
            x2="96"
            y2="4"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: reduced ? 1 : 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: ease.inOut, delay: 0.2 }}
          />
        </svg>
      </div>
      {APPLY_DURATIONS.map((d) => {
        const on = value === d;
        const n = MONTHS[d];
        return (
          <motion.button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(d)}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            className={cn(
              'relative flex min-h-40 flex-col justify-between rounded-[18px] border-[1.5px] p-5 text-start transition-colors duration-200',
              on ? 'border-ink bg-ink text-paper' : 'border-ink/25 hover:border-ink',
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="font-display text-[2.5rem] leading-none ar:font-bold">
                {t(`durations.${d}`)}
              </span>
              {d === 'm3' && (
                <span
                  className={cn(
                    'rounded-pill px-2.5 py-1 label text-[0.625rem]',
                    on ? 'bg-citrus text-ink' : 'bg-ink/8 text-ink-70',
                  )}
                >
                  {t('minimum')}
                </span>
              )}
            </span>
            {/* one cell per month, filling in when chosen */}
            <span className="mt-6 grid grid-cols-12 gap-1" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'relative h-2.5 overflow-hidden rounded-[3px]',
                    on ? 'bg-paper/15' : 'bg-ink/10',
                  )}
                >
                  {i < n && (
                    <motion.span
                      className={cn(
                        'absolute inset-0 origin-bottom',
                        on ? 'bg-citrus' : 'bg-ink/45',
                      )}
                      // re-keyed when chosen: the months fill in one after another
                      key={on ? 'on' : 'off'}
                      initial={{ scaleY: reduced || !on ? 1 : 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: reduced ? 0 : i * 0.04, duration: 0.3, ease: ease.out }}
                    />
                  )}
                </span>
              ))}
            </span>
            <span
              className={cn(
                'mt-3 text-[0.8125rem] leading-snug',
                on ? 'text-paper/80' : 'text-ink-60',
              )}
            >
              {t(`durationHints.${d}`)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Sent({
  name,
  whatsapp,
  duration,
}: {
  name: string;
  whatsapp: string;
  duration: Duration;
}) {
  const t = useTranslations('apply.sent');
  const ta = useTranslations('apply');
  const reduced = usePrefersReducedMotion();
  const first = name.trim().split(/\s+/)[0] ?? '';
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: ease.out }}
      className="relative overflow-hidden rounded-[28px] bg-ink p-8 text-paper sm:p-12"
    >
      <motion.svg
        viewBox="0 0 120 120"
        className="size-20 text-citrus"
        aria-hidden
        initial={{ rotate: reduced ? 0 : -40, scale: reduced ? 1 : 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={spring.soft}
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          opacity=".25"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: ease.inOut }}
          style={{ rotate: -90, transformOrigin: '60px 60px' }}
        />
        <motion.path
          d="M38 62l15 15 30-32"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: reduced ? 0 : 0.7, ease: ease.out }}
        />
      </motion.svg>
      <p className="mt-8 font-display text-display-md text-citrus ar:font-bold">
        {t('title', { name: first })}
      </p>
      <p className="mt-4 max-w-xl text-lead text-paper/80">
        {t('body', { duration: ta(`durations.${duration}`) })}
      </p>
      <a
        href={whatsappHref(whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex h-12 items-center gap-2 rounded-pill border border-paper/30 px-5 text-ui font-semibold hover:bg-paper hover:text-ink"
      >
        {t('whatsapp')}
      </a>
    </motion.div>
  );
}
