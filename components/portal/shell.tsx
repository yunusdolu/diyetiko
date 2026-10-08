'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { portalLogoutAction } from '@/app/panel/_actions';
import type { Locale } from '@/lib/i18n/config';
import { getPathname } from '@/lib/i18n/navigation';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { FirstRun } from '@/components/guide/first-run';
import { glyphCentre, ThemeButton, ThemeGlyph, usePortalTheme } from './theme';
import { BrandMark } from '@/components/site/header';
import {
  SIDEBAR_FADE,
  SIDEBAR_MOTION,
  Sidebar,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarToggle,
} from '@/components/ui/sidebar';
import {
  AccountIcon,
  CalendarIcon,
  DiaryIcon,
  LogoutIcon,
  MessageIcon,
  ProgramIcon,
  ProgressIcon,
  TodayIcon,
} from './icons';

const NAV = [
  { href: '/panel', key: 'today', Icon: TodayIcon },
  { href: '/panel/program', key: 'program', Icon: ProgramIcon },
  { href: '/panel/diary', key: 'diary', Icon: DiaryIcon },
  { href: '/panel/progress', key: 'progress', Icon: ProgressIcon },
  { href: '/panel/messages', key: 'messages', Icon: MessageIcon },
] as const;

/** read again by app/panel/(app)/layout.tsx */
const PORTAL_SIDEBAR_COOKIE = 'portal_sidebar';
/** the dietitian panel's widths */
const RAIL = { open: 214, closed: 60 } as const;

const glyph = (d: string) =>
  function Glyph({ size = 18, className }: { size?: number; className?: string }) {
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
        className={className}
      >
        <path d={d} />
      </svg>
    );
  };
const WeekIcon = glyph('M5 20V11M12 20V4M19 20v-6M3 20h18');
const FilesIcon = glyph('M7 3h7l4 4v14H7V3ZM14 3v4h4M10 12h5M10 16h5');
const BasketIcon = glyph(
  'M3 5h2.2l2.2 10h9.8L19.5 8H6.6M9.5 20.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM16.5 20.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
);
const CalcIcon = glyph(
  'M6 3h12v18H6V3ZM9 7h6M9 11.5h.01M12 11.5h.01M15 11.5h.01M9 15h.01M12 15h.01M15 15v3M9 18h3',
);
const RecipeIcon = glyph('M4 12h16a8 8 0 0 1-16 0ZM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4');

/** the desktop sidebar's groups (phones keep the five-tab bar) */
const RAIL_GROUPS = [
  { key: 'top', label: null, items: [{ href: '/panel', key: 'today', Icon: TodayIcon }] },
  {
    key: 'follow',
    label: 'follow',
    items: [
      { href: '/panel/program', key: 'program', Icon: ProgramIcon },
      { href: '/panel/diary', key: 'diary', Icon: DiaryIcon },
      { href: '/panel/progress', key: 'progress', Icon: ProgressIcon },
      { href: '/panel/week', key: 'week', Icon: WeekIcon },
    ],
  },
  {
    key: 'contact',
    label: 'contact',
    items: [
      { href: '/panel/messages', key: 'messages', Icon: MessageIcon },
      { href: '/panel/care', key: 'care', Icon: CalendarIcon },
      { href: '/panel/files', key: 'files', Icon: FilesIcon },
    ],
  },
  {
    key: 'tools',
    label: 'tools',
    items: [
      { href: '/panel/shopping', key: 'shopping', Icon: BasketIcon },
      { href: '/tools', key: 'calc', Icon: CalcIcon, site: true },
      { href: '/recipes', key: 'recipes', Icon: RecipeIcon, site: true },
    ],
  },
] as const;

/**
 * Portal app shell. Phones/tablets: slim top bar + bottom tab bar (safe-area aware).
 * Desktop: numbered side rail in the site's marginalia style. It narrows to an icon rail and back
 * with the dietitian panel's motion (components/ui/sidebar.tsx): half a second on a soft spring,
 * the page following the real width; names, numbers and labels fade in place; the arrow beside
 * the brand collapses, and on the rail a row opens under the logo with the arrow that expands.
 * Ctrl/⌘+B does the same; the choice is kept in a cookie so the server renders the right width.
 */
