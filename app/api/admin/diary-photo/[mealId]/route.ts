import { NextResponse } from 'next/server';
import { getDiaryPhotoPath } from '@/lib/admin/portal';
import { getStaffUser } from '@/lib/auth';
import { downloadPrivate, sniffImage } from '@/lib/storage';

/** A client's meal photo for the dietitian (RLS: only meals of their own practice resolve). */
export async function GET(_request: Request, { params }: { params: Promise<{ mealId: string }> }) {
  const user = await getStaffUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });
  const { mealId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(mealId)) return new NextResponse('not found', { status: 404 });
  const path = await getDiaryPhotoPath(user.id, mealId);
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
