'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  logPlannedMealAction,
  removeDiaryItemAction,
  removeMealPhotoAction,
  updateMealAction,
} from '@/app/panel/_actions';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { dur, ease } from '@/lib/motion';
import { preparePhoto } from '@/lib/portal/compress';
import { cn } from '@/lib/utils';
import {
  MEAL_SLOTS,
  type DiaryItem,
  type DiaryMeal,
  type FoodOption,
  type MealSlot,
  type ProgramMeal,
} from '@/types/portal';
import { MotionButton } from '@/components/ui/motion-button';
import { Overlay } from '@/components/ui/overlay';
import { CameraIcon, CloseIcon, MessageIcon, NoteIcon, PlusIcon } from '../icons';
import { AddFoodSheet } from './add-food-sheet';

const MAIN: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export function DiaryDay({
  day,
  meals,
  planned,
  foods,
  recentFoodIds,
  editable,
}: {
  day: string;
  meals: DiaryMeal[];
  planned: ProgramMeal[];
  foods: FoodOption[];
  recentFoodIds: string[];
  editable: boolean;
}) {
  const t = useTranslations('portal.diary');
  const tm = useTranslations('meals');
  const [adding, setAddingNow] = useState<MealSlot | null>(null);
  /** the meal the sheet was last opened for: kept while it closes, so the exit can play */
  const [lastSlot, setLastSlot] = useState<MealSlot | null>(null);
  const setAdding = (slot: MealSlot | null) => {
    if (slot) setLastSlot(slot);
    setAddingNow(slot);
  };
  const [extra, setExtra] = useState<MealSlot[]>([]);
  const bySlot = new Map(meals.map((m) => [m.slot, m]));
  const plannedBySlot = new Map(planned.filter((m) => m.items.length).map((m) => [m.slot, m]));
  const visible = MEAL_SLOTS.filter(
    (s) => MAIN.includes(s) || bySlot.has(s) || plannedBySlot.has(s) || extra.includes(s),
  );
  const hidden = MEAL_SLOTS.filter((s) => !visible.includes(s));

  return (
    <div className="grid gap-4">
      {visible.map((slot) => (
        <SlotCard
          key={slot}
          day={day}
          slot={slot}
          meal={bySlot.get(slot) ?? null}
          plan={plannedBySlot.get(slot) ?? null}
          editable={editable}
          onAdd={() => setAdding(slot)}
        />
      ))}
      {editable && hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {hidden.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setExtra((x) => [...x, s]);
                setAdding(s);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-pill border-[1.5px] border-dashed border-ink/30 px-4 text-[0.875rem] font-semibold text-ink-70 hover:border-ink hover:text-ink"
            >
              <PlusIcon size={16} />
              {tm(s)}
            </button>
          ))}
        </div>
      )}
      <p className="pt-2 text-[0.8125rem] text-ink-60">{t('privacy')}</p>
      {lastSlot && (
        <AddFoodSheet
          open={adding !== null}
          onOpenChange={(o) => !o && setAdding(null)}
          day={day}
          slot={lastSlot}
          foods={foods}
          recentFoodIds={recentFoodIds}
        />
      )}
    </div>
  );
}

