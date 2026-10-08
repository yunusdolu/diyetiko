import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import * as q from '@/lib/admin/portal';
import { getStaffUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { putObject, removeObjects } from '@/lib/storage';
import { readUpload, UPLOAD_STATUS } from '@/lib/uploads';

/** The dietitian sends a file to a client (a plan as a PDF, a marked-up result), with a note. */
export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await rateLimit('admin-attachment', 600, 60)))
    return NextResponse.json({ error: 'rateLimited' }, { status: 429 });

  const form = await request.formData().catch(() => null);
  const clientId = String(form?.get('clientId') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(clientId))
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const up = await readUpload(form?.get('file'));
  if (!up.ok) return NextResponse.json({ error: up.error }, { status: UPLOAD_STATUS[up.error] });
  const note = String(form?.get('body') ?? '')
    .trim()
    .slice(0, 2000);

  // "<dietitian>/<client>/…": the message trigger refuses a path outside the client's folder,
  // and RLS refuses a client that is not the dietitian's own
  const path = `${user.id}/${clientId}/${crypto.randomUUID()}.${up.file.ext}`;
  await putObject('client-uploads', path, up.file.bytes.buffer as ArrayBuffer, up.file.type);
  try {
    await q.sendMessage(user.id, clientId, note || up.file.name, {
      path,
      name: up.file.name,
      mime: up.file.type,
      size: up.file.bytes.byteLength,
    });
  } catch {
    await removeObjects('client-uploads', [path]).catch(() => undefined);
    return NextResponse.json({ error: 'failed' }, { status: 400 });
  }
  revalidatePath('/admin/messages');
  revalidatePath(`/admin/clients/${clientId}`);
  return NextResponse.json({ ok: true });
}
