'use client';

import { AnimatePresence, Reorder, motion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ContextMenu as C, DropdownMenu as M, HoverCard as H } from 'radix-ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useDir, usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, NavIcon, type NavKey } from './nav';

/*
 * Browser-like tabs for the panel (desktop): each tab is a place in the panel — its own URL — so
 * a client's file, the agenda and the payments list can stay open side by side. Moving around
 * inside a tab changes that tab; "+" opens a new one (hovering it offers the sections to open
 * directly); a tab closes with its ×, the middle mouse button or Delete; right-click offers
 * "close others / to the right / to the left"; the "…" menu opens a tab or closes them all. Tabs
 * can be dragged into another order. They are kept in this browser (localStorage).
 */

interface PanelTab {
  id: string;
  /** pathname + search */
  href: string;
  /** the page's own title once known (a client's name, a recipe), else the section's name */
  title?: string;
}

const STORE = 'admin_tabs';
const MAX_TABS = 12;
const HOME = '/admin';

const menuPanel =
  'a-glass z-[95] min-w-52 p-1.5 text-a-text outline-none data-[state=open]:animate-[admin-pop_200ms_cubic-bezier(0.16,1,0.3,1)]';
const menuItem =
  'flex h-9 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-[0.8125rem] font-medium outline-none data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-[color-mix(in_srgb,var(--a-text)_9%,transparent)]';

/** the section a URL belongs to (the longest matching nav entry) */
function sectionOf(href: string): NavKey {
  const path = href.split('?')[0]!;
  let best: (typeof ADMIN_NAV)[number] = ADMIN_NAV[0];
  for (const n of ADMIN_NAV)
    if (
      (n.href === HOME ? path === HOME : path === n.href || path.startsWith(`${n.href}/`)) &&
      n.href.length >= best.href.length
    )
      best = n;
  return best.key;
}
const isSectionRoot = (href: string) => ADMIN_NAV.some((n) => n.href === href.split('?')[0]);

let counter = 0;
const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

