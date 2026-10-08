import 'server-only';
import { getTranslations } from 'next-intl/server';
import { locales } from '@/lib/i18n/config';
import type { ReminderTemplates } from '@/components/admin/dashboard/agenda';

/**
 * Appointment reminder texts in every language: a reminder goes out in the CLIENT's language,
 * whatever language the panel is in (like the portal invite text).
 */
export async function reminderTemplates(): Promise<ReminderTemplates> {
  const entries = await Promise.all(
    locales.map(async (locale) => {
      const [text, portal, kinds, meta] = await Promise.all([
        getTranslations({ locale, namespace: 'portal.reminderText' }),
        getTranslations({ locale, namespace: 'portal' }),
        getTranslations({ locale, namespace: 'admin.appointments.kinds' }),
        getTranslations({ locale, namespace: 'meta' }),
      ]);
      return [
        locale,
        {
          text: text.raw('appointment') as string,
          birthday: portal.raw('birthdayText') as string,
          kinds: { in_person: kinds('in_person'), online: kinds('online'), phone: kinds('phone') },
          signature: meta('siteName'),
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as ReminderTemplates;
}
