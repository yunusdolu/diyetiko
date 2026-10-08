'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { setAdminPreference } from '@/app/admin/_actions/auth';
import type { Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/site/header';
import { FirstRun } from '@/components/guide/first-run';
import { CommandPalette } from './command-palette';
import { TabsBar } from './tabs-bar';
import { ADMIN_NAV, DOCK, NavIcon } from './nav';
import { DesktopSidebar, MobileDrawer, SIDEBAR_COOKIE, type SidebarProps } from './sidebar';

export { ADMIN_NAV } from './nav';

export function AdminShell({
  children,
  email,
  newLeads,
  unread = 0,
  clients,
  locale,
  theme,
  localMode,
  sidebar = 'expanded',
}: {
  children: ReactNode;
  email: string;
  newLeads: number;
  /** unread client portal messages */
  unread?: number;
  clients: { id: string; full_name: string }[];
  locale: Locale;
  theme: 'light' | 'dark';
  localMode: boolean;
  /** desktop rail state, from the cookie (so the server renders the right width) */
  sidebar?: 'expanded' | 'collapsed';
}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // the theme lives here, so the switch (and its icon) answers on the very click; the server's
  // value (cookie) takes over again whenever the layout re-renders with a newer one
  const [themeNow, setThemeNow] = useState(theme);
  const [serverTheme, setServerTheme] = useState(theme);
  if (serverTheme !== theme) {
    setServerTheme(theme);
    setThemeNow(theme);
  }
  const [pinned, setPinned] = useState(sidebar !== 'collapsed');

  const [, startTransition] = useTransition();

  const pin = useCallback((open: boolean) => {
    setPinned(open);
    document.cookie = `${SIDEBAR_COOKIE}=${open ? 'expanded' : 'collapsed'}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (
        k === 'b' &&
        !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')
      ) {
        e.preventDefault();
        setPinned((o) => {
          document.cookie = `${SIDEBAR_COOKIE}=${o ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
          return !o;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  // a marker for end-to-end tests: the panel answers clicks from here on
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);

  // Page transitions (globals.css): the "knife cut" plays only when the path really changes —
  // set inside React's view-transition commit, before the browser builds the animation — never
  // for a refresh after saving a form.
  const lastPath = useRef(pathname);
  useLayoutEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const root = document.documentElement;
    root.dataset.navCut = '';
    const timer = window.setTimeout(() => delete root.dataset.navCut, 900);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  /** Day/night: the new theme opens as a circle from the switch, over the old one. */
  const switchTheme = (next: 'light' | 'dark', from?: { x: number; y: number }) => {
    const root = document.documentElement;
    const apply = () => {
      flushSync(() => setThemeNow(next));
      root.dataset.theme = next;
    };
    // saved on the client like the sidebar (no server round trip, no refresh mid-animation)
    document.cookie = `admin_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    if (
      typeof document.startViewTransition !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      apply();
      return;
    }
    const x = from?.x ?? window.innerWidth / 2;
    const y = from?.y ?? window.innerHeight / 2;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.dataset.vtTheme = next;
    const vt = document.startViewTransition(apply);
    vt.ready
      .then(() => {
        const opts = { duration: 720, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' };
        root.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`],
          },
          { ...opts, pseudoElement: '::view-transition-new(root)' },
        );
        // the old screen sinks back a touch as the new one sweeps over it
        root.animate(
          { filter: ['brightness(1)', `brightness(${next === 'dark' ? 0.75 : 1.08})`] },
          { ...opts, pseudoElement: '::view-transition-old(root)' },
        );
      })
      .catch(() => {});
    vt.finished.finally(() => delete root.dataset.vtTheme).catch(() => {});
  };

  const setPref = (kind: 'locale' | 'theme', value: string, from?: { x: number; y: number }) => {
    if (kind === 'theme') {
      if (value === 'light' || value === 'dark') switchTheme(value, from);
      return;
    }
    startTransition(async () => {
      await setAdminPreference(kind, value);
      router.refresh();
    });
  };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
  const badge = (key: (typeof DOCK)[number]) => (key === 'messages' ? unread : 0);

  const shared: SidebarProps = {
    pathname,
    newLeads,
    unread,
    email,
    locale,
    theme: themeNow,
    localMode,
    onSearch: () => {
      setMenuOpen(false);
      setPaletteOpen(true);
    },
    onPreference: setPref,
  };

  const dock = (
    <nav
      aria-label={t('nav.more')}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden print:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between rounded-[20px] border border-a-border bg-a-surface/90 p-1.5 shadow-[0_18px_40px_-20px_rgb(15_27_23/0.45)] backdrop-blur-md">
        {DOCK.map((key) => {
          const item = ADMIN_NAV.find((n) => n.key === key)!;
          const active = isActive(item.href);
          const n = badge(key);
          return (
            <li key={key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 flex-col items-center justify-center gap-1 rounded-[14px] text-[0.6875rem] font-semibold transition-colors',
                  active ? 'text-a-accent-text' : 'text-a-muted',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-dock"
                    className="absolute inset-0 rounded-[14px] bg-a-accent"
                    transition={admin.spring}
                  />
                )}
                <span className="relative">
                  <NavIcon name={key} size={20} />
                  {n > 0 && (
                    <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-pill bg-paprika px-1 num text-[0.625rem] text-ink">
                      {n}
                    </span>
                  )}
                </span>
                <span className="relative max-w-full truncate px-1">{t(`nav.${key}`)}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            className="flex h-14 w-full flex-col items-center justify-center gap-1 rounded-[14px] text-[0.6875rem] font-semibold text-a-muted"
          >
            <NavIcon name="menu" size={20} />
            {t('nav.more')}
          </button>
        </li>
      </ul>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:flex lg:overflow-x-clip">
      <DesktopSidebar {...shared} pinned={pinned} onPinnedChange={pin} />

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-a-border bg-a-surface/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <BrandMark className="size-6 text-a-text" />
          <span className="font-display text-[1.1rem] ar:font-bold">{t('brand')}</span>
        </Link>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={t('nav.command')}
          className="inline-flex h-9 items-center gap-2 rounded-pill border border-a-border bg-a-surface px-3 text-[0.8125rem] text-a-muted transition-transform active:scale-95"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t('nav.search')}
        </button>
      </header>
      <MobileDrawer {...shared} open={menuOpen} onOpenChange={setMenuOpen} />

      <main
        id="admin-main"
        className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-0 lg:pb-8"
      >
        <TabsBar />
        {children}
      </main>
      {dock}
      {!pathname.startsWith('/admin/help') && (
        <FirstRun
          scope="admin"
          href="/admin/help"
          title={t('help.tour.title')}
          text={t('help.tour.text')}
          start={t('help.tour.start')}
          later={t('help.tour.later')}
        />
      )}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} clients={clients} />
    </div>
  );
}