export function PortalShell({
  brand,
  firstName,
  unread,
  sidebar = 'expanded',
  pulse,
  children,
}: {
  brand: string;
  firstName: string;
  unread: number;
  /** today at a glance, for the rail: how much is recorded (0…1), the streak, the next meeting */
  pulse?: { score: number; streak: number; next: string | null };
  /** desktop rail state, from the cookie */
  sidebar?: 'expanded' | 'collapsed';
  children: ReactNode;
}) {
  const t = useTranslations('portal');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(sidebar === 'collapsed');
  const [theme, setTheme] = usePortalTheme();
  // as in the dietitian panel: the page answers presses from here on (the end-to-end tests wait
  // for it instead of guessing)
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `${PORTAL_SIDEBAR_COOKIE}=${c ? 'expanded' : 'collapsed'}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b') return;
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      if (!window.matchMedia('(min-width: 1024px)').matches) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
  const fade = collapsed ? SIDEBAR_FADE.hidden : SIDEBAR_FADE.shown;
  // Page transitions (globals.css): the knife cut plays only when the path really changes — set
  // inside React's view-transition commit — never for a refresh after a value is saved.
  const lastPath = useRef(pathname);
  useLayoutEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const root = document.documentElement;
    root.dataset.navCut = '';
    const timer = window.setTimeout(() => delete root.dataset.navCut, 900);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  const isActive = (href: string) =>
    href === '/panel'
      ? pathname === '/panel'
      : pathname === href || pathname.startsWith(`${href}/`);
  const accountActive = pathname.startsWith('/panel/account');

  return (
    <div data-portal-shell="" className="min-h-dvh lg:flex">
      {/* Desktop: the dietitian panel's sidebar — same primitive, same size, same motion. The
          spacer and the sidebar over it change width together; the page follows the real width. */}
      <div
        data-sidebar-spacer=""
        className="no-print sticky top-0 z-30 hidden h-dvh shrink-0 motion-reduce:!transition-none lg:block"
        style={{
          width: collapsed ? RAIL.closed : RAIL.open,
          transition: `width ${SIDEBAR_MOTION.ms}ms ${SIDEBAR_MOTION.easing}`,
        }}
      >
        <Sidebar
          data-portal-rail=""
          className="absolute inset-y-0 start-0 will-change-[width]"
          variant="collapsible"
          collapsed={collapsed}
          onCollapsedChange={(c) => c !== collapsed && toggle()}
          width={RAIL.open}
          collapsedWidth={RAIL.closed}
          aria-label={t('nav.primary')}
          labels={{ expand: t('nav.expand'), collapse: t('nav.collapse') }}
        >
          <SidebarHeader>
            <div className="flex h-10 items-center overflow-clip">
              <Link
                href="/panel"
                aria-label={brand}
                title={collapsed ? brand : undefined}
                className="flex min-w-0 flex-1 items-center"
              >
                <span className="grid h-10 w-11 shrink-0 place-items-center">
                  <BrandMark className="size-7 text-ink" />
                </span>
                <span className={cn('min-w-0 ps-0.5 leading-none whitespace-nowrap', fade)}>
                  <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.01em]">
                    {brand}
                  </span>
                  <span className="mt-1 block text-[0.625rem] font-semibold tracking-wider text-ink-60 uppercase">
                    {t('brand')}
                  </span>
                </span>
              </Link>
              <span
                className={cn(
                  'flex shrink-0 justify-end overflow-clip',
                  collapsed ? cn('w-0', SIDEBAR_FADE.hidden) : cn('w-9', SIDEBAR_FADE.shown),
                )}
              >
                <SidebarToggle
                  data-slot={collapsed ? 'sidebar-toggle-idle' : 'sidebar-toggle'}
                  tabIndex={collapsed ? -1 : undefined}
                />
              </span>
            </div>
            <div
              className={cn(
                'flex items-center overflow-clip',
                collapsed ? cn('h-10', SIDEBAR_FADE.shown) : cn('h-0', SIDEBAR_FADE.hidden),
              )}
            >
              <span className="grid h-10 w-11 shrink-0 place-items-center">
                <SidebarToggle
                  data-slot={collapsed ? 'sidebar-toggle' : 'sidebar-toggle-idle'}
                  tabIndex={collapsed ? undefined : -1}
                />
              </span>
            </div>
          </SidebarHeader>

          <SidebarNav>
            {RAIL_GROUPS.map((g) => (
              <SidebarSection key={g.key} label={g.label ? t(`nav.groups.${g.label}`) : undefined}>
                {g.items.map(({ href, key, Icon, ...rest }) => {
                  const site = 'site' in rest;
                  const waiting = key === 'messages' && unread > 0;
                  return (
                    <SidebarItem
                      key={href}
                      href={site ? getPathname({ href: href as '/tools', locale }) : href}
                      external={site}
                      active={!site && isActive(href)}
                      icon={<Icon size={18} />}
                      badge={
                        waiting ? (
                          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-paprika px-1.5 text-[0.6875rem] leading-none font-bold text-ink">
                            {unread}
                          </span>
                        ) : undefined
                      }
                      collapsedBadge={
                        waiting ? (
                          <span
                            aria-hidden
                            className="absolute -end-1 -top-1 size-2 rounded-full bg-paprika ring-2 ring-[var(--background)]"
                          />
                        ) : undefined
                      }
                    >
                      {t(`nav.${key}`)}
                    </SidebarItem>
                  );
                })}
              </SidebarSection>
            ))}

            {/* today at a glance: the same ring as the Today page */}
            {pulse && (
              <div className="px-2 pt-3">
                <Link
                  href="/panel"
                  aria-label={`${t('hub.rail.today')}: ${format.number(pulse.score, { style: 'percent', maximumFractionDigits: 0 })}`}
                  title={collapsed ? t('hub.rail.today') : undefined}
                  className="flex items-center overflow-clip rounded-[12px] bg-ink p-1 text-paper transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_rgb(15_27_23/0.7)]"
                >
                  <span className="relative grid size-9 shrink-0 place-items-center">
                    <svg
                      viewBox="0 0 36 36"
                      className="absolute inset-0 size-full -rotate-90"
                      aria-hidden
                    >
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="rgb(243 238 228 / 0.18)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="var(--color-citrus)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 14}
                        strokeDashoffset={2 * Math.PI * 14 * (1 - pulse.score)}
                        className="transition-[stroke-dashoffset] duration-700 ease-out"
                      />
                    </svg>
                    <span className="relative text-[0.625rem] font-bold">
                      {Math.round(pulse.score * 100)}
                    </span>
                  </span>
                  <span
                    aria-hidden={collapsed || undefined}
                    className={cn('ms-2 min-w-0 flex-1 whitespace-nowrap', fade)}
                  >
                    <span className="block text-[0.5625rem] font-semibold tracking-wider text-sage uppercase">
                      {t('hub.rail.today')}
                    </span>
                    <span className="block truncate text-[0.75rem] leading-tight font-bold">
                      {t('hub.rail.streak', { count: pulse.streak })}
                    </span>
                  </span>
                </Link>
              </div>
            )}
          </SidebarNav>

          <SidebarSection className="border-t border-[var(--border)] pt-2">
            <SidebarItem
              href="/panel/help"
              active={pathname.startsWith('/panel/help')}
              icon={<HelpIcon size={18} />}
            >
              {t('nav.help')}
            </SidebarItem>
            <SidebarItem
              href="/panel/account"
              active={accountActive}
              icon={<AccountIcon size={18} />}
            >
              {firstName}
            </SidebarItem>
            <SidebarItem
              icon={<ThemeGlyph dark={theme === 'dark'} />}
              onClick={(e: React.MouseEvent<HTMLElement>) => {
                // from the sun / moon itself, as in the dietitian panel
                setTheme(theme === 'dark' ? 'light' : 'dark', glyphCentre(e.currentTarget));
              }}
              aria-label={`${t('theme.title')}: ${t(`theme.${theme}`)}`}
              badge={
                <span className="rounded-md bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-[var(--muted-foreground)]">
                  {t(`theme.${theme}`)}
                </span>
              }
            >
              {t('theme.title')}
            </SidebarItem>
            <form action={portalLogoutAction} className="contents">
              <SidebarItem type="submit" icon={<LogoutIcon size={18} className="mirror-rtl" />}>
                {t('nav.logout')}
              </SidebarItem>
            </form>
          </SidebarSection>
        </Sidebar>
      </div>

      {/* Phone / tablet top bar */}
      <header
        data-portal-top=""
        className="no-print sticky top-0 z-30 border-b border-ink/10 bg-paper/92 backdrop-blur-[6px] lg:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/panel" className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-7 shrink-0 text-ink" />
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate font-display text-[1.1rem] font-semibold ar:font-bold">
                {brand}
              </span>
              <span className="mt-1 label text-[0.5625rem] text-ink-60">{t('brand')}</span>
            </span>
          </Link>
          <span className="flex shrink-0 items-center gap-2">
            <ThemeButton />
            <Link
              href="/panel/help"
              aria-label={t('nav.help')}
              aria-current={pathname.startsWith('/panel/help') ? 'page' : undefined}
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-pill border-[1.5px] transition-colors',
                pathname.startsWith('/panel/help')
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/20 hover:border-ink',
              )}
            >
              <HelpIcon size={20} />
            </Link>
            <Link
              href="/panel/account"
              aria-label={t('nav.account')}
              aria-current={accountActive ? 'page' : undefined}
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-pill border-[1.5px] transition-colors',
                accountActive ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink',
              )}
            >
              <AccountIcon size={20} />
            </Link>
          </span>
        </div>
      </header>

      <main
        id="main"
        className="min-w-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:flex-1 lg:pb-20"
      >
        {children}
      </main>

      {!pathname.startsWith('/panel/help') && (
        <FirstRun
          scope="portal"
          href="/panel/help"
          title={t('help.tour.title')}
          text={t('help.tour.text')}
          start={t('help.tour.start')}
          later={t('help.tour.later')}
        />
      )}

      {/* Phone / tablet tab bar */}
      <nav
        aria-label={t('nav.primary')}
        data-portal-tabs=""
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur-[6px] lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.map(({ href, key, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-[4.25rem] flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-semibold',
                    active ? 'text-ink' : 'text-ink-60',
                  )}
                >
                  <span className="relative grid h-8 w-14 place-items-center">
                    {active && (
                      <motion.span
                        layoutId="portal-tab"
                        className="absolute inset-0 rounded-pill bg-ink"
                        transition={spring.snappy}
                      />
                    )}
                    <Icon className={cn('relative', active && 'text-paper')} size={21} />
                    {key === 'messages' && unread > 0 && (
                      <span
                        className="absolute end-2.5 top-0.5 size-2.5 rounded-full bg-paprika ring-2 ring-paper"
                        aria-label={t('today.unread', { count: unread })}
                      />
                    )}
                  </span>
                  <span className="max-w-full truncate">{t(`nav.${key}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** A question mark in a circle: "how to use it". */
function HelpIcon({ size = 18, className }: { size?: number; className?: string }) {
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
      className={className}
    >
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9M12 16.6v.1" />
    </svg>
  );
}

