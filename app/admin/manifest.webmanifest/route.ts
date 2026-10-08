/**
 * Makes the panel installable ("Ana ekrana ekle" / "Uygulamayı yükle"): from the home screen or
 * the dock it opens straight at /admin — no address to type. Signed out, /admin goes to the
 * login page as usual; nothing private is in here.
 */
export function GET() {
  return Response.json(
    {
      name: 'Mutfak Masası — Diyetisyen paneli',
      short_name: 'Mutfak Masası',
      id: '/admin',
      start_url: '/admin',
      scope: '/admin',
      display: 'standalone',
      background_color: '#0F1B17',
      theme_color: '#0F1B17',
      icons: [
        { src: '/admin/app-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/admin/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/admin/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
