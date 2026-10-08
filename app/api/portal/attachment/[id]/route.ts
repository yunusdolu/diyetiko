import { NextResponse } from 'next/server';
import { getPortalClient } from '@/lib/auth';
import { getMessageFile } from '@/lib/portal/data';
import { downloadPrivate } from '@/lib/storage';
import { fileResponse } from '@/lib/uploads';

/** A file from the signed-in client's own thread (RLS: only their messages resolve to a path). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getPortalClient();
  if (!me) return new NextResponse('unauthorized', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('not found', { status: 404 });
  const file = await getMessageFile(me.user.id, id);
  if (!file) return new NextResponse('not found', { status: 404 });
  const bytes = await downloadPrivate('client-uploads', file.path).catch(() => null);
  if (!bytes) return new NextResponse('not found', { status: 404 });
  return fileResponse(bytes, file.name);
}
