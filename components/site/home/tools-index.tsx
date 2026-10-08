'use client';

import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { useDir } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { ArrowIcon } from '@/components/ui/motion-button';

type Row = { href: ComponentProps<typeof Link>['href']; title: string; value: string };

/**
 * The tools index set as a nutrition label: each row is a tool; the "value" column says what
 * it gives you. Hover wipes the row with citrus from inline-start (ink text stays readable).
 */
export function ToolsIndex({ recipeCount }: { recipeCount: number }) {
  const t = useTranslations('home.tools');
  const tr = useTranslations('recipes');
  const nav = useTranslations('nav');
  const dir = useDir();
  const rows: Row[] = [
    { href: '/tools', title: t('calcTitle'), value: t('calcValue') },
    { href: '/goal', title: t('wizardTitle'), value: t('wizardValue') },
    {
      href: { pathname: '/recipes', query: { mode: 'fridge' } },
      title: tr('modes.fridge'),
      value: tr('count', { count: recipeCount }),
    },
    {
      href: { pathname: '/recipes', query: { mode: 'random' } },
      title: tr('modes.random'),
      value: t('randomValue'),
    },
    { href: '/recipes/shopping-list', title: tr('list.title'), value: t('listValue') },
  ];

  return (
    <div className="border-[3px] border-paper p-4 sm:p-6">
      <p className="font-sans text-[clamp(1.9rem,3.6vw,2.75rem)] leading-none font-black tracking-[-0.02em] ar:font-bold">
        {nav('tools')}
      </p>
      <div className="mt-4 border-t-[10px] border-paper" />
      <ul>
        {rows.map((row, i) => (
          <li key={i} className={cn('border-paper/40', i > 0 && 'border-t')}>
            <Link
              href={row.href}
              className="group/row relative flex items-center justify-between gap-4 overflow-hidden py-4 outline-none focus-visible:bg-citrus focus-visible:text-ink"
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-0 bg-citrus transition-[clip-path] duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]',
                  dir === 1 ? '[clip-path:inset(0_100%_0_0)]' : '[clip-path:inset(0_0_0_100%)]',
                  'group-hover/row:[clip-path:inset(0_0_0_0)]',
                )}
              />
              <span className="relative ps-2 text-[1.125rem] font-bold transition-colors duration-300 group-hover/row:text-ink sm:text-[1.25rem]">
                {row.title}
              </span>
              <span className="relative flex items-center gap-3 pe-2">
                <span className="num text-[0.8125rem] text-sage transition-colors duration-300 group-hover/row:text-ink">
                  {row.value}
                </span>
                <ArrowIcon className="transition-transform duration-300 group-hover/row:translate-x-1 group-hover/row:text-ink rtl:group-hover/row:-translate-x-1" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t-[5px] border-paper pt-3 text-[0.75rem] text-sage">
        {t('footnote')}
      </div>
    </div>
  );
}
