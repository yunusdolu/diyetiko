import { NextResponse } from 'next/server';
import { getMessageFile } from '@/lib/admin/portal';
import { getStaffUser } from '@/lib/auth';
import { downloadPrivate } from '@/lib/storage';
import { fileResponse } from '@/lib/uploads';

/** A file from one of the dietitian's threads (RLS: only messages of their own clients resolve). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('not found', { status: 404 });
  const file = await getMessageFile(user.id, id);
  if (!file) return new NextResponse('not found', { status: 404 });
  const bytes = await downloadPrivate('client-uploads', file.path).catch(() => null);
  if (!bytes) return new NextResponse('not found', { status: 404 });
  return fileResponse(bytes, file.name);
}
