'use client';

/**
 * Sidebar primitive (adapted 1:1 from the "Wensity" sidebar the client chose, DESIGN.md v1.15).
 *
 * Same structure and styles as the original; the collapse / expand motion follows the client's
 * other product (DESIGN.md v1.24): the width changes on an interruptible CSS transition
 * (SIDEBAR_MOTION) and the page beside it follows the real width; labels, section titles and the
 * brand row stay mounted and fade (SIDEBAR_FADE). Adaptations for this codebase:
 *  - Motion is imported from `motion/react` (the same library framer-motion became; one copy).
 *  - `asChild` uses Radix Slot (already installed) instead of Base UI's useRender.
 *  - The three Tabler icons are inlined (no icon package for three glyphs).
 *  - Links go through next/link (client-side navigation), external links stay <a>.
 *  - Directions are logical (start/end) so Arabic gets a mirrored sidebar.
 *  - Reduced motion is read with the project's hydration-safe hook.
 *  - The scrollbar styles live in globals.css (`.sidebar-nav`), not an injected <style>.
 * Colours come from `--background`, `--foreground`, `--border`, `--muted-foreground`
 * (and optional `--primitive-*` tokens), set by the surface that uses it.
 */

import { AnimatePresence, motion } from 'motion/react';
import NextLink from 'next/link';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

/* ─── Icons (Tabler, MIT — inlined) ─────────────────────────── */

function TablerIcon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <TablerIcon className={className}>
      <path d="M9 6l6 6l-6 6" />
    </TablerIcon>
  );
}

/* ─── Types ─────────────────────────────────────────────────── */

export type SidebarVariant = 'default' | 'collapsible' | 'icon-rail' | 'floating' | 'resizable';

export interface SidebarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  variant?: SidebarVariant;
  /** Controlled collapsed state (collapsible variant). */
  collapsed?: boolean;
  /** Initial collapsed state (uncontrolled). Default false. */
  defaultCollapsed?: boolean;
  /** Called when collapsed state changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Width in px when expanded. Default 260. */
  width?: number;
  /** Width in px when collapsed (icon-rail / collapsed collapsible). Default 60. */
  collapsedWidth?: number;
  /** Minimum width for resizable variant. Default 180. */
  minWidth?: number;
  /** Maximum width for resizable variant. Default 400. */
  maxWidth?: number;
  /** Accessible label for the navigation landmark. */
  'aria-label'?: string;
  /** Localised names of the expand / collapse actions. */
  labels?: { expand: string; collapse: string; resize?: string };
  children: React.ReactNode;
}

export type SidebarHeaderProps = React.HTMLAttributes<HTMLDivElement>;
export type SidebarNavProps = React.HTMLAttributes<HTMLDivElement>;

export interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section heading. Fades out when the sidebar is collapsed. */
  label?: string;
}

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon shown in both expanded and collapsed states. */
  icon?: React.ReactNode;
  /** Marks the item as the current route. */
  active?: boolean;
  /** Renders as a link when provided. */
  href?: string;
  /** Opens in a new tab. */
  external?: boolean;
  /** Badge / count shown after the label. */
  badge?: React.ReactNode;
  /** Shown on the icon while the sidebar is collapsed (e.g. an unread dot). */
  collapsedBadge?: React.ReactNode;
  asChild?: boolean;
}

export interface SidebarNestedProps {
  icon?: React.ReactNode;
  label: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  active?: boolean;
  children: React.ReactNode;
}

export type SidebarFooterProps = React.HTMLAttributes<HTMLDivElement>;

export interface SidebarToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  children?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  /** Standalone: pass collapsed state when used outside a collapsible <Sidebar>. */
  collapsed?: boolean;
  /** Standalone: called when toggled. */
  onToggle?: () => void;
}

/* ─── Motion constants ──────────────────────────────────────── */

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * Collapse / expand: half a second on a soft spring (it lands a hair past the width and settles).
 * The page beside the sidebar follows the real width on every frame — cards narrow and widen with
 * it. Everything inside the sidebar (labels, section titles, the brand row) answers on FADE over
 * the same half second, always mounted, so nothing pops in or out.
 */
