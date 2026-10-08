import type { routing } from '@/lib/i18n/routing';
import type { Messages } from '@/lib/i18n/messages';

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
  }
}