/**
 * Page opener used by every portal page: eyebrow, Didone title, optional lead and actions.
 * `help` names the page's topic in the guide (/panel/help) and adds the way there.
 */
export function PortalHeader({
  eyebrow,
  title,
  lead,
  actions,
  help,
}: {
  help?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  const t = useTranslations('portal.help.ui');
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-7 pb-6 lg:pt-10">
      <div className="min-w-0">
        {eyebrow && <p className="label text-ink-60">{eyebrow}</p>}
        <h1 className="mt-1.5 font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.05] tracking-[-0.02em] ar:leading-[1.35] ar:font-bold ar:tracking-normal">
          {title}
        </h1>
        {lead && <p className="mt-3 max-w-2xl text-[1rem] leading-relaxed text-ink-70">{lead}</p>}
      </div>
      {
        <div className="no-print flex flex-wrap items-center gap-2">
          <ThemeButton className="max-lg:hidden" />
          {help && (
            <Link
              href={`/panel/help#${help}`}
              className="inline-flex h-10 items-center gap-2 rounded-pill border-[1.5px] border-ink/20 px-3.5 text-[0.8125rem] font-semibold transition-colors hover:border-ink"
            >
              <HelpIcon size={17} />
              {t('pageHelp')}
            </Link>
          )}
          {actions}
        </div>
      }
    </header>
  );
}

/** Content column shared by portal pages. */
export function PortalPage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('mx-auto px-4 sm:px-6 lg:px-10', wide ? 'max-w-[1680px]' : 'max-w-4xl')}>
      {children}
    </div>
  );
}
