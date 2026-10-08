'use client';

import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Dialog as D, DropdownMenu as M } from 'radix-ui';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { logoutAction } from '@/app/admin/_actions/auth';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { useDir, usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/site/header';
import {
  SIDEBAR_FADE,
  SIDEBAR_MOTION,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarToggle,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar } from './fx';
import { ADMIN_NAV, GROUPS, NavIcon, type NavKey } from './nav';

/*
 * The panel's navigation, built on the sidebar primitive (components/ui/sidebar.tsx,
 * DESIGN.md v1.15). Desktop: collapsible — the toggle in the header (or Ctrl/⌘+B) narrows it to an
 * icon rail and back (500 ms, a soft spring); the page beside it follows the real width, so its
 * cards narrow and widen with it. Labels, titles and the brand name fade in place. Collapsed, a row
 * opens under the logo with the expand button; the logo itself stays a link home. The state is remembered in a cookie so the server renders the right width.
 * Phones/tablets: the same sidebar inside a drawer that slides in and can be swiped shut.
 */

export const SIDEBAR_COOKIE = 'admin_sidebar';
export const SIDEBAR_WIDTH = { open: 214, closed: 60 } as const;

export interface SidebarProps {
  pathname: string;
  newLeads: number;
  unread: number;
  email: string;
  locale: Locale;
  theme: 'light' | 'dark';
  localMode: boolean;
  onSearch: () => void;
  /** `from`: where the switch was pressed — the day/night change spreads out from there */
  onPreference: (kind: 'locale' | 'theme', value: string, from?: { x: number; y: number }) => void;
}

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

/** The primitive's count chip (subtle, tabular). */
function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-[var(--muted-foreground)] tabular-nums">
      {children}
    </span>
  );
}

/** The panel's mark in a fixed cell (it never moves); the name fades beside it. */
function Brand() {
  const t = useTranslations('admin');
  const { collapsed } = useSidebar();
  return (
    <Link
      href="/admin"
      aria-label={t('brand')}
      title={collapsed ? t('brand') : undefined}
      className="flex min-w-0 flex-1 items-center"
    >
      <span className="grid h-10 w-11 shrink-0 place-items-center">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-a-accent text-a-accent-text">
          <BrandMark className="size-[1.15rem]" />
        </span>
      </span>
      <span
        className={cn(
          'truncate ps-0.5 text-[1rem] leading-none font-bold tracking-[-0.01em]',
          collapsed ? SIDEBAR_FADE.hidden : SIDEBAR_FADE.shown,
        )}
      >
        {t('brand')}
      </span>
    </Link>
  );
}

/**
 * The header's two rows: the brand with the collapse arrow at its end, and — only on the rail — a
 * row that opens under the logo with the expand arrow. One of the two buttons is live at a time
 * (the other is faded out, out of the tab order).
 */
function BrandRows() {
  const { collapsed } = useSidebar();
  return (
    <>
      <div className="flex h-10 items-center overflow-clip">
        <Brand />
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
    </>
  );
}

function Navigation({
  pathname,
  newLeads,
  unread,
  onNavigate,
}: Pick<SidebarProps, 'pathname' | 'newLeads' | 'unread'> & { onNavigate?: () => void }) {
  const t = useTranslations('admin');
  const badge = (key: NavKey) => (key === 'leads' ? newLeads : key === 'messages' ? unread : 0);
  return (
    <>
      {GROUPS.map((g) => {
        const items = ADMIN_NAV.filter((n) => n.group === g);
        const titled = g === 'practice' || g === 'planning' || g === 'site';
        return (
          <SidebarSection key={g} label={titled ? t(`nav.groups.${g}`) : undefined}>
            {items.map((item) => {
              const n = badge(item.key);
              return (
                <SidebarItem
                  key={item.key}
                  href={item.href}
                  active={isActive(pathname, item.href)}
                  onClick={onNavigate}
                  icon={<NavIcon name={item.key} size={18} />}
                  badge={n > 0 ? <CountBadge>{n}</CountBadge> : undefined}
                  // collapsed: a dot on the icon keeps "something is waiting" visible
                  collapsedBadge={
                    n > 0 ? (
                      <span
                        aria-hidden
                        className="absolute -end-1 -top-1 size-2 rounded-full bg-paprika ring-2 ring-[var(--background)]"
                      />
                    ) : undefined
                  }
                  aria-label={n > 0 ? `${t(`nav.${item.key}`)} (${n})` : undefined}
                >
                  {t(`nav.${item.key}`)}
                </SidebarItem>
              );
            })}
          </SidebarSection>
        );
      })}
    </>
  );
}

