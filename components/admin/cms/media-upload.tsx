'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { publicMediaUrl } from '@/lib/storage/urls';
import { cn } from '@/lib/utils';

/** Upload to a public media bucket; returns the object path to store on the record. */
export function MediaUpload({
  kind,
  value,
  onChange,
}: {
  kind: 'recipe' | 'site';
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const t = useTranslations('admin.common');
  const tf = useTranslations('admin.files');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const url = publicMediaUrl(kind === 'recipe' ? 'recipe-media' : 'site-media', value);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const body = new FormData();
    body.set('file', file);
    body.set('kind', kind);
    const res = await fetch('/api/admin/upload', { method: 'POST', body });
    setBusy(false);
    if (!res.ok) {
      toast.error(
        res.status === 415 ? tf('badType') : res.status === 413 ? tf('tooLarge') : t('error'),
      );
      return;
    }
    const { path } = (await res.json()) as { path: string };
    onChange(path);
  };

  return (
    <div className="flex items-center gap-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void upload(e.dataTransfer.files[0]);
        }}
        className={cn(
          'grid h-24 flex-1 cursor-pointer place-items-center rounded-[12px] border-2 border-dashed text-center text-[0.8125rem] transition-colors',
          drag ? 'border-a-text bg-a-surface-2' : 'border-a-border hover:border-a-text/40',
        )}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        {busy ? t('uploading') : t('dropHere')}
      </label>
      {url && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="size-24 rounded-[12px] object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-pill bg-a-danger text-white"
            aria-label={t('remove')}
          >
            <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
