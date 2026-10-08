import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { insertFile } from '@/lib/admin/clients';
import { getStaffUser } from '@/lib/auth';
import { LIMITS, objectName, putObject, type Bucket } from '@/lib/storage';

/**
 * Authenticated uploads. kind=client → private client-files bucket + client_files row;
 * kind=recipe|site → public media buckets (returns the object path to store on the record).
 */
export async function POST(req: NextRequest) {
  const user = await getStaffUser(); // dietitian only (a signed-in client gets 401)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') ?? '');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file' }, { status: 400 });
  if (file.size <= 0 || file.size > LIMITS.maxBytes)
    return NextResponse.json({ error: 'tooLarge' }, { status: 413 });

  const bucket: Bucket | null =
    kind === 'client'
      ? 'client-files'
      : kind === 'recipe'
        ? 'recipe-media'
        : kind === 'site'
          ? 'site-media'
          : null;
  if (!bucket) return NextResponse.json({ error: 'kind' }, { status: 400 });
  const allowed: readonly string[] =
    bucket === 'client-files' ? LIMITS.clientTypes : LIMITS.mediaTypes;
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'badType' }, { status: 415 });

  const clientId = String(form.get('clientId') ?? '');
  if (bucket === 'client-files' && !/^[0-9a-f-]{36}$/.test(clientId))
    return NextResponse.json({ error: 'client' }, { status: 400 });

  const objectPath = objectName(user.id, bucket === 'client-files' ? clientId : kind, file.name);
  try {
    await putObject(bucket, objectPath, await file.arrayBuffer(), file.type);
    if (bucket === 'client-files') {
      // RLS verifies the client belongs to this user; a foreign id makes the insert fail.
      await insertFile(user.id, {
        client_id: clientId,
        storage_path: objectPath,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        size_bytes: file.size,
      });
      revalidatePath(`/admin/clients/${clientId}`);
    }
  } catch (error) {
    console.error('upload failed', (error as { code?: string }).code ?? 'unknown');
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ path: objectPath });
}
