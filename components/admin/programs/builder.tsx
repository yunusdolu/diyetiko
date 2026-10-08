'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  deleteProgramAction,
  duplicateProgramAction,
  saveProgramAction,
} from '@/app/admin/_actions/programs';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { add, sum, ZERO, type Macros } from '@/lib/nutrition/totals';
import { cn } from '@/lib/utils';
import type { FoodOption, MealSlot, ProgramTree, RecipeOption } from '@/types/admin';
import { Button, Input, Select, Sheet, Textarea } from '@/components/admin/ui';
import { Tabs } from '@/components/ui/tabs';
import {
  foodItem,
  fromTree,
  macrosForGrams,
  recipeItem,
  reducer,
  type Draft,
  type DraftItem,
} from './builder-state';
import { ShareSheet, type ShareStrings } from './share-sheet';
import { VersionsSheet } from './versions-sheet';

const SLOTS: MealSlot[] = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'snack_late'];
type SaveStatus = 'idle' | 'dirty' | 'saving' | 'error';

const itemMacros = (i: DraftItem): Macros => ({
  kcal: i.kcal,
  protein: i.protein_g,
  carb: i.carb_g,
  fat: i.fat_g,
  fiber: i.fiber_g,
});

export function ProgramBuilder({
  tree,
  foods,
  recipes,
  clients,
  shareStrings,
  clientPhone,
}: {
  tree: ProgramTree;
  foods: FoodOption[];
  recipes: RecipeOption[];
  clients: { id: string; full_name: string; preferred_language: Locale }[];
  shareStrings: ShareStrings;
  clientPhone: string | null;
}) {
  const t = useTranslations('admin.programs');
  const tc = useTranslations('admin.common');
  const tm = useTranslations('meals');
  const ts = useTranslations('admin.share');
  const format = useFormatter();
  const router = useRouter();
  const [draft, dispatch] = useReducer(reducer, tree, fromTree);
  const [day, setDay] = useState(0);
  const [activeMeal, setActiveMeal] = useState<string | null>(draft.days[0]?.meals[0]?.id ?? null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState(tree.updated_at);
  const lastSaved = useRef(JSON.stringify(fromTree(tree)));
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ------------------------------------------------------------------ autosave
  const serialized = JSON.stringify(draft);
  useEffect(() => {
    if (serialized === lastSaved.current) return;
    setStatus('dirty');
    const id = window.setTimeout(async () => {
      setStatus('saving');
      const res = await saveProgramAction(tree.id, JSON.parse(serialized) as Draft).catch(() => ({
        ok: false as const,
      }));
      if (res.ok) {
        lastSaved.current = serialized;
        setStatus('idle');
        if (res.data) setSavedAt(res.data.updatedAt);
      } else {
        setStatus('error');
      }
    }, 900);
    return () => window.clearTimeout(id);
  }, [serialized, tree.id]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === 'dirty' || status === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  // ------------------------------------------------------------------ dnd
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const currentDay = draft.days[day] ?? draft.days[0]!;
  const mealOfItem = useCallback(
    (itemId: string) => currentDay.meals.find((m) => m.items.some((i) => i.id === itemId)),
    [currentDay],
  );

  const onDragStart = (e: DragStartEvent) =>
    setDragLabel(String(e.active.data.current?.label ?? ''));
  const onDragEnd = (e: DragEndEvent) => {
    setDragLabel(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    const targetMeal = overId.startsWith('meal-')
      ? currentDay.meals.find((m) => `meal-${m.id}` === overId)
      : mealOfItem(overId);
    if (!targetMeal) return;
    const overIndex = overId.startsWith('meal-')
      ? targetMeal.items.length
      : targetMeal.items.findIndex((i) => i.id === overId);
    const data = active.data.current as
      { kind: 'food' | 'recipe'; id: string } | { kind: 'item' } | undefined;
    if (data?.kind === 'food') {
      const f = foods.find((x) => x.id === data.id);
      if (f)
        dispatch({
          type: 'addItem',
          day,
          mealId: targetMeal.id,
          item: foodItem(f, undefined, f.units[0] ?? null),
          index: overIndex,
        });
      return;
    }
    if (data?.kind === 'recipe') {
      const r = recipes.find((x) => x.id === data.id);
      if (r)
        dispatch({
          type: 'addItem',
          day,
          mealId: targetMeal.id,
          item: recipeItem(r),
          index: overIndex,
        });
      return;
    }
    const from = mealOfItem(String(active.id));
    if (from && String(active.id) !== overId)
      dispatch({
        type: 'moveItem',
        day,
        fromMeal: from.id,
        toMeal: targetMeal.id,
        itemId: String(active.id),
        toIndex: overIndex,
      });
  };

  const addToActive = (item: DraftItem) => {
    const mealId =
      activeMeal && currentDay.meals.some((m) => m.id === activeMeal)
        ? activeMeal
        : currentDay.meals[0]?.id;
    if (!mealId) return;
    dispatch({ type: 'addItem', day, mealId, item });
  };

  // ------------------------------------------------------------------ totals
  const dndId = useId();
  const dayTotal = useMemo(
    () => sum(currentDay.meals.flatMap((m) => m.items.map(itemMacros))),
    [currentDay],
  );
  const targets = {
    kcal: draft.target_kcal,
    protein: draft.target_protein_g,
    carb: draft.target_carb_g,
    fat: draft.target_fat_g,
  };

  const duplicate = async (asTemplate: boolean) => {
    const res = await duplicateProgramAction(tree.id, asTemplate);
    if (res.ok && res.data) {
      toast.success(tc('created'));
      router.push(`/admin/programs/${res.data.id}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/programs"
          className="text-[0.8125rem] font-semibold text-a-muted hover:text-a-text"
        >
          {t('title')}
        </Link>
        <span className="text-a-muted max-sm:hidden" aria-hidden>
          /
        </span>
        <input
          value={draft.title}
          onChange={(e) => dispatch({ type: 'meta', patch: { title: e.target.value } })}
          aria-label={t('titleField')}
          className="min-w-0 basis-full rounded-[10px] border border-transparent bg-transparent px-2 py-1 font-display text-[clamp(1.5rem,2.6vw,2.25rem)] leading-tight outline-none hover:border-a-border focus:border-a-text sm:flex-1 sm:basis-0 ar:font-bold"
        />
        <AutosaveBadge status={status} savedAt={savedAt} />
        <Button onClick={() => setVersionsOpen(true)}>{t('versions')}</Button>
        <Button variant="primary" onClick={() => setShareOpen(true)} icon={<ShareGlyph />}>
          {ts('title')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
        {/* Library */}
        <Library foods={foods} recipes={recipes} onAdd={addToActive} />

        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="min-w-0 space-y-4">
            {/* Day tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                size="sm"
                className="w-full"
                label={t('day', { n: day + 1 })}
                value={String(day)}
                onChange={(v) => {
                  setDay(Number(v));
                  setActiveMeal(draft.days[Number(v)]?.meals[0]?.id ?? null);
                }}
                items={draft.days.map((d, i) => {
                  const kcal = sum(d.meals.flatMap((m) => m.items.map(itemMacros))).kcal;
                  return {
                    value: String(i),
                    label: t('day', { n: i + 1 }),
                    count: Math.round(kcal) || undefined,
                  };
                })}
              />
              <Button
                size="sm"
                onClick={() => dispatch({ type: 'addDay' })}
                disabled={draft.days.length >= 14}
              >
                + {t('addDay')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'copyDay', day })}>
                {t('copyDay')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'clearDay', day })}>
                {t('clearDay')}
              </Button>
              {draft.days.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-a-danger"
                  onClick={() => {
                    dispatch({ type: 'removeDay', day });
                    setDay(Math.max(0, day - 1));
                  }}
                >
                  {tc('remove')}
                </Button>
              )}
            </div>

            <TotalsBar total={dayTotal} targets={targets} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentDay.id}
                className="grid grid-cols-1 gap-3 2xl:grid-cols-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: admin.dur }}
              >
                {currentDay.meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    active={activeMeal === meal.id}
                    onActivate={() => setActiveMeal(meal.id)}
                    onMeal={(patch) =>
                      dispatch({ type: 'updateMeal', day, mealId: meal.id, patch })
                    }
                    onRemoveMeal={() => dispatch({ type: 'removeMeal', day, mealId: meal.id })}
                    onItem={(itemId, patch) =>
                      dispatch({ type: 'updateItem', day, mealId: meal.id, itemId, patch })
                    }
                    onRemoveItem={(itemId) =>
                      dispatch({ type: 'removeItem', day, mealId: meal.id, itemId })
                    }
                    foods={foods}
                    recipes={recipes}
                  />
                ))}
                <div className="grid place-items-center rounded-[16px] border border-dashed border-a-border p-4">
                  <Select
                    aria-label={t('addMeal')}
                    value=""
                    onChange={(e) =>
                      e.target.value &&
                      dispatch({ type: 'addMeal', day, slot: e.target.value as MealSlot })
                    }
                    options={[
                      { value: '', label: `+ ${t('addMeal')}` },
                      ...SLOTS.map((s) => ({ value: s, label: tm(s) })),
                    ]}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <DragOverlay dropAnimation={{ duration: 180 }}>
            {dragLabel ? (
              <div className="rounded-[10px] bg-a-accent px-3 py-2 text-[0.8125rem] font-semibold text-a-accent-text shadow-sheet">
                {dragLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Settings row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="a-card p-5">
          <h2 className="mb-4 text-[0.9375rem] font-bold">{t('targets')}</h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['target_kcal', t('targetKcal')],
                ['target_protein_g', t('targetProtein')],
                ['target_carb_g', t('targetCarb')],
                ['target_fat_g', t('targetFat')],
              ] as const
            ).map(([k, label]) => (
              <Input
                key={k}
                type="number"
                inputMode="decimal"
                label={label}
                value={draft[k] ?? ''}
                onChange={(e) =>
                  dispatch({
                    type: 'meta',
                    patch: { [k]: e.target.value === '' ? null : Number(e.target.value) },
                  })
                }
              />
            ))}
          </div>
        </section>
        <section className="a-card grid gap-3 p-5">
          <Select
            label={t('assign')}
            value={draft.client_id ?? ''}
            disabled={draft.is_template}
            onChange={(e) =>
              dispatch({ type: 'meta', patch: { client_id: e.target.value || null } })
            }
            options={[
              { value: '', label: t('unassigned') },
              ...clients.map((c) => ({ value: c.id, label: c.full_name })),
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('language')}
              value={draft.language}
              onChange={(e) =>
                dispatch({ type: 'meta', patch: { language: e.target.value as Locale } })
              }
              options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
            />
            <Select
              label={tc('status')}
              value={draft.status}
              onChange={(e) =>
                dispatch({ type: 'meta', patch: { status: e.target.value as Draft['status'] } })
              }
              options={(['draft', 'active', 'archived'] as const).map((s) => ({
                value: s,
                label: t(`status.${s}`),
              }))}
            />
          </div>
          <Input
            type="date"
            label={t('startsOn')}
            value={draft.starts_on ?? ''}
            onChange={(e) =>
              dispatch({ type: 'meta', patch: { starts_on: e.target.value || null } })
            }
          />
        </section>
        <section className="a-card grid gap-3 p-5">
          <Textarea
            label={t('notes')}
            rows={3}
            value={draft.notes ?? ''}
            onChange={(e) => dispatch({ type: 'meta', patch: { notes: e.target.value || null } })}
          />
          <Textarea
            label={t('hydration')}
            rows={2}
            value={draft.hydration ?? ''}
            onChange={(e) =>
              dispatch({ type: 'meta', patch: { hydration: e.target.value || null } })
            }
          />
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-a-border pt-5">
        <Button onClick={() => duplicate(false)}>{t('duplicate')}</Button>
        <Button onClick={() => duplicate(true)}>{t('saveAsTemplate')}</Button>
        <Button
          variant="ghost"
          className="ms-auto text-a-danger"
          onClick={() => setConfirmDelete(true)}
        >
          {t('deleteProgram')}
        </Button>
        <span className="num text-[0.75rem] text-a-muted">
          {format.relativeTime(new Date(savedAt))}
        </span>
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        programId={tree.id}
        strings={shareStrings}
        clientFirstName={
          clients.find((c) => c.id === draft.client_id)?.full_name.split(' ')[0] ?? null
        }
        clientPhone={clientPhone}
      />
      <VersionsSheet
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        programId={tree.id}
        onRestore={(tr) => dispatch({ type: 'replace', draft: fromTree(tr) })}
      />
      <Sheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        side="center"
        width="sm"
        title={t('deleteProgram')}
        description={t('deleteProgramBody')}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{tc('cancel')}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteProgramAction(tree.id);
                toast.success(tc('deleted'));
                router.push('/admin/programs');
              }}
            >
              {tc('delete')}
            </Button>
          </>
        }
      >
        <p className="text-[0.875rem]">{draft.title}</p>
      </Sheet>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function AutosaveBadge({ status, savedAt }: { status: SaveStatus; savedAt: string }) {
  const t = useTranslations('admin.programs.autosave');
  const format = useFormatter();
  const label = t(status);
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex h-8 items-center gap-2 rounded-pill border border-a-border px-3 text-[0.75rem] font-semibold"
      title={format.dateTime(new Date(savedAt), { timeStyle: 'medium' })}
    >
      <span className="relative grid size-2.5 place-items-center">
        <motion.span
          className={cn(
            'absolute inset-0 rounded-full',
            status === 'error' ? 'bg-a-danger' : status === 'idle' ? 'bg-a-ok' : 'bg-mustard',
          )}
          animate={
            status === 'saving'
              ? { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }
              : { scale: 1, opacity: 1 }
          }
          transition={
            status === 'saving' ? { duration: 0.9, repeat: Infinity } : { duration: admin.dur }
          }
        />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -6, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TotalsBar({
  total,
  targets,
}: {
  total: Macros;
  targets: { kcal: number | null; protein: number | null; carb: number | null; fat: number | null };
}) {
  const t = useTranslations('admin.programs');
  const tm = useTranslations('macros');
  const format = useFormatter();
  const rows = [
    ['kcal', t('dayTotal'), total.kcal, targets.kcal, 'kcal'],
    ['protein', tm('protein'), total.protein, targets.protein, 'g'],
    ['carb', tm('carb'), total.carb, targets.carb, 'g'],
    ['fat', tm('fat'), total.fat, targets.fat, 'g'],
  ] as const;
  return (
    <div className="a-card grid grid-cols-2 gap-x-5 gap-y-4 p-4 md:grid-cols-4">
      {rows.map(([key, label, value, target, unit]) => {
        const ratio = target ? value / target : null;
        const over = ratio != null && ratio > 1.1;
        return (
          <div key={key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[0.75rem] font-semibold text-a-muted">{label}</span>
              {over && (
                <span className="shrink-0 text-[0.6875rem] font-bold text-a-danger">
                  {t('overTarget')}
                </span>
              )}
            </div>
            <p className="mt-0.5 num text-[0.875rem] whitespace-nowrap">
              <span className="font-semibold">
                {format.number(value, { maximumFractionDigits: 0 })}
              </span>
              {target ? <span className="text-a-muted"> / {format.number(target)}</span> : null}{' '}
              <span className="text-a-muted">{unit}</span>
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-pill bg-a-surface-2"
              role="meter"
              aria-label={label}
              aria-valuenow={Math.round(value)}
              aria-valuemin={0}
              aria-valuemax={target ?? undefined}
            >
              <motion.div
                className={cn(
                  'h-full origin-left rounded-pill rtl:origin-right',
                  over ? 'bg-a-danger' : 'bg-a-chart',
                )}
                initial={false}
                animate={{ scaleX: ratio == null ? (value > 0 ? 1 : 0) : Math.min(1, ratio) }}
                transition={admin.spring}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Library({
  foods,
  recipes,
  onAdd,
}: {
  foods: FoodOption[];
  recipes: RecipeOption[];
  onAdd: (i: DraftItem) => void;
}) {
  const t = useTranslations('admin.programs');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const [tab, setTab] = useState<'foods' | 'recipes' | 'custom'>('foods');
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLocaleLowerCase(locale));
  const [custom, setCustom] = useState({ name: '', kcal: '' });
  const shownFoods = foods
    .filter((f) => !q || f.name.toLocaleLowerCase(locale).includes(q))
    .slice(0, 80);
  const shownRecipes = recipes.filter((r) => !q || r.title.toLocaleLowerCase(locale).includes(q));

  return (
    <aside
      className="a-card p-3 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-48px)] xl:overflow-hidden"
      aria-label={t('searchFood')}
    >
      <Tabs
        size="sm"
        label={t('searchFood')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'foods', label: t('foods') },
          { value: 'recipes', label: t('recipes') },
          { value: 'custom', label: t('custom') },
        ]}
      />
      {tab !== 'custom' && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchFood')}
          aria-label={t('searchFood')}
          className="mt-3 h-10 w-full rounded-[10px] border border-a-border bg-a-bg px-3 text-[0.875rem] outline-none focus:border-a-text"
        />
      )}
      <p className="mt-2 px-1 text-[0.6875rem] text-a-muted">{t('dragHint')}</p>
      <ul className="mt-2 max-h-[40dvh] space-y-1 overflow-y-auto overscroll-contain xl:max-h-[calc(100dvh-230px)]">
        {tab === 'foods' &&
          shownFoods.map((f) => (
            <LibraryRow
              key={f.id}
              id={`lib-food-${f.id}`}
              data={{ kind: 'food', id: f.id, label: f.name }}
              label={f.name}
              meta={`${Math.round(f.kcal)} kcal/100 g`}
              onAdd={() => onAdd(foodItem(f, undefined, f.units[0] ?? null))}
            />
          ))}
        {tab === 'recipes' &&
          shownRecipes.map((r) => (
            <LibraryRow
              key={r.id}
              id={`lib-recipe-${r.id}`}
              data={{ kind: 'recipe', id: r.id, label: r.title }}
              label={r.title}
              meta={`${Math.round(r.kcal)} kcal / 1`}
              onAdd={() => onAdd(recipeItem(r))}
            />
          ))}
        {tab === 'custom' && (
          <li className="space-y-3 p-1">
            <Input
              label={t('custom')}
              value={custom.name}
              onChange={(e) => setCustom({ ...custom, name: e.target.value })}
            />
            <Input
              label="kcal"
              type="number"
              value={custom.kcal}
              onChange={(e) => setCustom({ ...custom, kcal: e.target.value })}
            />
            <Button
              variant="primary"
              disabled={!custom.name.trim()}
              onClick={() => {
                onAdd({
                  id: `i-${Date.now()}`,
                  food_id: null,
                  recipe_id: null,
                  name: custom.name.trim(),
                  grams: null,
                  unit_key: null,
                  unit_qty: null,
                  servings: null,
                  kcal: Number(custom.kcal) || 0,
                  protein_g: 0,
                  carb_g: 0,
                  fat_g: 0,
                  fiber_g: 0,
                  note: null,
                });
                setCustom({ name: '', kcal: '' });
              }}
            >
              {tc('add')}
            </Button>
          </li>
        )}
      </ul>
    </aside>
  );
}

function LibraryRow({
  id,
  data,
  label,
  meta,
  onAdd,
}: {
  id: string;
  data: { kind: 'food' | 'recipe'; id: string; label: string };
  label: string;
  meta: string;
  onAdd: () => void;
}) {
  const t = useTranslations('admin.programs');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        'group flex items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-a-surface-2',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`${label} — ${t('dragHint')}`}
        className="grid size-7 shrink-0 cursor-grab place-items-center rounded-[6px] text-a-muted active:cursor-grabbing"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          {[6, 12, 18].map((y) => (
            <g key={y}>
              <circle cx="9" cy={y} r="1.6" fill="currentColor" />
              <circle cx="15" cy={y} r="1.6" fill="currentColor" />
            </g>
          ))}
        </svg>
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-semibold">{label}</span>
        <span className="num text-[0.6875rem] text-a-muted">{meta}</span>
      </span>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`${t('addItem')}: ${label}`}
        className="grid size-7 shrink-0 place-items-center rounded-[8px] border border-a-border text-a-text transition-colors hover:bg-a-accent hover:text-a-accent-text"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </li>
  );
}

function MealCard({
  meal,
  active,
  onActivate,
  onMeal,
  onRemoveMeal,
  onItem,
  onRemoveItem,
  foods,
  recipes,
}: {
  meal: Draft['days'][number]['meals'][number];
  active: boolean;
  onActivate: () => void;
  onMeal: (p: { slot?: MealSlot; time_label?: string | null; note?: string | null }) => void;
  onRemoveMeal: () => void;
  onItem: (id: string, patch: Partial<DraftItem>) => void;
  onRemoveItem: (id: string) => void;
  foods: FoodOption[];
  recipes: RecipeOption[];
}) {
  const t = useTranslations('admin.programs');
  const tm = useTranslations('meals');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const { setNodeRef, isOver } = useDroppable({ id: `meal-${meal.id}` });
  const total = meal.items.reduce<Macros>((a, i) => add(a, itemMacros(i)), ZERO);

  return (
    <section
      ref={setNodeRef}
      onFocusCapture={onActivate}
      onClick={onActivate}
      aria-label={tm(meal.slot)}
      className={cn(
        'rounded-[16px] border bg-a-surface p-3 transition-[border-color,box-shadow] duration-200',
        active ? 'border-a-text/50' : 'border-a-border',
        isOver && 'shadow-[0_0_0_3px_var(--a-chart)]',
      )}
    >
      <header className="flex items-center gap-2">
        <select
          value={meal.slot}
          onChange={(e) => onMeal({ slot: e.target.value as MealSlot })}
          aria-label={tm(meal.slot)}
          className="h-8 rounded-[8px] border border-transparent bg-transparent px-1 text-[0.9375rem] font-bold hover:border-a-border"
        >
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {tm(s)}
            </option>
          ))}
        </select>
        <input
          value={meal.time_label ?? ''}
          onChange={(e) => onMeal({ time_label: e.target.value || null })}
          placeholder="08:00"
          aria-label={t('time')}
          className="h-8 w-16 rounded-[8px] border border-a-border bg-transparent px-2 num text-[0.8125rem]"
        />
        <span className="ms-auto num text-[0.8125rem] font-semibold">
          {format.number(total.kcal, { maximumFractionDigits: 0 })} kcal
        </span>
        <button
          type="button"
          onClick={onRemoveMeal}
          aria-label={`${tc('remove')}: ${tm(meal.slot)}`}
          className="grid size-7 place-items-center rounded-[8px] text-a-muted hover:bg-a-surface-2 hover:text-a-danger"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <SortableContext items={meal.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="mt-2 min-h-12 space-y-1.5">
          <AnimatePresence initial={false}>
            {meal.items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                food={it.food_id ? foods.find((f) => f.id === it.food_id) : undefined}
                recipe={it.recipe_id ? recipes.find((r) => r.id === it.recipe_id) : undefined}
                onChange={(p) => onItem(it.id, p)}
                onRemove={() => onRemoveItem(it.id)}
              />
            ))}
          </AnimatePresence>
          {!meal.items.length && (
            <li className="grid h-12 place-items-center rounded-[10px] border border-dashed border-a-border text-[0.75rem] text-a-muted">
              {t('dragHint')}
            </li>
          )}
        </ul>
      </SortableContext>
      <input
        value={meal.note ?? ''}
        onChange={(e) => onMeal({ note: e.target.value || null })}
        placeholder={t('mealNote')}
        aria-label={t('mealNote')}
        className="mt-2 h-8 w-full rounded-[8px] border border-transparent bg-transparent px-2 text-[0.8125rem] text-a-muted outline-none hover:border-a-border focus:border-a-text"
      />
    </section>
  );
}

function ItemRow({
  item,
  food,
  recipe,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  food?: FoodOption;
  recipe?: RecipeOption;
  onChange: (p: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('admin.programs');
  const tu = useTranslations('units');
  const tc = useTranslations('admin.common');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { kind: 'item', label: item.name },
  });
  const unit = food?.units.find((u) => u.key === item.unit_key) ?? null;

  const setQty = (value: number, unitKey: string | null) => {
    if (!food) return;
    const u = food.units.find((x) => x.key === unitKey) ?? null;
    const grams = u ? value * u.grams : value;
    if (!(grams > 0)) return;
    onChange({
      grams,
      unit_key: u?.key ?? null,
      unit_qty: u ? value : null,
      ...macrosForGrams(food, grams),
    });
  };
  const setServings = (s: number) => {
    if (!recipe || !(s > 0)) return;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    onChange({
      servings: s,
      kcal: r1(recipe.kcal * s),
      protein_g: r1(recipe.protein_g * s),
      carb_g: r1(recipe.carb_g * s),
      fat_g: r1(recipe.fat_g * s),
      fiber_g: r1(recipe.fiber_g * s),
    });
  };

  return (
    <motion.li
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="flex items-center gap-2 rounded-[10px] bg-a-bg px-2 py-1.5"
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={item.name}
        className="grid size-6 shrink-0 cursor-grab place-items-center text-a-muted"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
          {[7, 12, 17].map((y) => (
            <g key={y}>
              <circle cx="9" cy={y} r="1.5" fill="currentColor" />
              <circle cx="15" cy={y} r="1.5" fill="currentColor" />
            </g>
          ))}
        </svg>
      </button>
      <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold" title={item.name}>
        {item.name}
      </span>
      {food && (
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            step={unit ? 0.5 : 5}
            value={unit ? (item.unit_qty ?? 1) : (item.grams ?? 0)}
            onChange={(e) => setQty(Number(e.target.value), item.unit_key)}
            aria-label={t('quantity')}
            className="h-8 w-16 rounded-[8px] border border-a-border bg-a-surface px-1.5 text-end num text-[0.8125rem]"
          />
          <select
            value={item.unit_key ?? 'g'}
            onChange={(e) =>
              setQty(
                e.target.value === 'g' ? (item.grams ?? 100) : 1,
                e.target.value === 'g' ? null : e.target.value,
              )
            }
            aria-label={t('quantity')}
            className="h-8 rounded-[8px] border border-a-border bg-a-surface px-1 text-[0.75rem]"
          >
            <option value="g">g</option>
            {food.units.map((u) => (
              <option key={u.key} value={u.key}>
                {tu(u.key as 'piece')}
              </option>
            ))}
          </select>
        </span>
      )}
      {recipe && (
        <input
          type="number"
          min={0.5}
          step={0.5}
          value={item.servings ?? 1}
          onChange={(e) => setServings(Number(e.target.value))}
          aria-label={t('servings')}
          className="h-8 w-14 rounded-[8px] border border-a-border bg-a-surface px-1.5 text-end num text-[0.8125rem]"
        />
      )}
      <span className="w-14 shrink-0 text-end num text-[0.75rem] text-a-muted">
        {Math.round(item.kcal)} kcal
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${tc('remove')}: ${item.name}`}
        className="grid size-7 shrink-0 place-items-center rounded-[8px] text-a-muted hover:text-a-danger"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </motion.li>
  );
}