export const SIDEBAR_MOTION = { ms: 500, easing: 'cubic-bezier(0.25, 1.1, 0.4, 1)' } as const;
/** labels, titles, the toggle row: opacity / height on the same clock (visibility flips after) */
export const SIDEBAR_FADE = {
  shown:
    'visible opacity-100 [transition:opacity_500ms_ease-in-out,height_500ms_ease-in-out,margin_500ms_ease-in-out,width_500ms_ease-in-out] motion-reduce:[transition:none]',
  hidden:
    'invisible opacity-0 [transition:opacity_500ms_ease-in-out,height_500ms_ease-in-out,margin_500ms_ease-in-out,width_500ms_ease-in-out,visibility_0s_500ms] motion-reduce:[transition:none]',
} as const;

/* ─── Context ───────────────────────────────────────────────── */

type SidebarContextValue = {
  variant: SidebarVariant;
  collapsed: boolean;
  toggleCollapsed: () => void;
  navId: string;
  labels: { expand: string; collapse: string };
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebarContext() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error('Sidebar compound components must be used within <Sidebar>');
  return ctx;
}

/**
 * Reads the current sidebar state, so custom header/footer content (a logo, a user card) follows
 * the real collapsed state.
 */
export function useSidebar(): {
  variant: SidebarVariant;
  collapsed: boolean;
  toggleCollapsed: () => void;
} {
  const { variant, collapsed, toggleCollapsed } = useSidebarContext();
  return { variant, collapsed, toggleCollapsed };
}

/* ─── Resizable width hook ──────────────────────────────────── */

function useResizableWidth(initial: number, min: number, max: number, dir: 1 | -1) {
  const [width, setWidth] = React.useState(initial);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragState = React.useRef<{ startX: number; startWidth: number } | null>(null);

  const clamp = React.useCallback(
    (value: number) => Math.min(max, Math.max(min, value)),
    [min, max],
  );

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width],
  );

  React.useEffect(() => {
    if (!isDragging) return;
    const onPointerMove = (e: PointerEvent) => {
      if (!dragState.current) return;
      const delta = (e.clientX - dragState.current.startX) * dir;
      setWidth(clamp(dragState.current.startWidth + delta));
    };
    const onPointerUp = () => {
      dragState.current = null;
      setIsDragging(false);
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging, clamp, dir]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 48 : 16;
      const grow = dir === 1 ? 'ArrowRight' : 'ArrowLeft';
      const shrink = dir === 1 ? 'ArrowLeft' : 'ArrowRight';
      if (e.key === shrink) {
        e.preventDefault();
        setWidth((w) => clamp(w - step));
      } else if (e.key === grow) {
        e.preventDefault();
        setWidth((w) => clamp(w + step));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setWidth(min);
      } else if (e.key === 'End') {
        e.preventDefault();
        setWidth(max);
      }
    },
    [clamp, min, max, dir],
  );

  const reset = React.useCallback(() => setWidth(initial), [initial]);
  return { width, isDragging, onPointerDown, onKeyDown, reset };
}

/* ─── Shared item styling ───────────────────────────────────── */

const itemBaseClasses = cn(
  'group/sidebar-item relative flex h-9 w-full items-center gap-2.5 rounded-[var(--primitive-radius-item,0.625rem)] px-2',
  'text-[13.5px] font-medium leading-none outline-none select-none whitespace-nowrap',
  'transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
  'focus-visible:ring-2 focus-visible:ring-[color:var(--primitive-ring,color-mix(in_srgb,var(--foreground)_45%,transparent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
  'disabled:pointer-events-none disabled:opacity-40',
);

const itemInactiveClasses = cn(
  'text-[color:var(--primitive-text-secondary,color-mix(in_srgb,var(--foreground)_72%,transparent))]',
  'hover:text-[var(--foreground)]',
  'hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]',
);

const itemActiveClasses = 'text-[var(--foreground)]';

