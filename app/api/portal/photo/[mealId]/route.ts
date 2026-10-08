import { NextResponse } from 'next/server';
import { getPortalClient } from '@/lib/auth';
import { getMealPhotoPath } from '@/lib/portal/data';
import { downloadPrivate, sniffImage } from '@/lib/storage';

/** A meal photo of the signed-in client (RLS: only their own meals resolve to a path). */
export async function GET(_request: Request, { params }: { params: Promise<{ mealId: string }> }) {
  const me = await getPortalClient();
  if (!me) return new NextResponse('unauthorized', { status: 401 });
  const { mealId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(mealId)) return new NextResponse('not found', { status: 404 });
  const path = await getMealPhotoPath(me.user.id, mealId);
  if (!path) return new NextResponse('not found', { status: 404 });
  const bytes = await downloadPrivate('diary-photos', path).catch(() => null);
  if (!bytes) return new NextResponse('not found', { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': sniffImage(bytes) ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
