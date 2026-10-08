'use client';

import { PlainLink } from '@/components/ui/plain-link';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  type TargetAndTransition,
  type Transition,
} from 'motion/react';
import { Dialog as D } from 'radix-ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { useDir, useMotionLevel } from '@/lib/motion/hooks';
import { dur, ease, stagger } from '@/lib/motion';
import { cn, whatsappHref } from '@/lib/utils';
import { ArrowIcon } from '@/components/ui/motion-button';
import { MotionLink } from '@/components/ui/motion-link';
import { DrawUnderline } from '@/components/ui/motion-link';
import { Ingredient } from './ingredients';
import { LangSwitcher } from './lang-switcher';
import { headerNav, primaryNav } from './nav-data';

export function BrandMark({ className }: { className?: string }) {
  // Three arcs = the macro rings, reduced to a glyph.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke="var(--color-protein-on-light)"
        strokeWidth="3.5"
        strokeDasharray="26 100"
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
      />
      <circle
        cx="16"
        cy="16"
        r="8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeDasharray="30 100"
        strokeLinecap="round"
        transform="rotate(40 16 16)"
      />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

export function Header({
  contact,
}: {
  contact: { whatsapp: string; phoneDisplay: string; phoneE164: string; instagram: string };
}) {
  const t = useTranslations('nav');
  const tm = useTranslations('meta');
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [underDark, setUnderDark] = useState(false);
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const bar = useRef<HTMLElement>(null);

  /** Is the section right under the (transparent) bar a dark one? Then the bar inverts. */
  const detectTone = useCallback(() => {
    const el = bar.current;
    if (!el) return;
    const y = el.offsetHeight / 2;
    const under = document
      .elementsFromPoint(window.innerWidth / 2, y)
      .find((node) => !el.contains(node));
    setUnderDark(Boolean(under?.closest('.on-dark')));
  }, []);

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    // Dead zone: tiny trackpad jitters must not make the bar flicker in and out.
    if (y <= 160 || open) setHidden(false);
    else if (Math.abs(y - prev) >= 4) setHidden(y > prev);
    if (y <= 24) detectTone();
  });

  useEffect(() => {
    const id = window.setTimeout(detectTone, 60);
    return () => window.clearTimeout(id);
  }, [pathname, detectTone]);

  const dark = underDark && !scrolled;

  useEffect(() => {
    // Close the menu whenever the route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <motion.header
        className={cn(
          'no-print fixed inset-x-0 top-0 z-[60] transition-[background-color,box-shadow] duration-300',
          scrolled
            ? 'bg-paper/92 shadow-[0_1px_0_0_rgb(15_27_23/0.12)] backdrop-blur-[6px]'
            : 'bg-transparent',
          dark ? 'on-dark text-paper' : 'text-ink',
        )}
        ref={bar}
        animate={{ y: hidden ? '-100%' : '0%' }}
        transition={{ duration: dur.md, ease: ease.out }}
      >
        <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-[72px]">
          <Link
            href="/"
            className="group/brand flex items-center gap-2.5 coarse:min-h-11"
            aria-label={tm('siteName')}
          >
            <BrandMark className="size-8 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/brand:rotate-[30deg]" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[1.15rem] font-semibold tracking-[-0.01em] whitespace-nowrap sm:text-[1.3rem] ar:text-[1.35rem] ar:font-bold">
                {tm('shortName')}
              </span>
              <span
                className={cn(
                  'mt-1 label text-[0.625rem] ar:text-[0.75rem] ar:font-medium ar:normal-case',
                  dark ? 'text-sage' : 'text-ink-60',
                )}
              >
                {tm('siteName').replace(tm('shortName'), '').trim()}
              </span>
            </span>
          </Link>

          <nav aria-label={t('primary')} className="hidden items-center gap-7 lg:flex">
            {headerNav.map((key) => {
              const item = primaryNav.find((n) => n.key === key)!;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={key}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="group/draw tap-44 text-ui font-semibold"
                >
                  <DrawUnderline active={active}>{t(key)}</DrawUnderline>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <MotionLink
              href="/goal"
              size="sm"
              variant="outline"
              tone={dark ? 'paper' : 'ink'}
              className="hidden xl:inline-flex"
              icon={<ArrowIcon size={16} />}
            >
              {t('goal')}
            </MotionLink>
            <MotionLink
              href="/apply"
              size="sm"
              tone={dark ? 'citrus' : 'ink'}
              className="hidden sm:inline-flex"
              icon={<ArrowIcon size={16} />}
            >
              {t('apply')}
            </MotionLink>
            <LangSwitcher tone={dark ? 'dark' : 'light'} />
            <MenuButton open={open} dark={dark} onClick={() => setOpen(true)} label={t('menu')} />
          </div>
        </div>
      </motion.header>
      <MenuSheet open={open} onOpenChange={setOpen} contact={contact} />
    </>
  );
}

function MenuButton({
  open,
  onClick,
  label,
  dark,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(
        'group/menu inline-flex h-10 items-center gap-2.5 rounded-pill ps-4 pe-3 text-[0.8125rem] font-semibold transition-[transform,background-color,color] duration-300 active:scale-95',
        dark ? 'bg-citrus text-ink' : 'bg-ink text-paper',
      )}
    >
      <span>{label}</span>
      <span className="flex w-4 flex-col gap-[5px]" aria-hidden>
        <span className="rounded h-[1.5px] w-full bg-current transition-transform duration-300 group-hover/menu:translate-y-[1px]" />
        <span className="rounded h-[1.5px] w-2/3 bg-current transition-[width] duration-300 group-hover/menu:w-full" />
      </span>
    </button>
  );
}

function MenuSheet({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact: { whatsapp: string; phoneDisplay: string; phoneE164: string; instagram: string };
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('contact');
  const tf = useTranslations('footer');
  const dir = useDir();
  const level = useMotionLevel();
  const reduced = level === 'reduced';
  const pathname = usePathname();
  const [hover, setHover] = useState<string | null>(null);

  // Clip-path wipe from the inline-end edge (where the menu button lives). The wipe is ONE number
  // (--wipe, 100 = shut, 0 = open) and the clip-path is built from it in CSS: closing half-way
  // through the opening then turns round from exactly where it is. Animating the clip-path string
  // itself could not be interrupted (the value read back mid-way is in other units, so it jumped
  // shut and waited).
  const wipe = (v: number, transition?: Transition) =>
    ({ '--wipe': v, transition }) as TargetAndTransition;
  const clipPath =
    dir === 1 ? 'inset(0 0 0 calc(var(--wipe) * 1%))' : 'inset(0 calc(var(--wipe) * 1%) 0 0)';

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                data-lenis-prevent
                className="on-dark fixed inset-0 z-[90] overflow-y-auto bg-green grain-light text-paper"
                style={reduced ? undefined : { clipPath }}
                initial={reduced ? { opacity: 0 } : wipe(100)}
                animate={reduced ? { opacity: 1 } : wipe(0, { duration: 0.75, ease: ease.inOut })}
                exit={reduced ? { opacity: 0 } : wipe(100, { duration: 0.5, ease: ease.out })}
              >
                <D.Title className="sr-only">{t('menu')}</D.Title>
                <div className="container-x flex h-16 items-center justify-between lg:h-[72px]">
                  <span className="label text-sage">{t('menu')}</span>
                  <div className="flex items-center gap-2">
                    <LangSwitcher tone="dark" />
                    <D.Close className="inline-flex h-10 items-center gap-2 rounded-pill bg-citrus px-4 text-[0.8125rem] font-semibold text-ink transition-transform active:scale-95">
                      {t('close')}
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                        <path
                          d="M6 6l12 12M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </D.Close>
                  </div>
                </div>

                <div className="container-x grid grid-cols-1 gap-12 pt-6 pb-16 lg:grid-cols-12 lg:pt-10">
                  <nav aria-label={t('primary')} className="lg:col-span-8">
                    <ol className="border-t border-paper/15">
                      {[
                        { key: 'home' as const, href: '/' as const, illustration: 'egg' },
                        ...primaryNav,
                      ].map((item, i) => {
                        const active =
                          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                        return (
                          <motion.li
                            key={item.key}
                            className="border-b border-paper/15"
                            initial={reduced ? false : { opacity: 0, y: 28 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: {
                                duration: dur.lg,
                                ease: ease.out,
                                delay: 0.25 + i * stagger.item,
                              },
                            }}
                          >
                            <Link
                              href={item.href}
                              onPointerEnter={() => setHover(item.illustration)}
                              onPointerLeave={() => setHover(null)}
                              onFocus={() => setHover(item.illustration)}
                              aria-current={active ? 'page' : undefined}
                              className="group/item flex items-baseline gap-5 py-3 sm:py-4"
                            >
                              <span className="w-8 shrink-0 num text-[0.75rem] text-sage">
                                {String(i).padStart(2, '0')}
                              </span>
                              <span
                                className={cn(
                                  'font-display text-[clamp(2.25rem,6.4vw,4.75rem)] leading-[1.02] tracking-[-0.02em] transition-[color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/item:translate-x-3 group-hover/item:text-citrus rtl:group-hover/item:-translate-x-3 ar:leading-[1.3] ar:tracking-normal',
                                  active && 'text-citrus',
                                )}
                              >
                                {t(item.key)}
                              </span>
                            </Link>
                          </motion.li>
                        );
                      })}
                    </ol>
                  </nav>

                  <div className="flex flex-col gap-10 lg:col-span-4 lg:pt-2">
                    <div
                      className="relative hidden aspect-square w-full max-w-72 lg:block"
                      aria-hidden
                    >
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={hover ?? 'none'}
                          className="absolute inset-0"
                          initial={{ opacity: 0, rotate: -12, scale: 0.85 }}
                          animate={{
                            opacity: 1,
                            rotate: 0,
                            scale: 1,
                            transition: { duration: dur.lg, ease: ease.out },
                          }}
                          exit={{
                            opacity: 0,
                            rotate: 10,
                            scale: 0.9,
                            transition: { duration: dur.sm },
                          }}
                        >
                          <Ingredient name={hover ?? 'lemon'} className="size-full" />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <motion.div
                      className="space-y-5"
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: 0.6, duration: dur.lg } }}
                    >
                      <p className="label text-sage">{tf('reach')}</p>
                      <ul className="space-y-3 text-lead">
                        <li>
                          <a
                            className="group/draw"
                            href={whatsappHref(contact.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <DrawUnderline>{tc('whatsapp')}</DrawUnderline>
                          </a>
                        </li>
                        <li>
                          <a className="group/draw num" href={`tel:${contact.phoneE164}`} dir="ltr">
                            <DrawUnderline>{contact.phoneDisplay}</DrawUnderline>
                          </a>
                        </li>
                        <li>
                          <a
                            className="group/draw"
                            href={`https://instagram.com/${contact.instagram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            dir="ltr"
                          >
                            <DrawUnderline>@{contact.instagram}</DrawUnderline>
                          </a>
                        </li>
                      </ul>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <PlainLink
                          href="/panel/login"
                          className="inline-flex h-10 items-center rounded-pill border border-paper/25 px-4 text-[0.8125rem] font-semibold transition-colors hover:border-citrus hover:text-citrus"
                        >
                          {tf('clientLogin')}
                        </PlainLink>
                        <PlainLink
                          href="/admin/login"
                          className="inline-flex h-10 items-center rounded-pill border border-paper/25 px-4 text-[0.8125rem] font-semibold transition-colors hover:border-citrus hover:text-citrus"
                        >
                          {tf('dietitianLogin')}
                        </PlainLink>
                      </div>
                      <p className="max-w-sm text-[0.8125rem] text-sage">{tf('disclaimer')}</p>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
