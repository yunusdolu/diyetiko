'use client';

import { Ticker } from '@/components/ui/ticker';

/** Admin number tween: short (≤ 0.6 s), starts immediately. */
export function AdminTicker({ value, decimals = 0 }: { value: number; decimals?: number }) {
  return <Ticker value={value} decimals={decimals} immediate duration={0.6} />;
}
