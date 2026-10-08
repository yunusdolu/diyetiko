'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { deleteFoodAction, saveFoodAction } from '@/app/admin/_actions/cms';
import type { FoodEdit } from '@/lib/admin/cms';
import { intlLocale, localeNames, locales, type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';
import type { FoodInput } from '@/lib/validators/admin';
import { Badge, Button, Input, PageTitle, Select, Sheet } from '@/components/admin/ui';
import { SearchPill } from '@/components/admin/search-pill';
import type { ActionState } from '@/components/ui/status-icon';

const CATS = [
  'grains',
  'legumes',
  'dairy_egg',
  'meat_fish',
  'vegetables',
  'fruits',
  'nuts_seeds',
  'fats',
  'other',
] as const;
const FLAGS = ['meat', 'fish', 'dairy', 'egg', 'gluten', 'honey'] as const;

export function FoodsView({ foods }: { foods: FoodEdit[] }) {
  const t = useTranslations('admin.foods');
  const tc = useTranslations('admin.common');
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLocaleLowerCase(locale));
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<FoodEdit | 'new' | null>(null);
  const name = (f: FoodEdit) => f.names[locale] || f.names.tr || f.key;
  const nf = new Intl.NumberFormat(intlLocale(locale, 'latn'), { maximumFractionDigits: 1 });
  const shown = foods
    .filter(
      (f) =>
        (!cat || f.category === cat) &&
        (!q ||
          Object.values(f.names).join(' ').toLocaleLowerCase(locale).includes(q) ||
          f.key.includes(q)),
    )
    .sort(
      (a, b) =>
        CATS.indexOf(a.category) - CATS.indexOf(b.category) ||
        name(a).localeCompare(name(b), locale),
    );
  const unverified = foods.filter((f) => f.review_status === 'needs_review').length;

  return (
    <div>
      <PageTitle
        title={t('title')}
        eyebrow={`${foods.length} · ${t('review.needs_review')}: ${unverified}`}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            {t('new')}
          </Button>
        }
      />
      <p className="mb-4 max-w-3xl rounded-[12px] bg-a-surface-2 px-4 py-3 text-[0.8125rem] text-a-muted">
        {t('reviewNote')}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchPill
          value={query}
          onChange={setQuery}
          placeholder={tc('search')}
          label={tc('search')}
        />
        <Select
          aria-label={t('category')}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          options={[
            { value: '', label: tc('all') },
            ...CATS.map((c) => ({ value: c, label: t(`categories.${c}`) })),
          ]}
        />
      </div>
      <div className="a-card overflow-x-auto">
        <table className="w-full min-w-[820px] text-[0.8125rem]">
          <caption className="sr-only">{t('per100')}</caption>
          <thead>
            <tr className="border-b border-a-border text-a-muted">
              <th className="px-4 py-2.5 text-start font-semibold">{t('name')}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t('category')}</th>
              {(['kcal', 'protein', 'carb', 'fat', 'fiber'] as const).map((k) => (
                <th key={k} className="px-3 py-2.5 text-end font-semibold">
                  {t(k)}
                </th>
              ))}
              <th className="px-3 py-2.5 text-start font-semibold">{t('flags')}</th>
              <th className="px-4 py-2.5 text-start font-semibold">{tc('status')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr
                key={f.id}
                onClick={() => setEditing(f)}
                className="cursor-pointer border-b border-a-border last:border-0 hover:bg-a-surface-2"
              >
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="text-start font-semibold hover:underline"
                    onClick={() => setEditing(f)}
                  >
                    {name(f)}
                  </button>
                </td>
                <td className="px-3 py-2 text-a-muted">{t(`categories.${f.category}`)}</td>
                {[f.kcal, f.protein_g, f.carb_g, f.fat_g, f.fiber_g].map((v, i) => (
                  <td key={i} className="px-3 py-2 text-end num-narrow">
                    {nf.format(v)}
                  </td>
                ))}
                <td className="px-3 py-2 text-a-muted">
                  {f.flags.map((x) => t(`flagOptions.${x}`)).join(', ') || '—'}
                </td>
                <td className="px-4 py-2">
                  <Badge tone={f.review_status === 'verified' ? 'ok' : 'warn'}>
                    {t(`review.${f.review_status}`)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FoodSheet food={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function FoodSheet({ food, onClose }: { food: FoodEdit | 'new' | null; onClose: () => void }) {
  const t = useTranslations('admin.foods');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const init: FoodInput =
    food && food !== 'new'
      ? food
      : {
          key: '',
          category: 'other',
          kcal: 0,
          protein_g: 0,
          carb_g: 0,
          fat_g: 0,
          fiber_g: 0,
          flags: [],
          units: [],
          review_status: 'needs_review',
          source: null,
          names: { tr: '', en: '', fr: '', ar: '' },
        };
  const [d, setD] = useState<FoodInput>(init);
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const k = food === 'new' ? 'new' : (food?.id ?? null);
  if (k !== lastKey) {
    setLastKey(k);
    setD(init);
    setError(null);
  }
  const num = (key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g') => (
    <Input
      key={key}
      type="number"
      step="0.1"
      label={t(key === 'kcal' ? 'kcal' : (key.replace('_g', '') as 'protein'))}
      value={d[key]}
      onChange={(e) => setD({ ...d, [key]: Number(e.target.value) })}
    />
  );

  const save = async () => {
    setState('loading');
    const res = await saveFoodAction(food && food !== 'new' ? food.id : null, d);
    if (!res.ok) {
      setError(res.error ?? tc('error'));
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tc('saved'));
    router.refresh();
    setTimeout(() => {
      setState('idle');
      onClose();
    }, 400);
  };

  return (
    <Sheet
      open={food !== null}
      onOpenChange={(o) => !o && onClose()}
      title={food === 'new' ? t('new') : (food?.names.tr ?? '')}
      description={t('per100')}
      footer={
        <>
          {food && food !== 'new' && (
            <Button
              variant="ghost"
              className="me-auto text-a-danger"
              disabled={food.used > 0}
              onClick={async () => {
                const res = await deleteFoodAction(food.id);
                if (res.ok) {
                  toast.success(tc('deleted'));
                  router.refresh();
                  onClose();
                }
              }}
            >
              {tc('delete')}
            </Button>
          )}
          <Button onClick={onClose}>{tc('cancel')}</Button>
          <Button variant="primary" state={state} onClick={save}>
            {tc('save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <p role="alert" className="text-[0.8125rem] font-semibold text-a-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {locales.map((l) => (
            <Input
              key={l}
              label={`${t('name')} · ${localeNames[l]}`}
              dir={l === 'ar' ? 'rtl' : 'ltr'}
              lang={l}
              value={d.names[l]}
              onChange={(e) => setD({ ...d, names: { ...d.names, [l]: e.target.value } })}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="key"
            dir="ltr"
            value={d.key}
            onChange={(e) =>
              setD({ ...d, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
            }
          />
          <Select
            label={t('category')}
            value={d.category}
            onChange={(e) => setD({ ...d, category: e.target.value as FoodInput['category'] })}
            options={CATS.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
          />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {(['kcal', 'protein_g', 'carb_g', 'fat_g', 'fiber_g'] as const).map(num)}
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[0.8125rem] font-semibold">{t('flags')}</legend>
          <div className="flex flex-wrap gap-2">
            {FLAGS.map((fl) => (
              <button
                key={fl}
                type="button"
                aria-pressed={d.flags.includes(fl)}
                onClick={() =>
                  setD({
                    ...d,
                    flags: d.flags.includes(fl)
                      ? d.flags.filter((x) => x !== fl)
                      : [...d.flags, fl],
                  })
                }
                className={cn(
                  'h-8 rounded-pill border px-3 text-[0.8125rem] font-semibold',
                  d.flags.includes(fl)
                    ? 'border-a-text bg-a-accent text-a-accent-text'
                    : 'border-a-border',
                )}
              >
                {t(`flagOptions.${fl}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <Input
          label={t('units')}
          hint={t('unitsHint')}
          dir="ltr"
          value={d.units.map((u) => `${u.key}=${u.grams}`).join(', ')}
          onChange={(e) =>
            setD({
              ...d,
              units: e.target.value
                .split(',')
                .map((p) => p.split('=').map((x) => x.trim()))
                .filter(([key, g]) => key && Number(g) > 0)
                .map(([key, g]) => ({ key: key!, grams: Number(g) })),
            })
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={tc('status')}
            value={d.review_status}
            onChange={(e) =>
              setD({ ...d, review_status: e.target.value as FoodInput['review_status'] })
            }
            options={(['needs_review', 'verified'] as const).map((s) => ({
              value: s,
              label: t(`review.${s}`),
            }))}
          />
          <Input
            label={t('source')}
            value={d.source ?? ''}
            onChange={(e) => setD({ ...d, source: e.target.value || null })}
          />
        </div>
      </div>
    </Sheet>
  );
}
