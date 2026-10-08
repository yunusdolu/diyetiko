'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addDiaryItemsAction } from '@/app/panel/_actions';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { useMediaQuery } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import type { FoodOption, MealSlot } from '@/types/portal';
import { MotionButton } from '@/components/ui/motion-button';
import { Overlay } from '@/components/ui/overlay';
import { ChevronIcon, CloseIcon, MinusIcon, PlusIcon } from '../icons';

/** Search key: lower-case in the UI language, without accents (yogurt finds yoğurt, ı → i). */
function fold(value: string, locale: string): string {
  return value.toLocaleLowerCase(locale).normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i');
}

const CATEGORY_ORDER = [
  'vegetables',
  'fruits',
  'grains',
  'legumes',
  'dairy_egg',
  'meat_fish',
  'nuts_seeds',
  'fats',
  'other',
] as const;

export function AddFoodSheet({
  open,
  onOpenChange,
  day,
  slot,
  foods,
  recentFoodIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: string;
  slot: MealSlot;
  foods: FoodOption[];
  recentFoodIds: string[];
}) {
  const t = useTranslations('portal.add');
  const tm = useTranslations('meals');
  const tu = useTranslations('units');
  const tp = useTranslations('portal.today');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });

  const [query, setQuery] = useState('');
  const q = fold(useDeferredValue(query).trim(), locale);
  const [picked, setPicked] = useState<FoodOption | null>(null);
  const [unit, setUnit] = useState<string>('g');
  const [qty, setQty] = useState(1);
  const [grams, setGrams] = useState('100');
  const [free, setFree] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setQuery('');
    setPicked(null);
    setFree(null);
    setUnit('g');
    setQty(1);
    setGrams('100');
  };
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) window.setTimeout(reset, 250);
  };

  const indexed = useMemo(
    () =>
      foods.map((f) => ({ food: f, key: fold(`${f.name} ${f.key.replace(/_/g, ' ')}`, locale) })),
    [foods, locale],
  );
  const results = q ? indexed.filter((x) => x.key.includes(q)).map((x) => x.food) : [];
  const recent = recentFoodIds
    .map((id) => foods.find((f) => f.id === id))
    .filter((f): f is FoodOption => Boolean(f));
  const grouped = CATEGORY_ORDER.map(
    (c) => [c, foods.filter((f) => f.category === c)] as const,
  ).filter(([, list]) => list.length);

  const pick = (f: FoodOption) => {
    setPicked(f);
    const first = f.units[0];
    setUnit(first ? first.key : 'g');
    setQty(1);
    setGrams('100');
  };

  const gramsValue = picked
    ? unit === 'g'
      ? Number(grams.replace(',', '.'))
      : (picked.units.find((u) => u.key === unit)?.grams ?? 0) * qty
    : 0;
  const preview = picked && gramsValue > 0 ? Math.round((picked.kcal * gramsValue) / 100) : null;
  const validAmount = gramsValue > 0 && gramsValue <= 5000;

  const submit = async (item: Parameters<typeof addDiaryItemsAction>[0]) => {
    setBusy(true);
    const res = await addDiaryItemsAction(item);
    setBusy(false);
    if (!res.ok) {
      toast.error(tp('saveFailed'));
      return;
    }
    toast.success(`${tm(slot)} · ${picked?.name ?? free ?? ''}`);
    close(false);
    router.refresh();
  };

  const addPicked = () => {
    if (!picked || !validAmount) return;
    void submit({
      day,
      slot,
      items: [
        unit === 'g'
          ? {
              kind: 'food',
              foodId: picked.id,
              name: picked.name,
              unitKey: null,
              unitQty: null,
              grams: Math.round(gramsValue * 10) / 10,
            }
          : {
              kind: 'food',
              foodId: picked.id,
              name: picked.name,
              unitKey: unit,
              unitQty: qty,
              grams: null,
            },
      ],
    });
  };

  return (
    <Overlay
      open={open}
      onOpenChange={close}
      side={desktop ? 'end' : 'bottom'}
      title={`${t('title')} · ${tm(slot)}`}
      hideTitle
    >
      <div className="flex min-h-[60dvh] flex-col px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-7 lg:min-h-full lg:pt-7">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-pill bg-ink/15 lg:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label text-ink-60">{tm(slot)}</p>
            <p className="mt-1 font-display text-[1.9rem] leading-none ar:leading-[1.3] ar:font-bold">
              {picked ? picked.name : free !== null ? t('writeIt') : t('title')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close(false)}
            aria-label={t('back')}
            className="grid size-10 shrink-0 place-items-center rounded-pill border-[1.5px] border-ink/15 hover:border-ink"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {picked ? (
          <div className="mt-6 flex flex-1 flex-col">
            <p className="num text-[0.8125rem] text-ink-60">
              {t('per100', { kcal: nf.format(picked.kcal) })}
            </p>
            <p className="mt-5 text-ui font-bold">{t('amount')}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('amount')}>
              {[...picked.units.map((u) => u.key), 'g'].map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={unit === key}
                  onClick={() => setUnit(key)}
                  className={cn(
                    'h-10 rounded-pill border-[1.5px] px-4 text-[0.875rem] font-semibold transition-colors',
                    unit === key
                      ? 'border-ink bg-ink text-paper'
                      : 'border-ink/20 hover:border-ink',
                  )}
                >
                  {key === 'g' ? t('grams') : tu(key as 'piece')}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              {unit === 'g' ? (
                <div className="flex h-14 items-center rounded-pill border-[1.5px] border-ink/20 px-5 focus-within:border-ink">
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    aria-label={t('grams')}
                    value={grams}
                    onChange={(e) => setGrams(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
                    className="w-20 bg-transparent num text-[1.5rem] outline-none"
                  />
                  <span className="num text-ink-60">{tu('g')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={t('decrease')}
                    onClick={() => setQty((v) => Math.max(0.5, v - 0.5))}
                    className="grid size-12 place-items-center rounded-pill border-[1.5px] border-ink/20 hover:border-ink"
                  >
                    <MinusIcon size={18} />
                  </button>
                  <p className="min-w-16 text-center num text-[1.75rem]" aria-live="polite">
                    {nf1.format(qty)}
                  </p>
                  <button
                    type="button"
                    aria-label={t('increase')}
                    onClick={() => setQty((v) => Math.min(20, v + 0.5))}
                    className="grid size-12 place-items-center rounded-pill bg-ink text-paper"
                  >
                    <PlusIcon size={18} />
                  </button>
                  <span className="text-ui text-ink-60">{tu(unit as 'piece')}</span>
                </div>
              )}
            </div>
            <p className="mt-4 num text-[0.9375rem]">
              {preview != null
                ? `${nf.format(Math.round(gramsValue))} ${tu('g')} · ${nf.format(preview)} ${tu('kcal')}`
                : '—'}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
              <MotionButton
                size="lg"
                state={busy ? 'loading' : 'idle'}
                disabled={busy || !validAmount}
                onClick={addPicked}
              >
                {t('addButton')}
              </MotionButton>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-ui font-semibold underline underline-offset-4"
              >
                {t('back')}
              </button>
            </div>
          </div>
        ) : free !== null ? (
          <div className="mt-6 flex flex-1 flex-col">
            <label className="block">
              <span className="sr-only">{t('writeIt')}</span>
              <input
                autoFocus
                dir="auto"
                value={free}
                maxLength={160}
                onChange={(e) => setFree(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  free.trim() &&
                  submit({ day, slot, items: [{ kind: 'free', name: free.trim() }] })
                }
                placeholder={t('freePlaceholder')}
                className="h-14 w-full border-b-[1.5px] border-ink/30 bg-transparent text-[1.125rem] outline-none focus:border-ink"
              />
            </label>
            <p className="mt-3 text-[0.8125rem] text-ink-60">{t('freeHint')}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
              <MotionButton
                size="lg"
                state={busy ? 'loading' : 'idle'}
                disabled={busy || !free.trim()}
                onClick={() => submit({ day, slot, items: [{ kind: 'free', name: free.trim() }] })}
              >
                {t('addButton')}
              </MotionButton>
              <button
                type="button"
                onClick={() => setFree(null)}
                className="text-ui font-semibold underline underline-offset-4"
              >
                {t('back')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-1 flex-col">
            <label className="block">
              <span className="sr-only">{t('search')}</span>
              <input
                type="search"
                dir="auto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                autoFocus={desktop}
                className="h-12 w-full rounded-pill border-[1.5px] border-ink/20 bg-paper px-5 text-[1rem] outline-none focus:border-ink"
              />
            </label>
            <div className="mt-2 flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
              {q ? (
                results.length ? (
                  <ul>
                    {results.slice(0, 60).map((f) => (
                      <FoodRow
                        key={f.id}
                        food={f}
                        per100={t('per100', { kcal: nf.format(f.kcal) })}
                        onPick={pick}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-ink-60">{t('noResults')}</p>
                )
              ) : (
                <>
                  {recent.length > 0 && (
                    <section className="mt-3">
                      <p className="label text-ink-60">{t('recent')}</p>
                      <ul>
                        {recent.map((f) => (
                          <FoodRow
                            key={f.id}
                            food={f}
                            per100={t('per100', { kcal: nf.format(f.kcal) })}
                            onPick={pick}
                          />
                        ))}
                      </ul>
                    </section>
                  )}
                  {grouped.map(([cat, list]) => (
                    <section key={cat} className="mt-5">
                      <p className="sticky top-0 bg-paper py-1 label text-ink-60">
                        {t(`categories.${cat}`)}
                      </p>
                      <ul>
                        {list.map((f) => (
                          <FoodRow
                            key={f.id}
                            food={f}
                            per100={t('per100', { kcal: nf.format(f.kcal) })}
                            onPick={pick}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </>
              )}
            </div>
            <div className="mt-4 border-t border-ink/10 pt-4">
              <p className="text-[0.875rem] text-ink-60">{t('notListed')}</p>
              <button
                type="button"
                onClick={() => setFree(query)}
                className="mt-2 inline-flex h-11 items-center rounded-pill border-[1.5px] border-ink px-5 text-ui font-semibold hover:bg-ink hover:text-paper"
              >
                {t('writeIt')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

function FoodRow({
  food,
  per100,
  onPick,
}: {
  food: FoodOption;
  per100: string;
  onPick: (f: FoodOption) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(food)}
        className="flex w-full items-center justify-between gap-3 border-b border-ink/10 py-3 text-start transition-colors hover:bg-ink/[0.03]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[1rem] font-semibold">{food.name}</span>
          <span className="block num text-[0.75rem] text-ink-60">{per100}</span>
        </span>
        <ChevronIcon size={18} className="shrink-0 text-ink-60" />
      </button>
    </li>
  );
}
