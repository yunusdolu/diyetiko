import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Public pages are statically rendered, so they cannot carry a per-request nonce.
 * They get this policy (inline scripts allowed for Next's hydration payload, nothing external).
 * /admin and /p/* get a stricter nonce-based policy from proxy.ts.
 */
const publicCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  experimental: {
    // `pnpm dev` (Supabase) and `pnpm dev:local` (demo) share one `.next/dev`, and the dev server
    // is often stopped hard. A compilation restored from disk can then be older on the server
    // side than in the browser: the page hydrates against HTML made by old code ("a tree hydrated
    // but some attributes … didn't match"). Every `next dev` therefore compiles from the files as
    // they are; the build cache (`next build`) is untouched.
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    remotePatterns: supabaseOrigin
      ? [
          {
            protocol: 'https',
            hostname: new URL(supabaseOrigin).hostname,
            pathname: '/storage/v1/object/**',
          },
        ]
      : [],
  },
  async headers() {
    return [
      // Public pages: static CSP. /admin and /p get a nonce CSP from proxy.ts instead.
      {
        source: '/((?!admin|p/|api/).*)',
        headers: [{ key: 'Content-Security-Policy', value: publicCsp }, ...securityHeaders],
      },
      { source: '/admin/:path*', headers: securityHeaders },
      {
        source: '/p/:path*',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      { source: '/api/:path*', headers: securityHeaders },
    ];
  },
};

export default withNextIntl(nextConfig);