/** Day ↔ night: the sun's rays fold in while a shadow slides across the disc, leaving a moon. */
function SunMoon({ dark }: { dark: boolean }) {
  const reduced = usePrefersReducedMotion();
  const mask = `sunmoon${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spring = reduced
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 260, damping: 19, mass: 0.8 } as const);
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      initial={false}
      animate={{ rotate: dark ? -25 : 0 }}
      transition={spring}
    >
      <mask id={mask}>
        <rect width="24" height="24" fill="white" />
        <motion.circle
          r="7.5"
          fill="black"
          initial={false}
          animate={dark ? { cx: 16.5, cy: 7.5 } : { cx: 27, cy: -3 }}
          transition={spring}
        />
      </mask>
      <motion.circle
        cx="12"
        cy="12"
        fill="currentColor"
        mask={`url(#${mask})`}
        initial={false}
        animate={{ r: dark ? 8.5 : 4.25 }}
        transition={spring}
      />
      <motion.g
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        style={{ originX: '12px', originY: '12px' }}
        initial={false}
        animate={
          dark ? { scale: 0.4, rotate: 90, opacity: 0 } : { scale: 1, rotate: 0, opacity: 1 }
        }
        transition={spring}
      >
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </motion.g>
    </motion.svg>
  );
}

function Glyph({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

const SEARCH = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5';
const GLOBE =
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18';
const SITE = 'M14 5h5v5M19 5l-8 8M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4';
const INSTALL = 'M12 4v10M8 10l4 4 4-4M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2';
const SIGN_OUT = 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h10';

const menuPanel =
  'a-glass z-[95] min-w-48 p-1.5 text-a-text outline-none data-[state=open]:animate-[admin-pop_200ms_cubic-bezier(0.16,1,0.3,1)]';
const menuItem =
  'flex h-9 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-[0.8125rem] font-medium outline-none data-[highlighted]:bg-[color-mix(in_srgb,var(--a-text)_9%,transparent)]';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Install as an app": offered only where the browser can do it (Chrome, Edge, Android) and the
 * panel is not installed yet. Installed, the panel opens from the home screen / dock at /admin.
 */
function InstallItem() {
  const t = useTranslations('admin.nav');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const offer = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const installed = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  if (!prompt) return null;
  return (
    <SidebarItem
      icon={<Glyph d={INSTALL} />}
      onClick={async () => {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') setPrompt(null);
      }}
    >
      {t('install')}
    </SidebarItem>
  );
}

/** Search, day/night, language, the public site — in the sidebar's own item style. */
function Tools(props: SidebarProps) {
  const t = useTranslations('admin');
  const dir = useDir();
  const { collapsed } = useSidebar();
  const dark = props.theme === 'dark';
  return (
    <SidebarSection className="border-t border-[var(--border)] pt-2">
      <SidebarItem
        icon={<Glyph d={SEARCH} />}
        onClick={props.onSearch}
        badge={
          <kbd className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] leading-none text-[var(--muted-foreground)] tabular-nums">
            Ctrl K
          </kbd>
        }
      >
        {t('nav.search')}
      </SidebarItem>
      <InstallItem />
      <SidebarItem
        icon={<SunMoon dark={dark} />}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const icon = Math.min(box.height, 40) / 2;
          // from the icon (the start of the row, in either direction)
          const x = dir === -1 ? box.right - icon : box.left + icon;
          props.onPreference('theme', dark ? 'light' : 'dark', { x, y: box.top + box.height / 2 });
        }}
        aria-label={`${t('nav.theme')}: ${dark ? t('nav.night') : t('nav.day')}`}
        badge={<CountBadge>{dark ? t('nav.night') : t('nav.day')}</CountBadge>}
      >
        {t('nav.theme')}
      </SidebarItem>
      <M.Root dir={dir === -1 ? 'rtl' : 'ltr'}>
        <M.Trigger asChild>
          <SidebarItem
            icon={<Glyph d={GLOBE} />}
            aria-label={`${t('common.language')}: ${localeNames[props.locale]}`}
            badge={<CountBadge>{props.locale.toUpperCase()}</CountBadge>}
          >
            {t('common.language')}
          </SidebarItem>
        </M.Trigger>
        <M.Portal>
          <M.Content
            side={collapsed ? (dir === -1 ? 'left' : 'right') : 'top'}
            align={collapsed ? 'end' : 'start'}
            sideOffset={8}
            className={menuPanel}
          >
            <M.RadioGroup
              value={props.locale}
              onValueChange={(v) => props.onPreference('locale', v)}
            >
              {locales.map((l) => (
                <M.RadioItem key={l} value={l} className={menuItem}>
                  <span className="grid h-6 min-w-6 place-items-center rounded-[7px] bg-a-surface-2 px-1 text-[0.625rem] font-bold uppercase tabular-nums">
                    {l}
                  </span>
                  <span className="flex-1">{localeNames[l]}</span>
                  <M.ItemIndicator>
                    <Glyph d="M5 12.5l4.5 4.5L19 7.5" />
                  </M.ItemIndicator>
                </M.RadioItem>
              ))}
            </M.RadioGroup>
          </M.Content>
        </M.Portal>
      </M.Root>
      <SidebarItem href="/" external icon={<Glyph d={SITE} className="mirror-rtl" />}>
        {t('nav.site')}
      </SidebarItem>
    </SidebarSection>
  );
}

