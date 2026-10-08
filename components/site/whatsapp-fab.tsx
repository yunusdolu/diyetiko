'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDir, useMotionLevel } from '@/lib/motion/hooks';
import { spring } from '@/lib/motion';
import { whatsappHref } from '@/lib/utils';

export function ChatIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.6 0 2.3 1.1 4.3 2.9 5.7L5.6 20.5l4-1.9c.8.2 1.6.3 2.4.3 4.7 0 8.5-3.4 8.5-7.6S16.7 3.5 12 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 11.2h.01M12 11.2h.01M15.5 11.2h.01"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Floating WhatsApp button (inline-end, bottom). A slow ring pulse (every 3 s, well under the
 * 3 Hz flash limit; off for reduced motion). Hides while a [data-hide-fab] region is visible
 * (contact section, footer) so the page never shows two WhatsApp calls to action at once.
 */
export function WhatsappFab({ number }: { number: string }) {
  const t = useTranslations('nav');
  const level = useMotionLevel();
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState(false);
  const dir = useDir();
  const label = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  // the label's natural width, measured once it is in the page (and when the language changes)
  useLayoutEffect(() => {
    if (label.current) setLabelWidth(label.current.offsetWidth);
  }, [hidden, t]);
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-hide-fab]'));
    if (!els.length) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setHidden(visible.size > 0);
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.a
          href={whatsappHref(number)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('whatsapp')}
          data-fab
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          className="no-print fixed end-5 bottom-5 z-[55] flex h-14 items-center overflow-hidden rounded-pill bg-paprika text-ink shadow-[3px_3px_0_0_var(--color-ink)] sm:end-7 sm:bottom-7"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
        >
          {level !== 'reduced' && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-pill border-2 border-paprika"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeOut' }}
            />
          )}
          <span className="grid size-14 place-items-center">
            <ChatIcon />
          </span>
          {/* The label opens to its measured width on one decelerating curve (no spring: a spring
              overshoots the width and settles back — the hitch at both ends). */}
          <motion.span
            className="block overflow-hidden"
            initial={false}
            animate={{ width: hover ? labelWidth : 0 }}
            transition={{
              duration: level === 'reduced' ? 0 : hover ? 0.42 : 0.3,
              ease: hover ? [0.22, 1, 0.36, 1] : [0.4, 0, 0.2, 1],
            }}
          >
            <motion.span
              ref={label}
              className="inline-block pe-5 text-ui font-semibold whitespace-nowrap"
              initial={false}
              animate={{ opacity: hover ? 1 : 0, x: hover || level === 'reduced' ? 0 : -6 * dir }}
              transition={{
                duration: hover ? 0.3 : 0.16,
                delay: hover ? 0.06 : 0,
                ease: 'easeOut',
              }}
            >
              {t('whatsapp')}
            </motion.span>
          </motion.span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
