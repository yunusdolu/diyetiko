'use client';

import { motion, useSpring } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { ViewTransition, useRef, useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import { FAVORITES_KEY, useStoredIds } from '@/lib/local-store';
import { useFinePointer, useMotionLevel } from '@/lib/motion/hooks';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { RecipeSummary } from '@/types/content';
import { Ingredient } from './ingredients';
import { MacroRings } from './macro-rings';

/** Card tints per illustration — pale food colours, always carrying ink text. */
export const tints: Record<string, string> = {
  tomato: 'bg-[#f3cfc2]',
  lentil: 'bg-[#f2d3b8]',
  pomegranate: 'bg-[#efc9c6]',
  fish: 'bg-[#cfdcd8]',
  oats: 'bg-[#eadfc4]',
  olive: 'bg-[#d8dcbb]',
  pepper: 'bg-[#d6e2b6]',
  mushroom: 'bg-[#e6d8c2]',
  egg: 'bg-[#f2e3b0]',
  chickpea: 'bg-[#ecdcbc]',
  lemon: 'bg-[#e4eda8]',
  apple: 'bg-[#f0cbc0]',
  onion: 'bg-[#e6ccd6]',
  cucumber: 'bg-[#d3e3c3]',
  fig: 'bg-[#e8cdd0]',
  bread: 'bg-[#eddcbd]',
  walnut: 'bg-[#e6d6bf]',
  carrot: 'bg-[#f3d4b8]',
  avocado: 'bg-[#d9e3b8]',
  yogurt: 'bg-[#dbe3dd]',
  garlic: 'bg-[#ece6d6]',
};

export function FavoriteButton({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const t = useTranslations('recipes.favorites');
  const fav = useStoredIds(FAVORITES_KEY);
  const on = fav.has(id);
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      aria-label={`${on ? t('remove') : t('add')}: ${title}`}
      title={on ? t('remove') : t('add')}
      onClick={() => fav.toggle(id)}
      whileTap={{ scale: 0.82 }}
      transition={spring.snappy}
      className={cn(
        'relative z-10 grid size-10 place-items-center rounded-pill bg-paper/90 text-ink transition-colors hover:bg-paper',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <motion.path
          d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          animate={{
            fill: on ? 'var(--color-paprika)' : 'rgba(0,0,0,0)',
            scale: on ? [1, 1.25, 1] : 1,
          }}
          style={{ transformOrigin: '12px 13px' }}
          transition={{ duration: 0.35 }}
        />
      </svg>
    </motion.button>
  );
}

export function RecipeCard({
  recipe,
  size = 'md',
  priority,
  className,
}: {
  recipe: RecipeSummary;
  size?: 'md' | 'lg';
  priority?: boolean;
  className?: string;
}) {
  const t = useTranslations('recipes.card');
  const tc = useTranslations('cursor');
  const td = useTranslations('diet');
  const locale = useLocale() as Locale;
  const fine = useFinePointer();
  const level = useMotionLevel();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  // Where the data layer grows from / shrinks to: the point the pointer entered / left.
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  // Tilt runs on motion values: no React re-render per pointer move.
  const rx = useSpring(0, spring.soft);
  const ry = useSpring(0, spring.soft);
  const kcal = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(
    recipe.kcal,
  );
  const minutes = recipe.prepMin + recipe.cookMin;
  const interactive = fine && level === 'full';
  const visibleTags = recipe.tags.filter((x) => x !== 'dairy_free').slice(0, 3);

  // Pointer position over the image, clamped to it (the pointer may be over the text below).
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return { px: clamp((e.clientX - r.left) / r.width), py: clamp((e.clientY - r.top) / r.height) };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!interactive || !ref.current) return;
    const { px, py } = at(e);
    rx.set((0.5 - py) * 6);
    ry.set((px - 0.5) * 8);
  };
  const onEnter = (e: React.PointerEvent) => {
    if (interactive && ref.current) {
      const { px, py } = at(e);
      setOrigin({ x: px * 100, y: py * 100 });
    }
    setHover(true);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (interactive && ref.current) {
      const { px, py } = at(e);
      setOrigin({ x: px * 100, y: py * 100 });
    }
    rx.set(0);
    ry.set(0);
    setHover(false);
  };

  return (
    // Hover handlers live on the article, not the image: the title link is stretched over the
    // whole card (after:inset-0), so the pointer is always over the link, never the image div.
    <article
      className={cn('group/card relative', className)}
      lang={recipe.contentLocale !== locale ? recipe.contentLocale : undefined}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <ViewTransition name={`recipe-${recipe.id}`} share="morph" default="none">
        <div
          ref={ref}
          // the cursor label ("Pişirelim") shows over the image only; the image turns dark on
          // hover (data layer), so the label disc switches to citrus
          data-cursor={tc('recipe')}
          data-cursor-dark={interactive ? '' : undefined}
          className={cn(
            'relative overflow-hidden',
            tints[recipe.illustration] ?? 'bg-paper-2',
            size === 'lg' ? 'aspect-[4/3.4]' : 'aspect-[4/3]',
          )}
          style={{ perspective: 800 }}
        >
          <motion.div
            className="absolute inset-[8%] grid place-items-center"
            style={{ rotateX: rx, rotateY: ry }}
            animate={{ rotate: hover ? -6 : 0, scale: hover ? 1.06 : 1 }}
            transition={spring.soft}
          >
            <Ingredient
              name={recipe.illustration}
              className="h-full w-auto max-w-full drop-shadow-none"
            />
          </motion.div>

          {/* Hover: data layer revealed from the pointer by a circular clip (food → data). */}
          {interactive && (
            <div
              aria-hidden
              className="on-dark absolute inset-0 grid place-items-center bg-ink text-paper transition-[clip-path] duration-[650ms] ease-[cubic-bezier(0.76,0,0.24,1)]"
              style={{
                clipPath: hover
                  ? `circle(150% at ${origin.x}% ${origin.y}%)`
                  : `circle(0% at ${origin.x}% ${origin.y}%)`,
              }}
            >
              <MacroRings
                protein={recipe.protein}
                carb={recipe.carb}
                fat={recipe.fat}
                size={size === 'lg' ? 200 : 150}
                stroke={12}
                gap={6}
                surface="dark"
                play={hover}
              >
                <span className="num-wide text-[1.5rem] leading-none">{kcal}</span>
                <span className="mt-1 label text-[0.625rem] text-sage">kcal</span>
              </MacroRings>
            </div>
          )}
        </div>
      </ViewTransition>

      <FavoriteButton id={recipe.id} title={recipe.title} className="absolute end-3 top-3" />

      <div className="mt-4 flex items-center gap-3 text-[0.8125rem] text-ink-60">
        <span className="num">{t('time', { count: minutes })}</span>
        <span aria-hidden className="h-3 w-px bg-ink/25" />
        <span className="num">{kcal} kcal</span>
      </div>
      <h3
        className={cn(
          'mt-2 font-display leading-[1.08] tracking-[-0.015em] transition-colors duration-300 group-hover/card:text-paprika-deep ar:leading-[1.35] ar:font-bold ar:tracking-normal',
          size === 'lg' ? 'text-display-md' : 'text-[1.625rem]',
        )}
      >
        <Link
          href={{ pathname: '/recipes/[slug]', params: { slug: recipe.slug } }}
          data-cursor-zones=""
          className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ink"
          prefetch={priority ? true : undefined}
        >
          {recipe.title}
        </Link>
      </h3>
      {size === 'lg' && <p className="mt-3 max-w-xl text-body text-ink-70">{recipe.summary}</p>}
      {visibleTags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <li
              key={tag}
              className="rounded-pill border border-ink/20 px-2.5 py-1 text-[0.75rem] font-medium"
            >
              {td(tag)}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
