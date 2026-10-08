import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-2xl',
            'display-xl',
            'display-lg',
            'display-md',
            'lead',
            'body',
            'ui',
            'label',
            'num-xl',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** wa.me link with an optional prefilled message. */
export function whatsappHref(number: string, text?: string): string {
  const base = `https://wa.me/${number.replace(/\D/g, '')}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Locale-aware uppercase — never String#toUpperCase() (Turkish i → İ). */
export function upper(value: string, locale: string): string {
  return value.toLocaleUpperCase(locale);
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
