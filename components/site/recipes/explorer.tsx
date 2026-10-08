'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import { FAVORITES_KEY, useShoppingList, useStoredIds } from '@/lib/local-store';
import { fridgeMatch } from '@/lib/nutrition/quantities';
import type { RecipeTag } from '@/lib/nutrition/tags';
import { useQueryParam } from '@/lib/use-query-param';
import { useMotionLevel } from '@/lib/motion/hooks';
import { dur, ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { FridgeFood, RecipeSummary } from '@/types/content';
import { Chip } from '@/components/ui/chip';
import { Tabs } from '@/components/ui/tabs';
import { RecipeCard } from '@/components/site/recipe-card';
import { RandomPicker } from './random-picker';

type Mode = 'all' | 'fridge' | 'random' | 'favorites';
const MODES: Mode[] = ['all', 'fridge', 'random', 'favorites'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const DIETS = ['vegetarian', 'vegan', 'gluten_free', 'dairy_free'] as const;
const TAGS = ['high_protein', 'high_fiber', 'under_400', 'quick'] as const;
const TIMES = [15, 30, 45, 60] as const;
const KCAL_STEPS = [300, 400, 500, 600, 800] as const;

export function RecipeExplorer({
  recipes,
  foods,
}: {
  recipes: RecipeSummary[];
  foods: FridgeFood[];
}) {
  const t = useTranslations('recipes');
  const tm = useTranslations('meals');
  const td = useTranslations('diet');
  const tu = useTranslations('units');
  const locale = useLocale() as Locale;
  const level = useMotionLevel();
  // User choice wins; otherwise ?mode= (deep links from the tools index); otherwise 'all'.
  const urlMode = useQueryParam('mode') as Mode | null;
  const [chosenMode, setMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (urlMode && MODES.includes(urlMode) ? urlMode : 'all');
  const [meal, setMeal] = useState<string | null>(null);
  const [diets, setDiets] = useState<string[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [maxTime, setMaxTime] = useState<number | null>(null);
  const [maxKcal, setMaxKcal] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const [have, setHave] = useState<Set<string>>(new Set());
  const favorites = useStoredIds(FAVORITES_KEY);
  const shopping = useShoppingList();

  // Keep ?mode= in the URL so the tools index can deep-link into a mode.
  // Only after an explicit choice — never during hydration, or the deep link would be erased.
  useEffect(() => {
    if (chosenMode === null) return;
    const url = new URL(window.location.href);
    if (chosenMode === 'all') url.searchParams.delete('mode');
    else url.searchParams.set('mode', chosenMode);
    window.history.replaceState(null, '', url);
  }, [chosenMode]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase(locale);
    return recipes.filter((r) => {
      if (meal && !r.mealTypes.includes(meal)) return false;
      if (diets.some((d) => !r.dietFlags.includes(d))) return false;
      if (tags.some((tag) => !r.tags.includes(tag))) return false;
      if (maxTime && r.prepMin + r.cookMin > maxTime) return false;
      if (maxKcal && r.kcal > maxKcal) return false;
      if (needle && !`${r.title} ${r.summary}`.toLocaleLowerCase(locale).includes(needle))
        return false;
      return true;
    });
  }, [recipes, meal, diets, tags, maxTime, maxKcal, q, locale]);

  const fridgeRanked = useMemo(() => {
    if (!have.size) return [];
    return recipes
      .map((r) => ({ recipe: r, match: fridgeMatch(r.ingredientKeys, have) }))
      .filter((x) => x.match.have > 0)
      .sort(
        (a, b) => b.match.ratio - a.match.ratio || a.match.missing.length - b.match.missing.length,
      );
  }, [recipes, have]);

  const favoriteRecipes = recipes.filter((r) => favorites.has(r.id));
  const activeFilters =
    Number(Boolean(meal)) +
    diets.length +
    tags.length +
    Number(Boolean(maxTime)) +
    Number(Boolean(maxKcal)) +
    Number(Boolean(query));
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const clear = () => {
    setMeal(null);
    setDiets([]);
    setTags([]);
    setMaxTime(null);
    setMaxKcal(null);
    setQuery('');
  };
  const kcalFmt = new Intl.NumberFormat(intlLocale(locale));

  return (
    <div>
      <div className="container-x">
        <Tabs
          label={t('title')}
          value={mode}
          onChange={setMode}
          items={MODES.map((m) => ({
            value: m,
            label: t(`modes.${m}`),
            count: m === 'favorites' ? favorites.ids.length : undefined,
          }))}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={level === 'reduced' ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.md, ease: ease.out } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          {mode === 'all' && (
            <>
              <div className="container-x mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
                <aside className="lg:col-span-3" aria-label={t('filters.title')}>
                  <FilterPanel>
                    <label className="block">
                      <span className="label text-ink-60">{t('filters.search')}</span>
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="mt-2 h-12 w-full border-b-[1.5px] border-ink/30 bg-transparent text-body transition-colors outline-none focus:border-ink"
                      />
                    </label>
                    <FilterGroup label={t('filters.meal')}>
                      {MEALS.map((m) => (
                        <Chip
                          key={m}
                          selected={meal === m}
                          onToggle={() => setMeal(meal === m ? null : m)}
                          count={recipes.filter((r) => r.mealTypes.includes(m)).length}
                        >
                          {m === 'snack' ? tm('snack') : tm(m)}
                        </Chip>
                      ))}
                    </FilterGroup>
                    <FilterGroup label={t('filters.diet')}>
                      {DIETS.map((d) => (
                        <Chip
                          key={d}
                          selected={diets.includes(d)}
                          onToggle={() => setDiets(toggle(diets, d))}
                        >
                          {td(d)}
                        </Chip>
                      ))}
                    </FilterGroup>
                    <FilterGroup label={t('filters.tags')}>
                      {TAGS.map((tag) => (
                        <Chip
                          key={tag}
                          selected={tags.includes(tag)}
                          onToggle={() => setTags(toggle(tags, tag))}
                        >
                          {td(tag)}
                        </Chip>
                      ))}
                    </FilterGroup>
                    <FilterGroup label={t('filters.time')}>
                      {TIMES.map((m) => (
                        <Chip
                          key={m}
                          selected={maxTime === m}
                          onToggle={() => setMaxTime(maxTime === m ? null : m)}
                        >
                          {t('card.time', { count: m })}
                        </Chip>
                      ))}
                    </FilterGroup>
                    <FilterGroup label={t('filters.kcal')}>
                      {KCAL_STEPS.map((k) => (
                        <Chip
                          key={k}
                          selected={maxKcal === k}
                          onToggle={() => setMaxKcal(maxKcal === k ? null : k)}
                        >
                          {kcalFmt.format(k)} {tu('kcal')}
                        </Chip>
                      ))}
                    </FilterGroup>
                    <AnimatePresence>
                      {activeFilters > 0 && (
                        <motion.button
                          type="button"
                          onClick={clear}
                          className="text-ui font-semibold underline underline-offset-4"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          {t('filters.clear')}
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </FilterPanel>
                </aside>

                <div className="lg:col-span-9">
                  <p className="label text-ink-60" aria-live="polite">
                    {t('count', { count: filtered.length })}
                  </p>
                  <RecipeGrid recipes={filtered} empty={t('empty')} />
                </div>
              </div>
            </>
          )}

          {mode === 'fridge' && (
            <FridgeFinder foods={foods} have={have} setHave={setHave} ranked={fridgeRanked} />
          )}

          {mode === 'random' && (
            <div className="container-x mt-10">
              <RandomPicker recipes={filtered.length ? filtered : recipes} />
            </div>
          )}

          {mode === 'favorites' && (
            <div className="container-x mt-10">
              <p className="label text-ink-60">{t('favorites.localNote')}</p>
              {favoriteRecipes.length ? (
                <RecipeGrid recipes={favoriteRecipes} empty="" />
              ) : (
                <p className="mt-10 max-w-lg text-lead text-ink-70">{t('favorites.empty')}</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Shopping list dock */}
      <AnimatePresence>
        {shopping.entries.length > 0 && (
          <motion.div
            className="fixed start-1/2 bottom-5 z-50 ltr:-translate-x-1/2 rtl:translate-x-1/2"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring.soft}
          >
            <Link
              href="/recipes/shopping-list"
              className="inline-flex h-12 items-center gap-3 rounded-pill bg-ink px-5 text-ui font-semibold text-paper shadow-sheet transition-transform active:scale-95"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path
                  d="M5 7h14l-1.5 11h-11ZM9 7a3 3 0 0 1 6 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              {t('list.open', { count: shopping.entries.length })}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The sticky filter column. On a short window (small laptops, browser zoom) the filters are
 * taller than the screen, and a plain sticky column would keep its lower part out of reach until
 * the end of the recipe list. The column therefore becomes its own scroll area — wheel, touch
 * and keyboard — with a fade at the edge that still has more.
 */
function FilterPanel({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ scrolls: false, above: false, below: false });

  useEffect(() => {
    const el = outer.current;
    if (!el || !inner.current) return;
    const measure = () => {
      const scrolls = el.scrollHeight > el.clientHeight + 1;
      const next = {
        scrolls,
        above: scrolls && el.scrollTop > 2,
        below: scrolls && el.scrollTop + el.clientHeight < el.scrollHeight - 2,
      };
      setState((cur) =>
        cur.scrolls === next.scrolls && cur.above === next.above && cur.below === next.below
          ? cur
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(inner.current);
    // Wheel: while the column can still move in that direction it scrolls (natively) and the
    // event is kept from the page's smooth scroller; at its edge the event passes through, so
    // the page carries on instead of feeling stuck.
    const onWheel = (e: WheelEvent) => {
      const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      const canUp = el.scrollTop > 0;
      if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const fade = state.scrolls
    ? `linear-gradient(to bottom, ${state.above ? 'transparent, #000 1.75rem' : '#000 0'}, ${state.below ? '#000 calc(100% - 2.5rem), transparent' : '#000 100%'})`
    : undefined;

  return (
    <div
      ref={outer}
      className="lg:sticky lg:top-24 lg:-mx-3 lg:max-h-[calc(100svh-7rem)] lg:[scrollbar-width:thin] lg:[scrollbar-color:color-mix(in_oklab,var(--color-ink)_35%,transparent)_transparent] lg:overflow-y-auto lg:px-3 lg:pb-2"
      style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
    >
      <div ref={inner} className="space-y-7">
        {children}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 label text-ink-60">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** Editorial grid: every 5th card is doubled. Cards animate position on filter changes. */
export function RecipeGrid({ recipes, empty }: { recipes: RecipeSummary[]; empty: string }) {
  return (
    <LayoutGroup>
      <motion.ul
        layout
        className="mt-6 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3"
      >
        <AnimatePresence mode="popLayout">
          {recipes.map((r, i) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
              transition={spring.soft}
              className={cn(i % 5 === 0 && 'sm:col-span-2 xl:col-span-2')}
            >
              <RecipeCard recipe={r} size={i % 5 === 0 ? 'lg' : 'md'} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      {!recipes.length && empty && <p className="mt-10 max-w-lg text-lead text-ink-70">{empty}</p>}
    </LayoutGroup>
  );
}

function FridgeFinder({
  foods,
  have,
  setHave,
  ranked,
}: {
  foods: FridgeFood[];
  have: Set<string>;
  setHave: (s: Set<string>) => void;
  ranked: { recipe: RecipeSummary; match: ReturnType<typeof fridgeMatch> }[];
}) {
  const t = useTranslations('recipes.fridge');
  const tcat = useTranslations('recipes.fridge.categories');
  const locale = useLocale() as Locale;
  const [search, setSearch] = useState('');
  const needle = search.trim().toLocaleLowerCase(locale);
  const shown = foods.filter((f) => !needle || f.name.toLocaleLowerCase(locale).includes(needle));
  const byCat = shown.reduce<Record<string, FridgeFood[]>>(
    (acc, f) => ((acc[f.category] ??= []).push(f), acc),
    {},
  );
  const nameOf = (key: string) => foods.find((f) => f.key === key)?.name ?? key;
  const toggle = (key: string) => {
    const next = new Set(have);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHave(next);
  };

  return (
    <div className="container-x mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-5">
        <h2 className="font-display text-display-md ar:font-bold">{t('title')}</h2>
        <p className="mt-3 text-body text-ink-70">{t('lead')}</p>
        <label className="mt-6 block">
          <span className="label text-ink-60">{t('search')}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2 h-12 w-full border-b-[1.5px] border-ink/30 bg-transparent text-body outline-none focus:border-ink"
          />
        </label>
        <LayoutGroup>
          {have.size > 0 && (
            <motion.div layout className="mt-6 flex flex-wrap gap-2 border-b-2 border-ink pb-6">
              {[...have].map((k) => (
                <motion.div key={k} layoutId={`food-${k}`} transition={spring.soft}>
                  <Chip selected onToggle={() => toggle(k)}>
                    {nameOf(k)}
                  </Chip>
                </motion.div>
              ))}
              <button
                type="button"
                onClick={() => setHave(new Set())}
                className="px-2 text-[0.8125rem] font-semibold underline underline-offset-4"
              >
                {t('clear')}
              </button>
            </motion.div>
          )}
          <div className="mt-6 max-h-[60vh] space-y-6 overflow-y-auto pe-2" data-lenis-prevent>
            {Object.entries(byCat).map(([cat, list]) => (
              <fieldset key={cat}>
                <legend className="mb-2 label text-ink-60">{tcat(cat as 'grains')}</legend>
                <div className="flex flex-wrap gap-2">
                  {list
                    .filter((f) => !have.has(f.key))
                    .map((f) => (
                      <motion.div key={f.key} layoutId={`food-${f.key}`} transition={spring.soft}>
                        <Chip selected={false} onToggle={() => toggle(f.key)}>
                          {f.name}
                        </Chip>
                      </motion.div>
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <div className="lg:col-span-7">
        {!have.size ? (
          <p className="text-lead text-ink-70">{t('empty')}</p>
        ) : (
          <LayoutGroup>
            <motion.ol layout className="space-y-4">
              <AnimatePresence mode="popLayout">
                {ranked.map(({ recipe, match }) => (
                  <motion.li
                    key={recipe.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring.soft}
                    className="border-t border-ink/20 pt-4"
                  >
                    <Link
                      href={{ pathname: '/recipes/[slug]', params: { slug: recipe.slug } }}
                      className="group/fr block"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-display text-[1.6rem] leading-tight group-hover/fr:text-paprika-deep ar:leading-[1.4] ar:font-bold">
                          {recipe.title}
                        </span>
                        <span className="shrink-0 num text-[0.8125rem]">
                          {t('match', { have: match.have, total: match.total })}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-pill bg-ink/10">
                        <motion.div
                          className="h-full origin-left rounded-pill bg-ink rtl:origin-right"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: match.ratio }}
                          transition={{ duration: 0.8, ease: ease.out }}
                        />
                      </div>
                      {match.missing.length > 0 && (
                        <p className="mt-2 text-[0.8125rem] text-ink-60">
                          {t('missing', { items: match.missing.map(nameOf).join(', ') })}
                        </p>
                      )}
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ol>
          </LayoutGroup>
        )}
      </div>
    </div>
  );
}
