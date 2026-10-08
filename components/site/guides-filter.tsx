'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ArticleSummary } from '@/types/content';
import { Tabs } from '@/components/ui/tabs';
import { GuidesIndex } from './guides-index';

export function GuidesFilter({
  articles,
  categories,
}: {
  articles: ArticleSummary[];
  categories: string[];
}) {
  const t = useTranslations('guides');
  const [cat, setCat] = useState('all');
  const shown = cat === 'all' ? articles : articles.filter((a) => a.category === cat);
  return (
    <div>
      <Tabs
        label={t('title')}
        variant="line"
        value={cat}
        onChange={setCat}
        items={[
          { value: 'all', label: t('categories.all'), count: articles.length },
          ...categories.map((c) => ({
            value: c,
            label: t(`categories.${c}` as 'categories.basics'),
            count: articles.filter((a) => a.category === c).length,
          })),
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cat}
          className="mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GuidesIndex articles={shown} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
