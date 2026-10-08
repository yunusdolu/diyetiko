import { ImageResponse } from 'next/og';

/**
 * The panel's app icon (PNG, for "install" / "add to home screen"): the brand mark on ink, with
 * room around it so Android's round and squircle masks never cut into it.
 */
const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  const mark = Math.round(size * 0.58);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F1B17',
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 32 32">
        <circle
          cx="16"
          cy="16"
          r="11"
          fill="none"
          stroke="#d9431f"
          strokeWidth="3.5"
          strokeDasharray="22 100"
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
        />
        <circle
          cx="16"
          cy="16"
          r="6.8"
          fill="none"
          stroke="#f3eee4"
          strokeWidth="3.2"
          strokeDasharray="25 100"
          strokeLinecap="round"
          transform="rotate(40 16 16)"
        />
        <circle cx="16" cy="16" r="2.6" fill="#f3eee4" />
      </svg>
    </div>,
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
