'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getVersionAction,
  listVersionsAction,
  snapshotAction,
} from '@/app/admin/_actions/programs';
import type { ProgramTree } from '@/types/admin';
import { Button, Input, Sheet } from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';

export function VersionsSheet({
  open,
  onOpenChange,
  programId,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  programId: string;
  onRestore: (t: ProgramTree) => void;
}) {
  const t = useTranslations('admin.programs');
  const format = useFormatter();
  const [versions, setVersions] = useState<
    { id: string; label: string | null; created_at: string }[] | null
  >(null);
  const [label, setLabel] = useState('');
  const [state, setState] = useState<ActionState>('idle');

  const load = () => listVersionsAction(programId).then(setVersions);
  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const snap = async () => {
    setState('loading');
    await snapshotAction(programId, label || null);
    setLabel('');
    setState('success');
    toast.success(t('snapshotSaved'));
    await load();
    setTimeout(() => setState('idle'), 900);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('versions')} width="sm">
      <div className="flex items-end gap-2">
        <Input
          label={t('snapshot')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1"
        />
        <Button variant="primary" state={state} onClick={snap}>
          {t('snapshot')}
        </Button>
      </div>
      <ul className="mt-6 divide-y divide-a-border">
        {versions?.length === 0 && (
          <li className="py-3 text-[0.875rem] text-a-muted">{t('noVersions')}</li>
        )}
        {versions?.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-3">
            <span>
              <span className="block font-semibold">{v.label ?? '—'}</span>
              <span className="num text-[0.75rem] text-a-muted">
                {format.dateTime(new Date(v.created_at), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </span>
            <Button
              size="sm"
              onClick={async () => {
                const tree = await getVersionAction(v.id);
                if (tree) {
                  onRestore(tree);
                  toast.success(t('restoreVersion'));
                  onOpenChange(false);
                }
              }}
            >
              {t('restoreVersion')}
            </Button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
