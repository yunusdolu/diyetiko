'use client';

import { motion } from 'motion/react';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  ButtonInner,
  buttonClasses,
  useMagnet,
  type ButtonEffect,
  type ButtonSize,
  type ButtonTone,
  type ButtonVariant,
} from './motion-button';

type Shared = {
  children: ReactNode;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  effect?: ButtonEffect;
  icon?: ReactNode;
  className?: string;
};

const MotionIntlLink = motion.create(Link);

/** DOM drag/animation handlers clash with Motion's gesture props of the same name. */
type DragProps =
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration';

/** Internal (locale-aware) link styled as a button. */
export function MotionLink({
  href,
  children,
  variant = 'fill',
  tone = 'ink',
  size = 'md',
  effect = 'wipe',
  icon,
  className,
  ...rest
}: Shared & Omit<ComponentProps<typeof Link>, 'children' | 'className' | DragProps>) {
  const magnet = useMagnet();
  return (
    <MotionIntlLink
      href={href}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      style={effect === 'magnetic' ? magnet.style : undefined}
      {...(effect === 'magnetic' ? magnet.handlers : {})}
      className={cn(buttonClasses({ variant, tone, size }), className)}
      {...rest}
    >
      <ButtonInner
        variant={variant}
        tone={tone}
        effect={effect === 'magnetic' ? 'wipe' : effect}
        icon={icon}
      >
        {children}
      </ButtonInner>
    </MotionIntlLink>
  );
}

/** External link (WhatsApp, tel:, Instagram) styled as a button. */
export function ExternalButton({
  href,
  children,
  variant = 'fill',
  tone = 'ink',
  size = 'md',
  effect = 'wipe',
  icon,
  className,
  newTab,
  ...rest
}: Shared & { href: string; newTab?: boolean } & Omit<
    ComponentProps<'a'>,
    'children' | 'className' | 'href'
  >) {
  const magnet = useMagnet();
  return (
    <motion.a
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      style={effect === 'magnetic' ? magnet.style : undefined}
      {...(effect === 'magnetic' ? magnet.handlers : {})}
      className={cn(buttonClasses({ variant, tone, size }), className)}
      {...(rest as ComponentProps<typeof motion.a>)}
    >
      <ButtonInner
        variant={variant}
        tone={tone}
        effect={effect === 'magnetic' ? 'wipe' : effect}
        icon={icon}
      >
        {children}
      </ButtonInner>
    </motion.a>
  );
}

/**
 * Text link with a hairline that draws from inline-start on hover/focus and retracts toward
 * inline-end on leave (the "draw-on" underline used across the site).
 */
export function DrawLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn('group/draw relative inline-flex items-center gap-2', className)}
    >
      <DrawUnderline>{children}</DrawUnderline>
    </Link>
  );
}

export function DrawUnderline({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span className="relative inline-block pb-1">
      {children}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 bottom-0 h-[1.5px] origin-right scale-x-0 bg-current transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] rtl:origin-left',
          'group-hover/draw:origin-left group-hover/draw:scale-x-100 group-focus-visible/draw:origin-left group-focus-visible/draw:scale-x-100',
          'rtl:group-hover/draw:origin-right rtl:group-focus-visible/draw:origin-right',
          active && 'scale-x-100',
        )}
      />
    </span>
  );
}
