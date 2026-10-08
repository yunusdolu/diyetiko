import type { ComponentProps } from 'react';
import { getTranslations } from 'next-intl/server';
import { getSettings } from '@/lib/admin/cms';
import { requireUser } from '@/lib/auth';
import { backend } from '@/lib/env';
import { loadMessages } from '@/lib/i18n/messages';
import { locales } from '@/lib/i18n/config';
import { SettingsView } from '@/components/admin/settings-view';
import { seedSettings } from '@/lib/content/seed/settings';

export async function generateMetadata() {
  const t = await getTranslations('admin.settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  // Message-file defaults, so each locale tab starts from what the site shows today.
  const defaults = Object.fromEntries(
    await Promise.all(
      locales.map(async (l) => {
        const m = await loadMessages(l);
        return [
          l,
          { heroLines: m.home.hero.lines, heroLead: m.home.hero.lead, faq: m.faq.items },
        ] as const;
      }),
    ),
  ) as ComponentProps<typeof SettingsView>['defaults'];
  return (
    <SettingsView
      settings={settings}
      contact={
        {
          ...seedSettings.contact,
          ...(settings.base.contact as object),
        } as typeof seedSettings.contact
      }
      images={
        {
          ...seedSettings.images,
          ...(settings.base.images as object),
        } as typeof seedSettings.images
      }
      defaults={defaults}
      supabase={backend() === 'supabase'}
    />
  );
}
