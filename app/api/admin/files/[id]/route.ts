import { NextResponse, type NextRequest } from 'next/server';
import { getFile } from '@/lib/admin/clients';
import { getStaffUser } from '@/lib/auth';
import { readPrivate } from '@/lib/storage';

/** Private client file download: owner check via RLS, audited, never cached. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser(); // dietitian only (a signed-in client gets 401)
  if (!user) return new NextResponse('unauthorized', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('not found', { status: 404 });
  const file = await getFile(user.id, id);
  if (!file) return new NextResponse('not found', { status: 404 });
  const res = await readPrivate(file.storage_path);
  if ('url' in res)
    return NextResponse.redirect(res.url, { headers: { 'Cache-Control': 'no-store' } });
  return new NextResponse(new Uint8Array(res.bytes), {
    headers: {
      'Content-Type': file.mime_type,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