function SlotCard({
  day,
  slot,
  meal,
  plan,
  editable,
  onAdd,
}: {
  day: string;
  slot: MealSlot;
  meal: DiaryMeal | null;
  plan: ProgramMeal | null;
  editable: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations('portal.diary');
  const tm = useTranslations('meals');
  const tu = useTranslations('units');
  const tp = useTranslations('portal.today');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(meal?.note ?? '');
  const [time, setTime] = useState(meal?.time_label ?? '');
  const [saving, setSaving] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [busyPlan, setBusyPlan] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const items = meal?.items ?? [];
  const kcal = items.reduce((s, i) => s + (i.kcal ?? 0), 0);
  const amount = (i: DiaryItem) =>
    i.servings != null
      ? `${nf1.format(i.servings)} ${tu('portion')}`
      : i.unit_key && i.unit_qty
        ? `${nf1.format(i.unit_qty)} ${tu(i.unit_key as 'piece')}`
        : i.grams
          ? `${nf.format(i.grams)} ${tu('g')}`
          : null;

  const remove = async (item: DiaryItem) => {
    const res = await removeDiaryItemAction(item.id);
    if (res.ok) router.refresh();
    else toast.error(tp('saveFailed'));
  };

  const saveNote = async () => {
    setSaving('loading');
    const res = await updateMealAction({
      day,
      slot,
      note: note.trim() || null,
      time_label: time || null,
    });
    setSaving(res.ok ? 'success' : 'error');
    if (res.ok) {
      router.refresh();
      window.setTimeout(() => setNoteOpen(false), 500);
    }
    window.setTimeout(() => setSaving('idle'), 1000);
  };

  const addPlanned = async () => {
    setBusyPlan(true);
    const res = await logPlannedMealAction(day, slot);
    setBusyPlan(false);
    if (res.ok) {
      toast.success(tp('ateToast', { meal: tm(slot) }));
      router.refresh();
    } else toast.error(tp('saveFailed'));
  };

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const blob = await preparePhoto(f);
      const body = new FormData();
      body.set('file', blob, 'meal.jpg');
      body.set('day', day);
      body.set('slot', slot);
      const res = await fetch('/api/portal/photo', { method: 'POST', body });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      toast.error(t('photoError'));
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };

  const removePhoto = async () => {
    const res = await removeMealPhotoAction(day, slot);
    if (res.ok) {
      setPhotoOpen(false);
      router.refresh();
    } else toast.error(tp('saveFailed'));
  };

  return (
    <section aria-labelledby={`slot-${slot}`} className="p-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-ink/10 px-4 py-3.5 sm:px-5">
        <h3
          id={`slot-${slot}`}
          className="flex flex-wrap items-baseline gap-x-2 text-[1.0625rem] font-bold"
        >
          {tm(slot)}
          {meal?.time_label && (
            <span className="num text-[0.8125rem] font-normal text-ink-60">{meal.time_label}</span>
          )}
        </h3>
        {items.length > 0 && (
          <p className="shrink-0 num text-[0.875rem] font-semibold">
            {nf.format(kcal)} {tu('kcal')}
          </p>
        )}
      </header>

      <div className="px-4 py-3 sm:px-5">
        {items.length ? (
          <ul className="divide-y divide-ink/10">
            <AnimatePresence initial={false}>
              {items.map((i) => (
                <motion.li
                  key={i.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: dur.sm, ease: ease.out }}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">
                      <bdi>{i.name}</bdi>
                    </span>
                    {amount(i) && (
                      <span className="block num text-[0.75rem] text-ink-60">{amount(i)}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-end num text-[0.8125rem]',
                      i.kcal == null && 'text-ink-60',
                    )}
                  >
                    {i.kcal == null ? t('noValue') : `${nf.format(i.kcal)} ${tu('kcal')}`}
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={t('removeItem', { name: i.name })}
                      className="grid size-9 shrink-0 place-items-center rounded-pill text-ink-60 transition-colors hover:bg-ink/5 hover:text-paprika-deep"
                    >
                      <CloseIcon size={16} />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="py-1.5">
            <p className="text-[0.9375rem] text-ink-60">{t('empty')}</p>
            {plan && (
              <p className="mt-1 text-[0.8125rem] text-ink-60">
                <span className="font-semibold text-ink-70">{t('planned')}:</span>{' '}
                {plan.items.map((x) => x.name).join(', ')}
              </p>
            )}
          </div>
        )}

        {(meal?.photo_key || meal?.note) && (
          <div className="mt-3 flex items-start gap-3">
            {meal?.photo_key && (
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="shrink-0 overflow-hidden rounded-[12px] border border-ink/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- private, streamed through our own route */}
                <img
                  src={`/api/portal/photo/${meal.id}?v=${meal.photo_key}`}
                  alt={t('photoAlt', { meal: tm(slot) })}
                  className="size-20 object-cover"
                  loading="lazy"
                />
              </button>
            )}
            {meal?.note && (
              <p
                dir="auto"
                className="border-s-2 border-paprika-deep ps-3 text-start text-[0.875rem] text-ink-70"
              >
                {meal.note}
              </p>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {noteOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.sm, ease: ease.out }}
              className="overflow-hidden"
            >
              <div className="mt-3 grid gap-3 rounded-[14px] bg-paper-2/70 p-3">
                <label className="block">
                  <span className="text-[0.8125rem] font-semibold">{t('note')}</span>
                  <textarea
                    dir="auto"
                    value={note}
                    maxLength={1000}
                    rows={2}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('notePlaceholder')}
                    className="mt-1 block w-full resize-y rounded-[10px] border-[1.5px] border-ink/15 bg-paper p-2.5 text-[0.9375rem] outline-none focus:border-ink"
                  />
                </label>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="block">
                    <span className="text-[0.8125rem] font-semibold">{t('time')}</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="mt-1 block h-10 rounded-[10px] border-[1.5px] border-ink/15 bg-paper px-2 num outline-none focus:border-ink"
                    />
                  </label>
                  <MotionButton size="sm" state={saving} onClick={saveNote}>
                    {t('noteSave')}
                  </MotionButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {editable && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-ink/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-ink px-4 text-[0.875rem] font-semibold text-paper transition-transform active:scale-95"
          >
            <PlusIcon size={16} />
            {t('add')}
          </button>
          {plan && !items.length && (
            <MotionButton
              size="sm"
              variant="outline"
              state={busyPlan ? 'loading' : 'idle'}
              onClick={addPlanned}
            >
              {t('addPlanned')}
            </MotionButton>
          )}
          <span className="ms-auto flex items-center gap-1">
            {meal && (
              <Link
                href={`/panel/messages?meal=${meal.id}`}
                aria-label={t('askAbout')}
                title={t('askAbout')}
                className="grid size-10 place-items-center rounded-pill border-[1.5px] border-ink/15 transition-colors hover:border-ink"
              >
                <MessageIcon size={19} />
              </Link>
            )}
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => file.current?.click()}
              disabled={uploading}
              aria-label={meal?.photo_key ? t('changePhoto') : t('addPhoto')}
              title={meal?.photo_key ? t('changePhoto') : t('addPhoto')}
              className={cn(
                'grid size-10 place-items-center rounded-pill border-[1.5px] border-ink/15 transition-colors hover:border-ink',
                uploading && 'animate-pulse',
              )}
            >
              <CameraIcon size={19} />
            </button>
            <button
              type="button"
              onClick={() => setNoteOpen((o) => !o)}
              aria-expanded={noteOpen}
              aria-label={t('note')}
              title={t('note')}
              className={cn(
                'grid size-10 place-items-center rounded-pill border-[1.5px] transition-colors',
                noteOpen ? 'border-ink bg-ink text-paper' : 'border-ink/15 hover:border-ink',
              )}
            >
              <NoteIcon size={19} />
            </button>
          </span>
          {uploading && (
            <p role="status" className="w-full text-[0.75rem] text-ink-60">
              {t('photoUploading')}
            </p>
          )}
        </footer>
      )}

      {meal?.photo_key && (
        <Overlay
          open={photoOpen}
          onOpenChange={setPhotoOpen}
          title={t('photoAlt', { meal: tm(slot) })}
          hideTitle
        >
          <div className="p-3 sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, streamed through our own route */}
            <img
              src={`/api/portal/photo/${meal.id}?v=${meal.photo_key}`}
              alt={t('photoAlt', { meal: tm(slot) })}
              className="max-h-[70dvh] w-full rounded-[12px] object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              {editable ? (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-ui font-semibold text-paprika-deep underline underline-offset-4"
                >
                  {t('removePhoto')}
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setPhotoOpen(false)}
                className="inline-flex h-10 items-center gap-1.5 rounded-pill border-[1.5px] border-ink px-4 text-[0.875rem] font-semibold"
              >
                <CloseIcon size={16} />
                {tc('close')}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </section>
  );
}