function Glyph({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}
const PLUS = 'M12 5v14M5 12h14';
const CLOSE = 'M6 6l12 12M18 6L6 18';

export function TabsBar() {
  const t = useTranslations('admin');
  const router = useRouter();
  const pathname = usePathname();
  // The address of the page on screen (path + query). The path comes from the router; the query
  // is read from the address bar (a page's own tabs change only the query), so nothing here
  // suspends and the panel hydrates exactly as it does without the strip.
  const [here, setHere] = useState(pathname);
  useEffect(() => {
    const read = () => setHere(location.pathname + location.search);
    read();
    const timer = window.setInterval(read, 400);
    return () => window.clearInterval(timer);
  }, [pathname]);
  const dir = useDir();
  const reduced = usePrefersReducedMotion();

  // server and first client render: one tab, the page that was asked for
  const [tabs, setTabs] = useState<PanelTab[]>(() => [{ id: 'first', href: here }]);
  const [activeId, setActiveId] = useState('first');
  const [ready, setReady] = useState(false);
  const active = useRef(activeId);
  useEffect(() => {
    active.current = activeId;
  }, [activeId]);

  // restore the saved tabs once; the page that was asked for takes the active tab
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as {
        tabs: PanelTab[];
        activeId: string;
      } | null;
      const list = (saved?.tabs ?? [])
        .filter((x) => typeof x?.id === 'string' && typeof x?.href === 'string')
        .filter((x) => x.href.startsWith(HOME))
        .slice(0, MAX_TABS);
      if (list.length) {
        const current = list.find((x) => x.id === saved!.activeId) ?? list[0]!;
        const url = location.pathname + location.search;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTabs(
          list.map((x) =>
            x.id === current.id
              ? { ...x, href: url, title: x.href === url ? x.title : undefined }
              : x,
          ),
        );
        setActiveId(current.id);
      }
    } catch {
      /* unreadable storage: start with the one tab */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify({ tabs, activeId }));
      } catch {
        /* storage full or blocked: tabs simply are not remembered */
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tabs, activeId, ready]);

  // moving around inside the panel changes the active tab
  useEffect(() => {
    if (!ready) return;

    setTabs((list) =>
      list.map((x) =>
        x.id === active.current && x.href !== here ? { ...x, href: here, title: undefined } : x,
      ),
    );
    // a page below a section (a client's file) is named by its own heading once it has loaded
    if (isSectionRoot(here)) return;
    // (its heading: detail pages carry the name there; retried while the page is still arriving)
    let tries = 0;
    const read = () => {
      const title = document.querySelector('#admin-main h1')?.textContent?.trim().slice(0, 60);
      if (title && location.pathname + location.search === here)
        setTabs((list) =>
          list.map((x) => (x.id === active.current && x.href === here ? { ...x, title } : x)),
        );
      else if (++tries < 6) timer = window.setTimeout(read, 500);
    };
    let timer = window.setTimeout(read, 500);
    return () => window.clearTimeout(timer);
  }, [here, ready]);

  const go = useCallback(
    (tab: PanelTab) => {
      setActiveId(tab.id);
      active.current = tab.id;
      if (tab.href !== location.pathname + location.search) router.push(tab.href);
    },
    [router],
  );

  const addTab = useCallback(
    (href: string = HOME) => {
      if (tabs.length >= MAX_TABS) return;
      const tab = { id: newId(), href };
      setTabs((list) => [...list, tab]);
      go(tab);
    },
    [tabs.length, go],
  );

  /** keep only these; if the active one is gone, the nearest survivor takes over */
  const keep = useCallback(
    (list: PanelTab[], from: number) => {
      if (!list.length) return;
      setTabs(list);
      if (!list.some((x) => x.id === active.current)) go(list[Math.min(from, list.length - 1)]!);
    },
    [go],
  );
  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    const i = tabs.findIndex((x) => x.id === id);
    keep(
      tabs.filter((x) => x.id !== id),
      i,
    );
  };

  const label = (tab: PanelTab) => tab.title ?? t(`nav.${sectionOf(tab.href)}`);
  const onKey = (e: KeyboardEvent<HTMLDivElement>, tab: PanelTab, i: number) => {
    const focus = (n: number) =>
      (
        e.currentTarget.closest('ol')?.querySelectorAll('[role="tab"]')[n] as
          HTMLElement | undefined
      )?.focus();
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go(tab);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      closeTab(tab.id);
    } else if (e.key === (dir === 1 ? 'ArrowRight' : 'ArrowLeft')) {
      e.preventDefault();
      focus(Math.min(tabs.length - 1, i + 1));
    } else if (e.key === (dir === 1 ? 'ArrowLeft' : 'ArrowRight')) {
      e.preventDefault();
      focus(Math.max(0, i - 1));
    }
  };

  const full = tabs.length >= MAX_TABS;
  return (
    <div
      data-tabbar
      className="sticky top-0 z-20 -mx-10 mb-7 hidden items-end gap-1 bg-a-surface px-4 pt-2 lg:flex print:hidden"
    >
      <div className="scrollbar-none flex min-w-0 items-end overflow-x-auto">
        <Reorder.Group
          as="ol"
          axis="x"
          values={tabs}
          onReorder={setTabs}
          role="tablist"
          aria-label={t('tabs.label')}
          className="flex items-end"
        >
          <AnimatePresence initial={false}>
            {tabs.map((tab, i) => {
              const on = tab.id === activeId;
              const nextOn = tabs[i + 1]?.id === activeId;
              return (
                <Reorder.Item
                  key={tab.id}
                  value={tab}
                  as="li"
                  initial={reduced ? false : { opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="group/tab relative shrink-0"
                  style={{ zIndex: on ? 2 : 1 }}
                >
                  <C.Root>
                    <C.Trigger asChild>
                      <div
                        role="tab"
                        aria-selected={on}
                        tabIndex={on ? 0 : -1}
                        title={label(tab)}
                        onClick={() => go(tab)}
                        onAuxClick={(e: MouseEvent) => {
                          if (e.button !== 1) return;
                          e.preventDefault();
                          closeTab(tab.id);
                        }}
                        onKeyDown={(e) => onKey(e, tab, i)}
                        className={cn(
                          'relative flex h-10 max-w-[13.5rem] min-w-[8.5rem] cursor-pointer items-center gap-2 px-3.5 text-[0.8125rem] outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-inset',
                          on ? 'text-a-text' : 'text-a-muted hover:text-a-text',
                        )}
                      >
                        {on && (
                          // the selected tab is part of the page: its colour, and two small
                          // concave corners that round it into the page below
                          <motion.span
                            aria-hidden
                            layoutId="admin-tab"
                            transition={
                              reduced
                                ? { duration: 0 }
                                : { type: 'spring', bounce: 0.15, duration: 0.4 }
                            }
                            className="absolute inset-0 rounded-t-[12px] bg-a-bg"
                          >
                            <span className="absolute bottom-0 -left-3 size-3 overflow-hidden bg-a-bg">
                              <span className="absolute right-0 bottom-0 size-6 rounded-full bg-a-surface" />
                            </span>
                            <span className="absolute -right-3 bottom-0 size-3 overflow-hidden bg-a-bg">
                              <span className="absolute bottom-0 left-0 size-6 rounded-full bg-a-surface" />
                            </span>
                          </motion.span>
                        )}
                        <span className="relative flex min-w-0 flex-1 items-center gap-2">
                          <NavIcon name={sectionOf(tab.href)} size={16} />
                          <span className="min-w-0 flex-1 truncate font-medium">{label(tab)}</span>
                          {tabs.length > 1 && (
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-label={`${t('tabs.close')}: ${label(tab)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.id);
                              }}
                              className={cn(
                                'grid size-5 shrink-0 place-items-center rounded-full text-a-muted transition-[opacity,background-color,color] hover:bg-a-surface-2 hover:text-a-text',
                                !on && 'opacity-0 group-hover/tab:opacity-100',
                              )}
                            >
                              <Glyph d={CLOSE} size={11} />
                            </button>
                          )}
                        </span>
                        {!on && !nextOn && (
                          <span
                            aria-hidden
                            className="absolute end-0 top-1/2 h-4 w-px -translate-y-1/2 bg-a-border"
                          />
                        )}
                      </div>
                    </C.Trigger>
                    <C.Portal>
                      <C.Content className={menuPanel}>
                        <C.Item
                          className={menuItem}
                          disabled={tabs.length === 1}
                          onSelect={() => closeTab(tab.id)}
                        >
                          {t('tabs.close')}
                        </C.Item>
                        <C.Separator className="my-1 h-px bg-a-border" />
                        <C.Item
                          className={menuItem}
                          disabled={tabs.length === 1}
                          onSelect={() => keep([tab], 0)}
                        >
                          {t('tabs.closeOthers')}
                        </C.Item>
                        <C.Item
                          className={menuItem}
                          disabled={i === tabs.length - 1}
                          onSelect={() => keep(tabs.slice(0, i + 1), i)}
                        >
                          {t('tabs.closeAfter')}
                        </C.Item>
                        <C.Item
                          className={menuItem}
                          disabled={i === 0}
                          onSelect={() => keep(tabs.slice(i), 0)}
                        >
                          {t('tabs.closeBefore')}
                        </C.Item>
                      </C.Content>
                    </C.Portal>
                  </C.Root>
                </Reorder.Item>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      {/* "+": a click opens a new tab on the overview; resting on it offers every section */}
      <H.Root openDelay={180} closeDelay={120}>
        <H.Trigger asChild>
          <button
            type="button"
            disabled={full}
            aria-label={t('tabs.new')}
            onClick={() => addTab()}
            className="mb-1 grid size-8 shrink-0 place-items-center rounded-full text-a-muted transition-colors hover:bg-a-surface-2 hover:text-a-text disabled:opacity-40"
          >
            <Glyph d={PLUS} />
          </button>
        </H.Trigger>
        {!full && (
          <H.Portal>
            <H.Content align="start" sideOffset={8} className={cn(menuPanel, 'w-56')}>
              <p className="px-2.5 py-1.5 text-[0.6875rem] font-semibold tracking-wider text-a-muted uppercase">
                {t('tabs.quickOpen')}
              </p>
              {ADMIN_NAV.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => addTab(n.href)}
                  className="flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-start text-[0.8125rem] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--a-text)_9%,transparent)]"
                >
                  <span className="text-a-muted">
                    <NavIcon name={n.key} size={16} />
                  </span>
                  {t(`nav.${n.key}`)}
                </button>
              ))}
            </H.Content>
          </H.Portal>
        )}
      </H.Root>

      <M.Root dir={dir === -1 ? 'rtl' : 'ltr'}>
        <M.Trigger
          aria-label={t('tabs.more')}
          className="ms-auto mb-1 grid size-8 shrink-0 place-items-center rounded-[10px] text-a-muted transition-colors outline-none hover:bg-a-surface-2 hover:text-a-text focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </M.Trigger>
        <M.Portal>
          <M.Content align="end" sideOffset={6} className={menuPanel}>
            <M.Item className={menuItem} disabled={full} onSelect={() => addTab()}>
              <Glyph d={PLUS} />
              {t('tabs.new')}
            </M.Item>
            <M.Separator className="my-1 h-px bg-a-border" />
            <M.Item
              className={cn(menuItem, tabs.length > 1 && 'text-a-danger')}
              disabled={tabs.length === 1}
              onSelect={() => {
                const current = tabs.find((x) => x.id === activeId) ?? tabs[0]!;
                keep([current], 0);
              }}
            >
              <Glyph d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
              {t('tabs.closeAll')}
            </M.Item>
          </M.Content>
        </M.Portal>
      </M.Root>
    </div>
  );
}
