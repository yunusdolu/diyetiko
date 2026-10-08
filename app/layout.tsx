import type { ReactNode } from 'react';
import './globals.css';

/*
 * Pass-through root layout. The real <html> lives in each top-level area so every area can
 * set its own lang/dir: app/[locale] (public site), app/admin, app/p (shared programmes).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
