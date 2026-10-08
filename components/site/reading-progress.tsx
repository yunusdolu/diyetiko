'use client';

import { motion, useScroll, useSpring } from 'motion/react';
import { useTranslations } from 'next-intl';

/** Thin progress bar under the header; fills from inline-start (right in RTL). */
export function ReadingProgress() {
  const t = useTranslations('guides');
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      role="progressbar"
      aria-label={t('progress')}
      aria-valuemin={0}
      aria-valuemax={100}
      className="no-print fixed inset-x-0 top-0 z-[61] h-[3px] origin-left bg-paprika rtl:origin-right"
      style={{ scaleX }}
    />
  );
}
