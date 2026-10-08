'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

/** Recharts is loaded only when a chart is on screen (keeps it out of the shell bundle). */
export const TrendChartLazy = dynamic(() => import('./charts').then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full text-a-text" />,
});
