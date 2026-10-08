import { NextResponse, type NextRequest } from 'next/server';
import { backend } from '@/lib/env';
import { readLocalPublic } from '@/lib/storage';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

/** LOCAL MODE ONLY: serves public media buckets. In Supabase mode media comes from Storage. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
) {
  if (backend() !== 'local') return new NextResponse('not found', { status: 404 });
  const { bucket, path } = await params;
  if (bucket !== 'recipe-media' && bucket !== 'site-media')
    return new NextResponse('not found', { status: 404 });
  const objectPath = path.map(decodeURIComponent).join('/');
  const ext = objectPath.split('.').pop()?.toLowerCase() ?? '';
  if (!TYPES[ext]) return new NextResponse('not found', { status: 404 });
  try {
    const bytes = await readLocalPublic(bucket, objectPath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': TYPES[ext]!,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('not found', { status: 404 });
  }
}
