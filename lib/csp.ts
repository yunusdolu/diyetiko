/** Nonce-based CSP for dynamic, sensitive routes (/admin, /p). */
export function strictCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Motion writes inline style attributes; styles cannot execute code.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase ? ` ${supabase}` : ''}`,
    "font-src 'self'",
    `connect-src 'self'${supabase ? ` ${supabase} ${supabase.replace('https://', 'wss://')}` : ''}${isDev ? ' ws:' : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}
