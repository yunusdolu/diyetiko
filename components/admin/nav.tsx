/** The panel's sections: one list for the sidebar, the phone dock and the command palette. */
export type NavGroup = 'top' | 'practice' | 'planning' | 'site' | 'bottom';
export const ADMIN_NAV = [
  { key: 'dashboard', href: '/admin', group: 'top' },
  { key: 'clients', href: '/admin/clients', group: 'practice' },
  { key: 'messages', href: '/admin/messages', group: 'practice' },
  { key: 'appointments', href: '/admin/appointments', group: 'practice' },
  { key: 'payments', href: '/admin/payments', group: 'practice' },
  { key: 'leads', href: '/admin/leads', group: 'practice' },
  { key: 'programs', href: '/admin/programs', group: 'planning' },
  { key: 'explorer', href: '/admin/explorer', group: 'planning' },
  { key: 'recipes', href: '/admin/recipes', group: 'site' },
  { key: 'guides', href: '/admin/guides', group: 'site' },
  { key: 'foods', href: '/admin/foods', group: 'site' },
  { key: 'settings', href: '/admin/settings', group: 'bottom' },
  { key: 'help', href: '/admin/help', group: 'bottom' },
] as const satisfies readonly { key: string; href: string; group: NavGroup }[];
export type NavKey = (typeof ADMIN_NAV)[number]['key'];
export const GROUPS: NavGroup[] = ['top', 'practice', 'planning', 'site', 'bottom'];
/** phones: the four places used every day, plus the full menu */
export const DOCK: NavKey[] = ['dashboard', 'clients', 'messages', 'appointments'];

const ICONS: Record<NavKey | 'menu', string> = {
  dashboard: 'M4 11.5 12 4l8 7.5M6 10v10h12V10M10 20v-5.5h4V20',
  clients:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14.5a6 6 0 0 1 4 6.5',
  messages: 'M4 5h16v11H9l-5 4V5ZM8 9.5h8M8 12.5h5',
  appointments: 'M4 6h16v14H4V6ZM4 10h16M9 3v4M15 3v4M8 14h3M8 17h6',
  payments: 'M3 7h18v11H3V7ZM3 11h18M7 15h3M15.5 15h1.5',
  leads: 'M4 13l2.5-8h11L20 13M4 13v6h16v-6M4 13h5l1 2.5h4l1-2.5h5',
  programs: 'M7 4h10v17H7V4ZM9.5 2.5h5V5h-5V2.5ZM10 10h4M10 13.5h4M10 17h2',
  explorer: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z',
  recipes: 'M4 12h16a8 8 0 0 1-16 0ZM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4',
  guides: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5ZM4 20a2 2 0 0 0 2 2h13v-4M9 8h6',
  foods:
    'M12 8c-3-3-8-1-8 4 0 5 4 9 6 9 1 0 1.3-.5 2-.5s1 .5 2 .5c2 0 6-4 6-9 0-5-5-7-8-4ZM12 8c0-2 1-4 3-5',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9M12 16.6v.1',
  menu: 'M4 7h16M4 12h16M4 17h10',
};

/** 18 px line icons, one per section (stroke = currentColor). */
export function NavIcon({ name, size = 18 }: { name: NavKey | 'menu'; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
