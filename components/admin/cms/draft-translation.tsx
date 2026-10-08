'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { draftTranslationAction } from '@/app/admin/_actions/translate';
import type { Locale } from '@/lib/i18n/config';
import { Button } from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';

type RecipeDraft = {
  title: string;
  summary: string;
  steps: string[];
  tips: string | null;
  slug: string;
};
type ArticleDraft = { title: string; excerpt: string; body: string; slug: string };

export function DraftTranslationButton<K extends 'recipe' | 'article'>({
  enabled,
  kind,
  id,
  to,
  onDraft,
}: {
  enabled: boolean;
  kind: K;
  id: string;
  to: Locale;
  onDraft: (d: K extends 'recipe' ? RecipeDraft : ArticleDraft) => void;
}) {
  const t = useTranslations('admin.cms');
  const tc = useTranslations('admin.common');
  const [state, setState] = useState<ActionState>('idle');
  if (!enabled) return <p className="text-[0.75rem] text-a-muted">{t('translationUnavailable')}</p>;
  return (
    <div className="rounded-[12px] border border-dashed border-a-border p-3">
      <Button
        size="sm"
        state={state}
        onClick={async () => {
          setState('loading');
          const res = await draftTranslationAction(kind, id, to);
          if (!res.ok) {
            setState('error');
            toast.error(res.error === 'unavailable' ? t('translationUnavailable') : tc('error'));
            setTimeout(() => setState('idle'), 900);
            return;
          }
          onDraft(res.draft as K extends 'recipe' ? RecipeDraft : ArticleDraft);
          setState('success');
          setTimeout(() => setState('idle'), 900);
        }}
      >
        {t('draftTranslation')}
      </Button>
      <p className="mt-2 text-[0.75rem] text-a-muted">{t('draftTranslationHint')}</p>
    </div>
  );
}
