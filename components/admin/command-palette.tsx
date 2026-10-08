'use client';

import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Dialog as D } from 'radix-ui';
import { admin } from '@/lib/motion';
import { ADMIN_NAV } from './nav';

/** Ctrl/⌘+K: navigate, create, jump to a client. Keyboard-first, restrained motion. */
export function CommandPalette({
  open,
  onOpenChange,
  clients,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: { id: string; full_name: string }[];
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const item =
    'flex h-10 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 text-[0.875rem] data-[selected=true]:bg-a-accent data-[selected=true]:text-a-accent-text';
  const group =
    'px-2 pb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-a-muted';

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="bg-black/40 fixed inset-0 z-[90]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: admin.dur }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="a-glass fixed start-1/2 top-[12vh] z-[91] w-[calc(100vw-24px)] max-w-[620px] overflow-hidden text-a-text ltr:-translate-x-1/2 rtl:translate-x-1/2"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: admin.dur, ease: admin.ease }}
              >
                <D.Title className="sr-only">{t('nav.command')}</D.Title>
                <Command label={t('nav.command')} loop>
                  <Command.Input
                    autoFocus
                    placeholder={t('palette.placeholder')}
                    className="h-14 w-full border-b border-a-border bg-transparent px-5 text-[1rem] outline-none placeholder:text-a-muted"
                  />
                  <Command.List className="a-scroll max-h-[56vh] overflow-y-auto py-1">
                    <Command.Empty className="px-5 py-6 text-[0.875rem] text-a-muted">
                      {t('palette.empty')}
                    </Command.Empty>
                    <Command.Group heading={t('palette.create')} className={group}>
                      <Command.Item className={item} onSelect={() => go('/admin/clients?new=1')}>
                        {t('dashboard.quickClient')}
                      </Command.Item>
                      <Command.Item className={item} onSelect={() => go('/admin/programs?new=1')}>
                        {t('dashboard.quickProgram')}
                      </Command.Item>
                      <Command.Item className={item} onSelect={() => go('/admin/recipes/new')}>
                        {t('dashboard.quickRecipe')}
                      </Command.Item>
                      <Command.Item
                        className={item}
                        onSelect={() => go('/admin/appointments?new=1')}
                      >
                        {t('dashboard.quickAppointment')}
                      </Command.Item>
                    </Command.Group>
                    <Command.Group heading={t('palette.navigate')} className={group}>
                      {ADMIN_NAV.map((n) => (
                        <Command.Item
                          key={n.key}
                          className={item}
                          onSelect={() => go(n.href)}
                          keywords={[n.key]}
                        >
                          {t(`nav.${n.key}`)}
                          <span className="num text-[0.6875rem] opacity-60">
                            {n.href.replace('/admin', '') || '/'}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                    {clients.length > 0 && (
                      <Command.Group heading={t('palette.clients')} className={group}>
                        {clients.map((c) => (
                          <Command.Item
                            key={c.id}
                            value={`${c.full_name} ${c.id}`}
                            className={item}
                            onSelect={() => go(`/admin/clients/${c.id}`)}
                          >
                            {c.full_name}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                  </Command.List>
                </Command>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
