'use client';

import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import { useDir, useFinePointer, useMotionLevel } from '@/lib/motion/hooks';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { ArticleSummary } from '@/types/content';
import { Ingredient } from './ingredients';
import { tints } from './recipe-card';

const PREVIEW = 176; // px, square
const GAP = 28; // distance between the pointer and the preview

/**
 * Guides as a magazine table of contents. On fine pointers an illustration "plate" trails the
 * cursor over the list — beside it (towards the inline end, below), never on top of the title
 * being read. Off for reduced motion / touch.
 */
export function GuidesIndex({
  articles,
  tone = 'light',
}: {
  articles: ArticleSummary[];
  tone?: 'light' | 'dark';
}) {
  const t = useTranslations('guides');
  const locale = useLocale() as Locale;
  const fine = useFinePointer();
  const level = useMotionLevel();
  const dir = useDir();
  const follow = fine && level === 'full';
  const [hover, setHover] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, spring.follow);
  const sy = useSpring(y, spring.follow);
  const dark = tone === 'dark';
  const current = articles.find((a) => a.id === hover);

  /** Preview position (container-relative, physical px) for the last known pointer. */
  const place = (jump: boolean) => {
    const el = root.current;
    const p = pointer.current;
    if (!el || !p) return;
    const r = el.getBoundingClientRect();
    const cx = p.x - r.left;
    const after = cx + GAP; // towards the right
    const before = cx - GAP - PREVIEW; // towards the left
    // Inline end first; flip to the other side when there is no room.
    let px = dir === 1 ? after : before;
    if (dir === 1 && px + PREVIEW > r.width) px = before;
    if (dir === -1 && px < 0) px = after;
    const py = Math.min(p.y - r.top + GAP * 0.5, r.height - PREVIEW);
    x.set(px);
    y.set(py);
    if (jump) {
      sx.jump(px);
      sy.jump(py);
    }
  };

  // Scrolling moves the list under a still pointer: keep the preview attached to the pointer.
  useEffect(() => {
    if (!follow || !hover) return;
    const onScroll = () => place(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, hover, dir]);

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(e) => {
        if (!follow) return;
        pointer.current = { x: e.clientX, y: e.clientY };
        place(true); // appear at the pointer, not fly in from the corner
      }}
      onPointerMove={(e) => {
        if (!follow) return;
        pointer.current = { x: e.clientX, y: e.clientY };
        place(false);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <ol className={cn('border-t-2', dark ? 'border-paper' : 'border-ink')}>
        {articles.map((a, i) => (
          <li
            key={a.id}
            className={cn('border-b', dark ? 'border-paper/20' : 'border-ink/20')}
            lang={a.contentLocale !== locale ? a.contentLocale : undefined}
          >
            <Link
              href={{ pathname: '/guides/[slug]', params: { slug: a.slug } }}
              onPointerEnter={() => setHover(a.id)}
              onFocus={() => setHover(a.id)}
              onBlur={() => setHover(null)}
              className="group/g grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 gap-y-1 py-6 sm:grid-cols-[3rem_1fr_auto_auto] sm:gap-x-6 lg:fine:grid-cols-[3rem_1fr_auto]"
            >
              <span className={cn('num text-[0.8125rem]', dark ? 'text-sage' : 'text-ink-60')}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-display text-[clamp(1.5rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.015em] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/g:translate-x-2 rtl:group-hover/g:-translate-x-2 ar:leading-[1.4] ar:font-bold ar:tracking-normal">
                {a.title}
              </span>
              <span
                className={cn(
                  'col-start-2 flex gap-3 text-[0.8125rem] sm:col-start-auto',
                  dark ? 'text-sage' : 'text-ink-60',
                )}
              >
                <span>{t(`categories.${a.category}` as 'categories.basics')}</span>
                <span aria-hidden>·</span>
                <span className="num">{t('readingTime', { count: a.readingMin })}</span>
              </span>
              {/* Touch screens have no pointer to trail a preview: show the illustration in the
                  row instead (desktop mice keep the floating preview). */}
              <span
                aria-hidden
                className={cn(
                  'col-start-3 row-span-2 row-start-1 grid size-14 place-items-center self-center rounded-[12px] sm:col-start-4 sm:row-span-1 sm:size-16 lg:fine:hidden',
                  tints[a.illustration] ?? 'bg-paper-2',
                )}
              >
                <Ingredient name={a.illustration} className="size-10 sm:size-12" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {follow && (
        // One element for the whole list (no stack of previews when moving fast). Physical
        // left/top: pointer coordinates are physical in RTL too.
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-10 hidden lg:block"
          style={{ x: sx, y: sy, left: 0, top: 0, width: PREVIEW, height: PREVIEW }}
          initial={false}
          animate={{
            opacity: current ? 1 : 0,
            scale: current ? 1 : 0.7,
            rotate: current ? 0 : dir * -6,
          }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className={cn(
              'grid size-full place-items-center overflow-hidden transition-colors duration-300',
              current ? (tints[current.illustration] ?? 'bg-paper-2') : 'bg-paper-2',
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {current && (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Ingredient name={current.illustration} className="size-32" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
