'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { deleteArticleAction, saveArticleAction } from '@/app/admin/_actions/cms';
import type { ArticleEdit } from '@/lib/admin/cms';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { slugify } from '@/lib/slug';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Input,
  Label,
  PageTitle,
  Panel,
  Select,
  Textarea,
} from '@/components/admin/ui';
import { Ingredient, illustrationKeys } from '@/components/site/ingredients';
import { Switch } from '@/components/ui/checkbox';
import type { ActionState } from '@/components/ui/status-icon';
import { statusTone } from './cms-list';
import { DraftTranslationButton } from './draft-translation';
import { MediaUpload } from './media-upload';

type T = ArticleEdit['translations'][number];
const emptyT = (locale: Locale): T => ({
  locale,
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  translation_status: locale === 'tr' ? 'needs_review' : 'draft',
});

/** "Title | Publisher | URL" per line ⇄ sources array. */
function parseSources(text: string) {
  return text
    .split('\n')
    .map((l) => l.split('|').map((x) => x.trim()))
    .filter(([title]) => title)
    .map(([title, publisher, url]) => ({
      title: title!,
      publisher: publisher ?? '',
      ...(url ? { url } : {}),
    }));
}

export function GuideEditor({
  article,
  canDraftTranslate,
}: {
  article: ArticleEdit | null;
  canDraftTranslate: boolean;
}) {
  const t = useTranslations('admin.cms');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [published, setPublished] = useState(article?.published ?? false);
  const [illustration, setIllustration] = useState(article?.illustration ?? 'bread');
  const [cover, setCover] = useState<string | null>(article?.cover_path ?? null);
  const [category, setCategory] = useState<ArticleEdit['category']>(article?.category ?? 'basics');
  const [readingMin, setReadingMin] = useState(article?.reading_min ?? 3);
  const [sources, setSources] = useState(
    (article?.sources ?? [])
      .map((s) => [s.title, s.publisher, s.url].filter(Boolean).join(' | '))
      .join('\n'),
  );
  const [translations, setTranslations] = useState<Partial<Record<Locale, T>>>(
    Object.fromEntries((article?.translations ?? [emptyT('tr')]).map((x) => [x.locale, x])),
  );
  const [locale, setLocale] = useState<Locale>('tr');
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const cur = translations[locale] ?? emptyT(locale);
  const setCur = (patch: Partial<T>) =>
    setTranslations((all) => ({ ...all, [locale]: { ...cur, ...patch } }));

  const save = async () => {
    setState('loading');
    setError(null);
    const res = await saveArticleAction(article?.id ?? null, {
      published,
      illustration,
      cover_path: cover,
      category,
      reading_min: readingMin,
      sources: parseSources(sources),
      translations: Object.values(translations).filter((x): x is T => Boolean(x && x.title.trim())),
    });
    if (!res.ok) {
      setState('error');
      setError(res.error ?? tc('error'));
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tc('saved'));
    setTimeout(() => setState('idle'), 1000);
    if (!article && res.data) router.replace(`/admin/guides/${res.data.id}`);
    else router.refresh();
  };

  return (
    <div>
      <PageTitle
        eyebrow={
          <Link href="/admin/guides" className="hover:underline">
            {t('guidesTitle')}
          </Link>
        }
        title={translations.tr?.title || t('newGuide')}
        actions={
          <>
            {article && (
              <Button
                variant="ghost"
                className="text-a-danger"
                onClick={async () => {
                  await deleteArticleAction(article.id);
                  router.push('/admin/guides');
                }}
              >
                {tc('delete')}
              </Button>
            )}
            <Button variant="primary" state={state} onClick={save}>
              {tc('save')}
            </Button>
          </>
        }
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[10px] bg-[color-mix(in_oklab,var(--a-danger)_12%,transparent)] px-4 py-2 text-[0.875rem] text-a-danger"
        >
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Panel title={t('published')}>
            <Switch
              checked={published}
              onCheckedChange={setPublished}
              label={published ? t('published') : t('draft')}
              description={t('reviewRule')}
            />
          </Panel>
          <Panel title={t('illustration')}>
            <div className="flex flex-wrap gap-2">
              {illustrationKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIllustration(k)}
                  aria-pressed={illustration === k}
                  title={k}
                  className={cn(
                    'grid size-12 place-items-center rounded-[12px] border',
                    illustration === k ? 'border-a-text bg-a-surface-2' : 'border-a-border',
                  )}
                >
                  <Ingredient name={k} className="size-9" />
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label>{t('cover')}</Label>
              <MediaUpload kind="recipe" value={cover} onChange={setCover} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Select
                label={t('category')}
                value={category}
                onChange={(e) => setCategory(e.target.value as ArticleEdit['category'])}
                options={(['basics', 'habits', 'labels', 'kitchen'] as const).map((c) => ({
                  value: c,
                  label: t(`categoryOptions.${c}`),
                }))}
              />
              <Input
                type="number"
                label={t('readingMin')}
                value={readingMin}
                min={1}
                onChange={(e) => setReadingMin(Number(e.target.value))}
              />
            </div>
          </Panel>
          <Panel title={t('sources')}>
            <Textarea
              hint={t('sourcesHint')}
              label={t('sources')}
              rows={6}
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              dir="ltr"
            />
          </Panel>
        </div>
        <Panel
          title={t('title')}
          action={
            <Badge tone={statusTone[cur.translation_status]}>
              {t(`translationStatus.${cur.translation_status}`)}
            </Badge>
          }
        >
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label={tc('language')}>
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={locale === l}
                onClick={() => setLocale(l)}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[0.8125rem] font-semibold',
                  locale === l
                    ? 'border-a-text bg-a-accent text-a-accent-text'
                    : 'border-a-border hover:bg-a-surface-2',
                )}
              >
                {localeNames[l]}
                <span
                  className={cn(
                    'size-2 rounded-full',
                    !translations[l]?.title
                      ? 'bg-a-danger'
                      : translations[l]!.translation_status === 'reviewed'
                        ? 'bg-a-ok'
                        : 'bg-mustard',
                  )}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={locale}
              className="grid gap-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: admin.dur }}
              lang={locale}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            >
              <Input
                label={t('title')}
                value={cur.title}
                onChange={(e) =>
                  setCur({
                    title: e.target.value,
                    ...(locale !== 'ar' && (!cur.slug || cur.slug === slugify(cur.title))
                      ? { slug: slugify(e.target.value) }
                      : {}),
                  })
                }
              />
              <Input
                label={t('slug')}
                value={cur.slug}
                dir="ltr"
                onChange={(e) => setCur({ slug: e.target.value.toLowerCase() })}
              />
              <Textarea
                label={t('excerpt')}
                rows={2}
                value={cur.excerpt}
                onChange={(e) => setCur({ excerpt: e.target.value })}
              />
              <Textarea
                label={t('body')}
                hint={t('bodyHint')}
                rows={16}
                value={cur.body}
                onChange={(e) => setCur({ body: e.target.value })}
              />
              <Select
                label={tc('status')}
                value={cur.translation_status}
                onChange={(e) =>
                  setCur({ translation_status: e.target.value as T['translation_status'] })
                }
                options={(['draft', 'needs_review', 'reviewed'] as const).map((s) => ({
                  value: s,
                  label: t(`translationStatus.${s}`),
                }))}
              />
              {locale !== 'tr' && article && (
                <DraftTranslationButton
                  enabled={canDraftTranslate}
                  kind="article"
                  id={article.id}
                  to={locale}
                  onDraft={(d) => setCur({ ...d, translation_status: 'needs_review' })}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </Panel>
      </div>
    </div>
  );
}
