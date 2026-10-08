import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getPortalClient } from '@/lib/auth';
import * as portal from '@/lib/portal/data';
import { rateLimit } from '@/lib/rate-limit';
import { putObject, removeObjects } from '@/lib/storage';
import { readUpload, UPLOAD_STATUS } from '@/lib/uploads';

/** The client sends a file to the dietitian (a lab report, a photo of a result), with a note. */
export async function POST(request: Request) {
  const me = await getPortalClient();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await rateLimit('portal-attachment', 600, 12)))
    return NextResponse.json({ error: 'rateLimited' }, { status: 429 });

  const form = await request.formData().catch(() => null);
  const up = await readUpload(form?.get('file'));
  if (!up.ok) return NextResponse.json({ error: up.error }, { status: UPLOAD_STATUS[up.error] });
  const note = String(form?.get('body') ?? '')
    .trim()
    .slice(0, 2000);

  const prefix = await portal.photoPrefix(me.user.id);
  if (!prefix) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const path = `${prefix}${crypto.randomUUID()}.${up.file.ext}`;
  await putObject('client-uploads', path, up.file.bytes.buffer as ArrayBuffer, up.file.type);
  try {
    await portal.sendMessage(me.user.id, me.status.clientId, note || up.file.name, null, {
      path,
      name: up.file.name,
      mime: up.file.type,
      size: up.file.bytes.byteLength,
    });
  } catch {
    // no message, no orphan file
    await removeObjects('client-uploads', [path]).catch(() => undefined);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  revalidatePath('/panel/messages');
  return NextResponse.json({ ok: true });
}
