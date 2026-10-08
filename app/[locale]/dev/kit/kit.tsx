'use client';

import { motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { dur, ease, spring, stagger } from '@/lib/motion';
import { useMotionLevel } from '@/lib/motion/hooks';
import { cn, upper } from '@/lib/utils';
import { MacroRings } from '@/components/site/macro-rings';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Field, TextArea } from '@/components/ui/field';
import { IconButton, Skeleton, Tooltip } from '@/components/ui/misc';
import {
  ArrowIcon,
  MotionButton,
  type ButtonTone,
  type ButtonVariant,
} from '@/components/ui/motion-button';
import { Overlay } from '@/components/ui/overlay';
import type { ActionState } from '@/components/ui/status-icon';
import { Tabs } from '@/components/ui/tabs';
import { Ticker } from '@/components/ui/ticker';

// Dev-only surface: copy here is deliberately English and not translated.

const SWATCHES: {
  group: string;
  items: { name: string; hex: string; note?: string; dark?: boolean }[];
}[] = [
  {
    group: 'Surfaces & ink',
    items: [
      { name: 'paper', hex: '#F3EEE4', note: 'ink 16.1:1' },
      { name: 'paper-2', hex: '#E8E0D0' },
      { name: 'paper-3', hex: '#DCD2BE' },
      { name: 'ink', hex: '#0F1B17', dark: true },
      { name: 'ink-70', hex: '#3B4843', dark: true },
      { name: 'ink-60', hex: '#4A5550', dark: true, note: 'on paper 7.0:1' },
      { name: 'green', hex: '#123B2E', dark: true },
      { name: 'green-2', hex: '#1B4D3D', dark: true },
      { name: 'sage', hex: '#B9C4BE' },
    ],
  },
  {
    group: 'Accents (rules in DESIGN.md)',
    items: [
      { name: 'citrus', hex: '#D8F24A', note: 'only on dark' },
      { name: 'paprika', hex: '#FF5B36', note: 'text only on ink' },
      { name: 'paprika-deep', hex: '#B23114', dark: true, note: 'on paper 5.4:1' },
      { name: 'mustard', hex: '#E9B949' },
    ],
  },
  {
    group: 'Macros',
    items: [
      { name: 'protein', hex: '#FF5B36' },
      { name: 'protein-on-light', hex: '#D9431F', dark: true },
      { name: 'carb', hex: '#D8F24A' },
      { name: 'carb-on-light', hex: '#6F8A12', dark: true },
      { name: 'fat', hex: '#E9B949' },
      { name: 'fat-on-light', hex: '#A87A12', dark: true },
      { name: 'fiber', hex: '#B9C4BE' },
    ],
  },
];

