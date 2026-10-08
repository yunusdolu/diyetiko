import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { strictCsp } from '@/lib/csp';
import { LOCALE_COOKIE, SURFACE_HEADER, defaultLocale, isLocale } from '@/lib/i18n/config';
import { routing } from '@/lib/i18n/routing';
import { refreshSupabaseSession } from '@/lib/supabase/proxy';

const intl = createIntlMiddleware(routing);

function withStrictCsp(request: NextRequest, init?: (headers: Headers) => void) {
  const nonce = btoa(crypto.randomUUID());
  const csp = strictCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  init?.(headers);
  return { headers, csp };
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin: refresh the auth session cookie, strict CSP. The real auth check is in the admin
  // layout (server-side) — the proxy only keeps the session fresh.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const { headers, csp } = withStrictCsp(request);
    const response = NextResponse.next({ request: { headers } });
    await refreshSupabaseSession(request, response);
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  // Client portal: same treatment as admin (fresh session, strict CSP); the pages check the role.
  if (pathname === '/panel' || pathname.startsWith('/panel/')) {
    const { headers, csp } = withStrictCsp(request, (h) => h.set(SURFACE_HEADER, 'portal'));
    const response = NextResponse.next({ request: { headers } });
    await refreshSupabaseSession(request, response);
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  // Shared program pages: strict CSP, never indexed.
  if (pathname.startsWith('/p/')) {
    const { headers, csp } = withStrictCsp(request);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  // Honour an explicit language choice on the bare home URL only. Deep links are the source of
  // truth and are never redirected; Accept-Language is never used for redirects.
  if (pathname === '/') {
    const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
    if (isLocale(chosen) && chosen !== defaultLocale && !request.nextUrl.searchParams.has('stay')) {
      const url = request.nextUrl.clone();
      url.pathname = `/${chosen}`;
      return NextResponse.redirect(url, 307);
    }
  }

  return intl(request);
}

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