/** Who is signed in; sign-out beside it (collapsed: the avatar opens a small menu). */
function UserFooter({ email }: { email: string }) {
  const t = useTranslations('admin.nav');
  const dir = useDir();
  const { collapsed } = useSidebar();
  const form = useRef<HTMLFormElement>(null);
  const name = email.split('@')[0] ?? email;
  return (
    <>
      {/* the avatar keeps its place; on the rail it is also the way to sign out */}
      {collapsed ? (
        <M.Root dir={dir === -1 ? 'rtl' : 'ltr'}>
          <M.Trigger
            aria-label={email}
            className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
            <Avatar name={name} size={28} />
          </M.Trigger>
          <M.Portal>
            <M.Content
              side={dir === -1 ? 'left' : 'right'}
              align="end"
              sideOffset={10}
              className={menuPanel}
            >
              <M.Label className="max-w-56 truncate px-2.5 py-1.5 text-[0.75rem] text-a-muted">
                {email}
              </M.Label>
              <M.Item
                className={cn(menuItem, 'text-a-danger')}
                onSelect={() => form.current?.requestSubmit()}
              >
                <Glyph d={SIGN_OUT} className="mirror-rtl" />
                {t('signOut')}
              </M.Item>
            </M.Content>
          </M.Portal>
          <form ref={form} action={logoutAction} hidden />
        </M.Root>
      ) : (
        <Avatar name={name} size={28} className="shrink-0" />
      )}
      <div
        aria-hidden={collapsed || undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 whitespace-nowrap',
          collapsed ? SIDEBAR_FADE.hidden : SIDEBAR_FADE.shown,
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] leading-tight font-medium">{name}</div>
          <div
            className="truncate text-[11px] leading-tight text-[var(--muted-foreground)]"
            title={email}
          >
            {email}
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label={t('signOut')}
            title={t('signOut')}
            className="flex size-7 items-center justify-center rounded-[0.625rem] text-[var(--muted-foreground)] transition-colors outline-none hover:bg-[color-mix(in_srgb,var(--a-danger)_12%,transparent)] hover:text-a-danger focus-visible:ring-2 focus-visible:ring-[var(--foreground)]"
          >
            <Glyph d={SIGN_OUT} className="mirror-rtl" />
          </button>
        </form>
      </div>
    </>
  );
}

function LocalModeNote() {
  const t = useTranslations('admin.common');
  const { collapsed } = useSidebar();
  return (
    <p
      aria-hidden={collapsed || undefined}
      className={cn(
        'rounded-md mx-[18px] overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 text-[11px] leading-[23px] font-medium whitespace-nowrap text-[var(--muted-foreground)]',
        collapsed ? cn('mb-0 h-0', SIDEBAR_FADE.hidden) : cn('mb-1 h-[23px]', SIDEBAR_FADE.shown),
      )}
    >
      {t('localMode')}
    </p>
  );
}