function Block({
  id,
  title,
  children,
  dark,
}: {
  id: string;
  title: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={cn(
        'border-t py-14',
        dark ? 'on-dark border-transparent bg-ink grain text-paper' : 'border-ink/15',
      )}
    >
      <div className="container-x">
        <h2 id={`${id}-h`} className="mb-8 label opacity-70">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[180px_1fr] md:items-center">
      <p className="num text-[0.75rem] opacity-60">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const STATES: ActionState[] = ['idle', 'loading', 'success', 'error'];

export function Kit() {
  const locale = useLocale();
  const level = useMotionLevel();
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [chips, setChips] = useState<string[]>(['quick']);
  const [checked, setChecked] = useState(true);
  const [sw, setSw] = useState(false);
  const [ticker, setTicker] = useState(1840);
  const [dialog, setDialog] = useState<null | 'center' | 'end' | 'bottom'>(null);
  const [demo, setDemo] = useState<ActionState>('idle');

  const cycle = () => {
    setDemo('loading');
    window.setTimeout(() => setDemo(Math.random() > 0.5 ? 'success' : 'error'), 900);
    window.setTimeout(() => setDemo('idle'), 2200);
  };

  return (
    <main id="main" className="pt-32 pb-24">
      <header className="container-x mb-10">
        <p className="mb-3 label text-paprika-deep">
          /dev/kit · {locale} · motion: {level}
        </p>
        <h1 className="font-display text-display-lg">Kinetic Kitchen kit</h1>
        <p className="mt-4 max-w-2xl text-lead text-ink-70">
          Tokens, primitives in every state, and motion presets. Development only — this route 404s
          in production.
        </p>
      </header>

      <Block id="tokens" title="01 · Colour tokens">
        <div className="space-y-10">
          {SWATCHES.map((g) => (
            <div key={g.group}>
              <p className="mb-3 text-ui font-semibold">{g.group}</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {g.items.map((s) => (
                  <li key={s.name} className="overflow-hidden rounded-[14px] border border-ink/10">
                    <div
                      className={cn('flex h-20 items-end p-3', s.dark ? 'text-paper' : 'text-ink')}
                      style={{ background: s.hex }}
                    >
                      <span className="num text-[0.75rem]">Aa 123</span>
                    </div>
                    <div className="bg-paper p-3">
                      <p className="text-[0.875rem] font-semibold">{s.name}</p>
                      <p className="num text-[0.6875rem] text-ink-60" dir="ltr">
                        {s.hex}
                        {s.note ? ` · ${s.note}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Block>

      <Block id="type" title="02 · Type (active script)">
        <div className="space-y-6">
          <p className="font-display text-display-xl">Tabakta başlar.</p>
          <p className="font-display text-display-md">
            İyi beslenme · Good food · Bien manger · التغذية الجيدة
          </p>
          <p className="max-w-2xl text-lead">
            Lead — Yasak listesi değil, senin hayatına uyan bir plan.
          </p>
          <p className="max-w-2xl text-body">
            Body — Porsiyonlar, sıklık ve sevdiğin yemekler üzerine konuşarak ilerleriz. Rakamlar:
            1.629 kcal · 93 g.
          </p>
          <p className="label">Label · {upper('İğdır şeker çöğüş', locale)}</p>
          <p className="text-[0.8125rem] text-ink-60" dir="ltr">
            Locale casing test: toLocaleUpperCase(&apos;{locale}&apos;) of “İğdır şeker çöğüş” →{' '}
            {upper('İğdır şeker çöğüş', locale)} (tr must keep dotted İ; en would produce “IĞDIR”).
          </p>
          <div className="flex flex-wrap items-end gap-8">
            <p className="num-display text-num-xl">1.800</p>
            <p className="num text-[1.5rem]">93 / 90 g</p>
            <MacroRings protein={30} carb={45} fat={25} size={96} />
          </div>
        </div>
      </Block>

      <Block id="buttons" title="03 · MotionButton — variants × tones × states">
        {(['fill', 'outline', 'text'] as ButtonVariant[]).map((v) => (
          <Row key={v} label={`variant=${v}`}>
            {(['ink', 'paprika'] as ButtonTone[]).map((t) => (
              <MotionButton
                key={t}
                variant={v}
                tone={t}
                icon={<ArrowIcon className="mirror-rtl" />}
              >
                {t}
              </MotionButton>
            ))}
            <MotionButton variant={v} disabled>
              disabled
            </MotionButton>
          </Row>
        ))}
        <Row label="state">
          {STATES.map((s) => (
            <MotionButton key={s} state={s}>
              {s}
            </MotionButton>
          ))}
        </Row>
        <Row label="effect">
          <MotionButton effect="wipe">wipe</MotionButton>
          <MotionButton effect="roll" variant="outline">
            roll
          </MotionButton>
          <MotionButton effect="magnetic" tone="paprika">
            magnetic
          </MotionButton>
          <MotionButton state={demo} onClick={cycle} variant="outline">
            click → loading → result
          </MotionButton>
        </Row>
        <Row label="size">
          <MotionButton size="sm">sm</MotionButton>
          <MotionButton size="md">md</MotionButton>
          <MotionButton size="lg">lg</MotionButton>
        </Row>
      </Block>

      <Block id="buttons-dark" title="04 · On dark" dark>
        <Row label="tones">
          <MotionButton tone="citrus">citrus</MotionButton>
          <MotionButton tone="paper" variant="outline">
            paper outline
          </MotionButton>
          <MotionButton tone="citrus" state="loading">
            loading
          </MotionButton>
          <MotionButton tone="citrus" disabled>
            disabled
          </MotionButton>
        </Row>
        <div className="grid max-w-3xl grid-cols-1 gap-6 pt-4 md:grid-cols-2">
          <Field label="Field (dark)" tone="dark" hint="Hint text" />
          <Field label="Error (dark)" tone="dark" error="This field is required" />
        </div>
      </Block>

      <Block id="fields" title="05 · Fields, checkbox, switch">
        <div className="grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Rest" />
          <Field label="With hint" hint="We only use this to reply." />
          <Field label="Valid" defaultValue="Ayşe" valid />
          <Field label="Error" defaultValue="x" error="Please enter a valid email" />
          <Field label="Disabled" disabled defaultValue="Read-only value" />
          <Field
            label="Suffix"
            suffix={<span className="num text-ink-60">kg</span>}
            inputMode="decimal"
          />
          <TextArea label="Textarea" rows={3} className="md:col-span-2" />
        </div>
        <div className="mt-8 flex flex-wrap gap-10">
          <Checkbox
            label="Checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <Checkbox label="With error" error="Consent is required" />
          <Checkbox label="Disabled" disabled />
          <Switch
            checked={sw}
            onCheckedChange={setSw}
            label="Switch"
            description="Description line"
          />
          <Switch checked disabled onCheckedChange={() => {}} label="Disabled on" />
        </div>
      </Block>

      <Block id="nav" title="06 · Tabs, chips, icon buttons, tooltip">
        <Row label="tabs pill">
          <Tabs
            label="demo"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'a', label: 'Kahvaltı', count: 4 },
              { value: 'b', label: 'Öğle' },
              { value: 'c', label: 'Akşam' },
            ]}
          />
        </Row>
        <Row label="tabs line">
          <Tabs
            variant="line"
            label="demo line"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'a', label: 'Genel' },
              { value: 'b', label: 'Ölçümler' },
              { value: 'c', label: 'Notlar' },
            ]}
          />
        </Row>
        <Row label="tabs sm">
          <Tabs
            size="sm"
            label="demo sm"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'a', label: '1. gün' },
              { value: 'b', label: '2. gün' },
              { value: 'c', label: '3. gün' },
            ]}
          />
        </Row>
        <Row label="chips (magnetic)">
          {['quick', 'high_protein', 'vegetarian', 'under_400'].map((c, i) => (
            <Chip
              key={c}
              selected={chips.includes(c)}
              count={i * 3 + 2}
              onToggle={() =>
                setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))
              }
            >
              {c}
            </Chip>
          ))}
          <Chip selected={false} disabled onToggle={() => {}}>
            disabled
          </Chip>
        </Row>
        <Row label="icon button + tooltip">
          <Tooltip content="Favourite">
            <IconButton label="Favourite">
              <svg
                viewBox="0 0 24 24"
                width={18}
                height={18}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
              </svg>
            </IconButton>
          </Tooltip>
          <IconButton label="Active" active>
            <ArrowIcon className="mirror-rtl" />
          </IconButton>
          <IconButton label="Small" size="sm">
            <ArrowIcon className="mirror-rtl" size={14} />
          </IconButton>
          <IconButton label="Disabled" disabled>
            <ArrowIcon className="mirror-rtl" />
          </IconButton>
        </Row>
      </Block>

      <Block id="feedback" title="07 · Overlays, toast, skeleton, ticker">
        <Row label="overlay">
          <MotionButton variant="outline" onClick={() => setDialog('center')}>
            Dialog
          </MotionButton>
          <MotionButton variant="outline" onClick={() => setDialog('end')}>
            Sheet (end)
          </MotionButton>
          <MotionButton variant="outline" onClick={() => setDialog('bottom')}>
            Sheet (bottom)
          </MotionButton>
        </Row>
        <Row label="toast">
          <MotionButton variant="outline" onClick={() => toast.success('Saved')}>
            success
          </MotionButton>
          <MotionButton variant="outline" onClick={() => toast.error('Something went wrong')}>
            error
          </MotionButton>
        </Row>
        <Row label="skeleton">
          <div className="w-full max-w-md space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </Row>
        <Row label="ticker">
          <p className="num-display text-display-md">
            <Ticker value={ticker} suffix=" kcal" />
          </p>
          <MotionButton
            size="sm"
            variant="outline"
            onClick={() => setTicker((v) => v + Math.round(Math.random() * 400 - 200))}
          >
            change
          </MotionButton>
        </Row>
        <Overlay
          open={dialog !== null}
          onOpenChange={(o) => !o && setDialog(null)}
          side={dialog ?? 'center'}
          title="Overlay title"
          description="Focus is trapped; Esc closes; direction-aware in RTL."
        >
          <p className="text-body">Body content.</p>
        </Overlay>
      </Block>

      <Block id="motion" title="08 · Motion presets">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {(Object.keys(ease) as (keyof typeof ease)[]).map((k) => (
            <EaseCurve key={k} name={k} curve={ease[k]} />
          ))}
        </div>
        <div className="mt-10 space-y-3">
          {(Object.keys(dur) as (keyof typeof dur)[]).map((k) => (
            <DurationBar key={k} name={k} seconds={dur[k]} />
          ))}
        </div>
        <p className="mt-8 num text-[0.75rem] text-ink-60" dir="ltr">
          stagger word {stagger.word}s · char {stagger.char}s · item {stagger.item}s — springs:
          snappy {spring.snappy.stiffness}/{spring.snappy.damping}, soft {spring.soft.stiffness}/
          {spring.soft.damping}, magnet {spring.magnet.stiffness}/{spring.magnet.damping}
        </p>
      </Block>
    </main>
  );
}

function EaseCurve({
  name,
  curve,
}: {
  name: string;
  curve: readonly [number, number, number, number];
}) {
  const [x1, y1, x2, y2] = curve;
  const [run, setRun] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setRun((r) => r + 1)}
      className="rounded-[14px] border border-ink/15 p-4 text-start transition-colors hover:bg-paper-2"
    >
      <svg viewBox="-0.05 -0.25 1.1 1.5" className="h-32 w-full" aria-hidden>
        <path
          d={`M0 1 C${x1} ${1 - y1} ${x2} ${1 - y2} 1 0`}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.02}
        />
        <line
          x1={0}
          y1={1}
          x2={1}
          y2={1}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={0.01}
        />
      </svg>
      <div className="mt-2 h-2 overflow-hidden rounded-pill bg-paper-2">
        <motion.div
          key={run}
          className="h-full origin-left rounded-pill bg-ink rtl:origin-right"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, ease: curve as unknown as [number, number, number, number] }}
        />
      </div>
      <p className="mt-2 num text-[0.75rem]" dir="ltr">
        ease.{name} [{curve.join(', ')}]
      </p>
    </button>
  );
}

function DurationBar({ name, seconds }: { name: string; seconds: number }) {
  const [run, setRun] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setRun((r) => r + 1)}
      className="grid w-full grid-cols-[120px_1fr] items-center gap-4 text-start"
    >
      <span className="num text-[0.75rem]" dir="ltr">
        dur.{name} {seconds}s
      </span>
      <span className="h-3 overflow-hidden rounded-pill bg-paper-2">
        <motion.span
          key={run}
          className="block h-full origin-left rounded-pill bg-paprika-deep rtl:origin-right"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: seconds, ease: ease.out }}
        />
      </span>
    </button>
  );
}