const activePillClasses = cn(
  'pointer-events-none absolute inset-0 rounded-[var(--primitive-radius-item,0.625rem)]',
  'bg-[color:var(--primitive-surface-selected,color-mix(in_srgb,var(--foreground)_7%,transparent))]',
  'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_6%,transparent)]',
);
/** the accent bar inside the pill (start edge) */
const activeBarClasses =
  'absolute inset-y-[9px] start-0 w-[3px] rounded-e-full bg-[var(--sidebar-accent,var(--foreground))]';

/* ─── <Sidebar> ─────────────────────────────────────────────── */

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      variant = 'default',
      collapsed: controlledCollapsed,
      defaultCollapsed = false,
      onCollapsedChange,
      width: widthProp = 260,
      collapsedWidth = 60,
      minWidth = 180,
      maxWidth = 400,
      className,
      children,
      'aria-label': ariaLabel = 'Sidebar',
      labels,
      style,
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const prefersReducedMotion = usePrefersReducedMotion();
    const isCollapsible = variant === 'collapsible';
    const isIconRail = variant === 'icon-rail';
    const isResizable = variant === 'resizable';
    // the drag handle sits on the inline-end edge: in RTL dragging left widens
    const [rtl, setRtl] = React.useState(false);
    const navRef = React.useRef<HTMLElement | null>(null);
    React.useEffect(() => {
      if (navRef.current) setRtl(getComputedStyle(navRef.current).direction === 'rtl');
    }, []);

    const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed);
    const isControlled = controlledCollapsed !== undefined;
    const collapsed = isIconRail
      ? true
      : isCollapsible
        ? isControlled
          ? controlledCollapsed
          : internalCollapsed
        : false;

    const toggleCollapsed = React.useCallback(() => {
      if (!isCollapsible) return;
      const next = !collapsed;
      if (!isControlled) setInternalCollapsed(next);
      onCollapsedChange?.(next);
    }, [isCollapsible, collapsed, isControlled, onCollapsedChange]);

    const resize = useResizableWidth(widthProp, minWidth, maxWidth, rtl ? -1 : 1);

    const effectiveWidth = collapsed ? collapsedWidth : isResizable ? resize.width : widthProp;

    const ctx = React.useMemo<SidebarContextValue>(
      () => ({
        variant,
        collapsed,
        toggleCollapsed,
        navId: `sidebar-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
        labels: {
          expand: labels?.expand ?? 'Expand sidebar',
          collapse: labels?.collapse ?? 'Collapse sidebar',
        },
      }),
      [variant, collapsed, toggleCollapsed, reactId, labels?.expand, labels?.collapse],
    );

    return (
      <SidebarContext.Provider value={ctx}>
        <nav
          ref={(node) => {
            navRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          aria-label={ariaLabel}
          data-slot="sidebar"
          data-variant={variant}
          data-collapsed={collapsed ? 'true' : 'false'}
          data-dragging={resize.isDragging ? 'true' : undefined}
          style={{
            ...style,
            width: effectiveWidth,
            flexShrink: 0,
            // Width is a layout change by nature (adjacent content must reflow), so it animates
            // via an interruptible CSS transition rather than per-frame JS. Off while dragging.
            transition:
              resize.isDragging || prefersReducedMotion
                ? 'none'
                : `width ${SIDEBAR_MOTION.ms}ms ${SIDEBAR_MOTION.easing}`,
          }}
          className={cn(
            'relative isolate flex h-full flex-col overflow-clip',
            'bg-[var(--background)] text-[var(--foreground)]',
            variant === 'floating'
              ? cn(
                  'm-3 h-[calc(100%-1.5rem)] rounded-[var(--primitive-radius-surface,1rem)]',
                  'border border-[var(--border)]',
                  'bg-[color:var(--primitive-surface-elevated,var(--card))]',
                  '[box-shadow:var(--primitive-shadow-raised,0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.12))]',
                )
              : 'border-e border-[var(--border)]',
            resize.isDragging && 'select-none',
            className,
          )}
          {...props}
        >
          {children}
          {isResizable && (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label={labels?.resize ?? 'Resize sidebar'}
              aria-valuemin={minWidth}
              aria-valuemax={maxWidth}
              aria-valuenow={Math.round(resize.width)}
              data-slot="sidebar-resize-handle"
              onPointerDown={resize.onPointerDown}
              onKeyDown={resize.onKeyDown}
              onDoubleClick={resize.reset}
              className={cn(
                'absolute inset-y-0 end-0 z-20 w-1.5 cursor-col-resize outline-none',
                'after:absolute after:inset-y-0 after:end-0 after:w-[2px]',
                'after:bg-transparent after:transition-colors after:duration-150',
                'hover:after:bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)]',
                'focus-visible:after:bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]',
                resize.isDragging &&
                  'after:bg-[color-mix(in_srgb,var(--foreground)_30%,transparent)]',
              )}
            />
          )}
        </nav>
      </SidebarContext.Provider>
    );
  },
);
Sidebar.displayName = 'Sidebar';

/* ─── Fading label (shared by item / nested / section) ──────── */

function FadingLabel({
  show,
  className,
  children,
}: {
  show: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // Always in the tree: the narrowing sidebar clips it while it fades, and it is there to fade
  // back in. Hidden from pointers and assistive tech once it is gone.
  return (
    <span
      aria-hidden={show ? undefined : true}
      className={cn(
        'overflow-hidden whitespace-nowrap',
        show ? SIDEBAR_FADE.shown : SIDEBAR_FADE.hidden,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ─── <SidebarHeader> ───────────────────────────────────────── */

export const SidebarHeader = React.forwardRef<HTMLDivElement, SidebarHeaderProps>(
  ({ className, children, onClick, ...props }, ref) => {
    const { collapsed } = useSidebarContext();

    // A plain block: the brand row and, under it, the row that opens with the expand button.
    return (
      <div
        ref={ref}
        data-slot="sidebar-header"
        data-collapsed={collapsed ? 'true' : 'false'}
        onClick={onClick}
        className={cn('shrink-0 px-2 pt-2.5 pb-1', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SidebarHeader.displayName = 'SidebarHeader';

/* ─── <SidebarNav> ──────────────────────────────────────────── */

/** The scrolling middle. Its thin scrollbar is invisible at rest and shows while scrolling. */
export const SidebarNav = React.forwardRef<HTMLDivElement, SidebarNavProps>(
  ({ className, children, onScroll, ...props }, ref) => {
    const { navId } = useSidebarContext();
    const timer = React.useRef<number | undefined>(undefined);
    React.useEffect(() => () => window.clearTimeout(timer.current), []);
    return (
      <div
        ref={ref}
        id={navId}
        data-slot="sidebar-nav"
        onScroll={(e) => {
          onScroll?.(e);
          const el = e.currentTarget;
          el.classList.add('is-scrolling');
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => el.classList.remove('is-scrolling'), 700);
        }}
        className={cn(
          'sidebar-nav min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain py-2',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SidebarNav.displayName = 'SidebarNav';

/* ─── <SidebarSection> ──────────────────────────────────────── */

export const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, label, children, ...props }, ref) => {
    const { collapsed } = useSidebarContext();
    return (
      <div
        ref={ref}
        data-slot="sidebar-section"
        role="group"
        aria-label={label}
        className={cn('py-1', className)}
        {...props}
      >
        {label && <SectionTitle label={label} collapsed={collapsed} />}
        <div className="flex flex-col gap-px px-2">{children}</div>
      </div>
    );
  },
);
SidebarSection.displayName = 'SidebarSection';

function SectionTitle({ label, collapsed }: { label: string; collapsed: boolean }) {
  // A quiet caption. Collapsing: its height, margin and side padding close and it fades, all on
  // one 500 ms ease-in-out — the items move up as it goes; expanding plays the same backwards,
  // the caption sliding in from the edge.
  return (
    <div
      aria-hidden
      className={cn(
        'relative w-full shrink-0 overflow-hidden whitespace-nowrap transition-all duration-500 ease-in-out motion-reduce:transition-none',
        collapsed ? 'mb-0 h-0 px-0 opacity-0' : 'mb-2 h-5 px-[18px] opacity-100',
      )}
    >
      <div className="text-[12px] leading-5 font-semibold tracking-wider text-[color:color-mix(in_srgb,var(--foreground)_42%,transparent)] uppercase">
        {label}
      </div>
    </div>
  );
}

/* ─── Active pill (glides between items) ────────────────────── */

function ActivePill({ navId }: { navId: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  if (prefersReducedMotion)
    return (
      <span aria-hidden="true" className={activePillClasses}>
        <span className={activeBarClasses} />
      </span>
    );
  return (
    <motion.span
      aria-hidden="true"
      layoutId={`${navId}-active-pill`}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className={activePillClasses}
    >
      <span className={activeBarClasses} />
    </motion.span>
  );
}

/* ─── <SidebarItem> ─────────────────────────────────────────── */

export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  (
    {
      className,
      icon,
      active = false,
      href,
      external = false,
      badge,
      collapsedBadge,
      asChild = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const { collapsed, navId } = useSidebarContext();
    const composedClassName = cn(
      itemBaseClasses,
      active ? itemActiveClasses : itemInactiveClasses,
      className,
    );
    const title = collapsed && typeof children === 'string' ? children : undefined;

    if (asChild && React.isValidElement(children)) {
      return (
        <Slot.Root
          ref={ref as React.Ref<HTMLElement>}
          data-slot="sidebar-item"
          data-active={active ? 'true' : undefined}
          aria-current={active ? 'page' : undefined}
          title={title}
          className={composedClassName}
          {...(props as React.HTMLAttributes<HTMLElement>)}
        >
          {children}
        </Slot.Root>
      );
    }

    const content = (
      <>
        {active ? <ActivePill navId={navId} /> : null}
        {icon ? (
          <span
            data-slot="sidebar-item-icon"
            className={cn(
              'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-[8px]',
              'transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
              active
                ? 'text-[var(--foreground)]'
                : collapsed
                  ? 'text-[color:color-mix(in_srgb,var(--foreground)_82%,transparent)] group-hover/sidebar-item:text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] group-hover/sidebar-item:text-[var(--foreground)] group-active/sidebar-item:scale-95',
            )}
          >
            {icon}
            {collapsed && collapsedBadge ? collapsedBadge : null}
          </span>
        ) : null}
        <FadingLabel
          show={!collapsed}
          className={cn(
            'relative z-10 min-w-0 flex-1 truncate text-start',
            active && 'font-semibold',
          )}
        >
          {children}
        </FadingLabel>
        {badge ? (
          <FadingLabel show={!collapsed} className="relative z-10 flex shrink-0 items-center">
            {badge}
          </FadingLabel>
        ) : null}
      </>
    );

    if (href) {
      const anchorProps = {
        'data-slot': 'sidebar-item',
        'data-active': active ? 'true' : undefined,
        'aria-current': active ? ('page' as const) : undefined,
        title,
        className: composedClassName,
        ...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>),
      };
      return external ? (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...anchorProps}
        >
          {content}
        </a>
      ) : (
        <NextLink ref={ref as React.Ref<HTMLAnchorElement>} href={href} {...anchorProps}>
          {content}
        </NextLink>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-item"
        data-active={active ? 'true' : undefined}
        aria-current={active ? 'page' : undefined}
        disabled={disabled}
        title={title}
        className={composedClassName}
        {...props}
      >
        {content}
      </button>
    );
  },
);
SidebarItem.displayName = 'SidebarItem';

/* ─── <SidebarNested> ───────────────────────────────────────── */

export const SidebarNested = React.forwardRef<HTMLDivElement, SidebarNestedProps>(
  (
    {
      icon,
      label,
      open: controlledOpen,
      defaultOpen = false,
      onOpenChange,
      active = false,
      children,
    },
    ref,
  ) => {
    const { collapsed } = useSidebarContext();
    const prefersReducedMotion = usePrefersReducedMotion();
    const reactId = React.useId();
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    const toggle = React.useCallback(() => {
      const next = !open;
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    }, [open, isControlled, onOpenChange]);

    const contentId = `sidebar-nested-content-${reactId}`;

    return (
      <div ref={ref} data-slot="sidebar-nested" className="flex flex-col">
        <button
          type="button"
          data-slot="sidebar-nested-trigger"
          data-open={open ? 'true' : 'false'}
          data-active={active ? 'true' : undefined}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
          title={collapsed ? label : undefined}
          className={cn(
            itemBaseClasses,
            active && collapsed ? itemActiveClasses : itemInactiveClasses,
          )}
        >
          {active && collapsed && <span aria-hidden="true" className={activePillClasses} />}
          {icon && (
            <span
              data-slot="sidebar-nested-icon"
              className={cn(
                'relative z-10 flex size-5 shrink-0 items-center justify-center',
                'text-[var(--muted-foreground)] transition-colors duration-150 group-hover/sidebar-item:text-[var(--foreground)]',
              )}
            >
              {icon}
            </span>
          )}
          <FadingLabel
            show={!collapsed}
            className="relative z-10 min-w-0 flex-1 truncate text-start"
          >
            {label}
          </FadingLabel>
          <FadingLabel show={!collapsed} className="relative z-10 flex shrink-0 items-center">
            <motion.span
              aria-hidden="true"
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: EASE_OUT }}
              className="flex items-center justify-center text-[var(--muted-foreground)] rtl:-scale-x-100"
            >
              <IconChevronRight className="size-3.5" />
            </motion.span>
          </FadingLabel>
        </button>
        <AnimatePresence initial={false}>
          {open && !collapsed && (
            <motion.div
              id={contentId}
              data-slot="sidebar-nested-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: prefersReducedMotion ? 0 : 0.24, ease: EASE_OUT },
                opacity: { duration: prefersReducedMotion ? 0 : 0.16, ease: EASE_OUT },
              }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  'relative ms-[21px] flex flex-col gap-px py-0.5 ps-2.5',
                  'before:absolute before:inset-y-1 before:start-0 before:w-px',
                  'before:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]',
                )}
              >
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
SidebarNested.displayName = 'SidebarNested';

/* ─── <SidebarFooter> ───────────────────────────────────────── */

export const SidebarFooter = React.forwardRef<HTMLDivElement, SidebarFooterProps>(
  ({ className, children, ...props }, ref) => {
    const { collapsed } = useSidebarContext();
    return (
      <div
        ref={ref}
        data-slot="sidebar-footer"
        data-collapsed={collapsed ? 'true' : 'false'}
        className={cn(
          'flex shrink-0 items-center gap-2.5 overflow-hidden px-4 py-3',
          'border-t border-[var(--border)]',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SidebarFooter.displayName = 'SidebarFooter';

/* ─── <SidebarToggle> ───────────────────────────────────────── */

export const SidebarToggle = React.forwardRef<HTMLButtonElement, SidebarToggleProps>(
  ({ className, children, collapsed: collapsedProp, onToggle, ...props }, ref) => {
    const ctx = React.useContext(SidebarContext);
    const usesContext = ctx?.variant === 'collapsible';
    const collapsed = usesContext ? ctx!.collapsed : collapsedProp;
    const toggle = usesContext ? ctx!.toggleCollapsed : onToggle;
    const labels = ctx?.labels ?? { expand: 'Expand sidebar', collapse: 'Collapse sidebar' };

    if (collapsed === undefined || !toggle) return null;

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-toggle"
        data-collapsed={collapsed ? 'true' : 'false'}
        onClick={toggle}
        aria-label={collapsed ? labels.expand : labels.collapse}
        title={collapsed ? labels.expand : labels.collapse}
        aria-expanded={!collapsed}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-[var(--primitive-radius-control-sm,0.625rem)] outline-none',
          'text-[var(--muted-foreground)]',
          'hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-[var(--foreground)]',
          'focus-visible:ring-2 focus-visible:ring-[color:var(--primitive-ring,color-mix(in_srgb,var(--foreground)_45%,transparent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
          '[transition:transform_120ms_cubic-bezier(0.23,1,0.32,1),color_150ms_ease,background-color_150ms_ease]',
          'active:[transform:scale(0.96)]',
          'motion-reduce:active:[transform:none]',
          className,
        )}
        {...props}
      >
        {typeof children === 'function'
          ? children({ collapsed })
          : (children ?? (
              <IconChevronRight
                className={cn('size-[18px]', collapsed ? 'rtl:-scale-x-100' : 'ltr:-scale-x-100')}
              />
            ))}
      </button>
    );
  },
);
SidebarToggle.displayName = 'SidebarToggle';
