import Link from 'next/link';
import '@/app/globals.css';
import { fontVariables } from '@/lib/fonts';

/** Fallback 404 for paths outside every area (no locale context available). */
export default function GlobalNotFound() {
  return (
    <html lang="tr" dir="ltr" className={fontVariables}>
      <body className="grid min-h-dvh place-items-center bg-paper grain p-6 text-ink">
        <main className="max-w-md">
          <p className="num-display text-[8rem] leading-[0.8] text-paprika-deep">404</p>
          <h1 className="mt-6 font-display text-[2.5rem] leading-tight">Bu tabak boş.</h1>
          <p className="mt-3 text-lead text-ink-70" lang="en">
            This plate is empty.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex h-12 items-center rounded-pill bg-ink px-6 font-semibold text-paper"
          >
            Ana sayfa · Home
          </Link>
        </main>
      </body>
    </html>
  );
}