// ---- desktop -----------------------------------------------------------------------------------

export function DesktopSidebar({
  pinned,
  onPinnedChange,
  ...props
}: SidebarProps & { pinned: boolean; onPinnedChange: (open: boolean) => void }) {
  const t = useTranslations('admin');
  return (
    // The spacer and the sidebar over it change width together, on one clock: the page beside
    // them is laid out at the real width on every frame, so its cards narrow and widen with it.
    <div
      data-sidebar-spacer=""
      className="sticky top-0 z-30 hidden h-dvh shrink-0 motion-reduce:!transition-none lg:block print:hidden"
      style={{
        width: pinned ? SIDEBAR_WIDTH.open : SIDEBAR_WIDTH.closed,
        transition: `width ${SIDEBAR_MOTION.ms}ms ${SIDEBAR_MOTION.easing}`,
      }}
    >
      <Sidebar
        className="absolute inset-y-0 start-0 will-change-[width]"
        variant="collapsible"
        collapsed={!pinned}
        onCollapsedChange={(c) => onPinnedChange(!c)}
        width={SIDEBAR_WIDTH.open}
        collapsedWidth={SIDEBAR_WIDTH.closed}
        aria-label={t('brand')}
        labels={{ expand: t('nav.expand'), collapse: t('nav.collapse') }}
      >
        <SidebarHeader>
          <BrandRows />
        </SidebarHeader>
        {props.localMode && <LocalModeNote />}
        <SidebarNav>
          <Navigation pathname={props.pathname} newLeads={props.newLeads} unread={props.unread} />
        </SidebarNav>
        <Tools {...props} />
        <SidebarFooter>
          <UserFooter email={props.email} />
        </SidebarFooter>
      </Sidebar>
    </div>
  );
}

// ---- phones / tablets --------------------------------------------------------------------------

export function MobileDrawer({
  open,
  onOpenChange,
  ...props
}: SidebarProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('admin');
  const dir = useDir();
  const reduced = usePrefersReducedMotion();
  const out = `${-105 * dir}%`;
  const onDragEnd = (_: unknown, info: PanInfo) => {
    // swiped toward the reading-start edge far or fast enough: close
    if (info.offset.x * dir < -90 || info.velocity.x * dir < -500) onOpenChange(false);
  };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="bg-black/40 fixed inset-0 z-[85] backdrop-blur-[2px] lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-y-0 start-0 z-[86] flex w-[min(86vw,19rem)] shadow-sheet outline-none lg:hidden"
                initial={reduced ? { opacity: 0 } : { x: out }}
                animate={reduced ? { opacity: 1 } : { x: 0 }}
                exit={reduced ? { opacity: 0 } : { x: out }}
                transition={
                  reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 38 }
                }
                drag={reduced ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={dir === 1 ? { left: 0.5, right: 0 } : { left: 0, right: 0.5 }}
                onDragEnd={onDragEnd}
              >
                <D.Title className="sr-only">{t('nav.more')}</D.Title>
                <Sidebar
                  aria-label={t('brand')}
                  className="h-full !w-full border-e-0 pb-[env(safe-area-inset-bottom)]"
                >
                  <SidebarHeader className="flex h-[52px] items-center pe-3 pt-0 pb-0">
                    <Brand />
                    <D.Close
                      aria-label={t('common.close')}
                      className="ms-auto flex size-8 items-center justify-center rounded-[0.625rem] text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] active:scale-95"
                    >
                      <Glyph d="M6 6l12 12M18 6L6 18" />
                    </D.Close>
                  </SidebarHeader>
                  {props.localMode && <LocalModeNote />}
                  <SidebarNav>
                    <Navigation
                      pathname={props.pathname}
                      newLeads={props.newLeads}
                      unread={props.unread}
                      onNavigate={() => onOpenChange(false)}
                    />
                  </SidebarNav>
                  <Tools {...props} />
                  <SidebarFooter>
                    <UserFooter email={props.email} />
                  </SidebarFooter>
                </Sidebar>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
