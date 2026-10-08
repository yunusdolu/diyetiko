import { NextResponse } from 'next/server';
import { getPortalClient } from '@/lib/auth';
import * as portal from '@/lib/portal/data';
import { clampDay, todayISO } from '@/lib/portal/logic';
import { rateLimit } from '@/lib/rate-limit';
import { LIMITS, putObject, removeObjects, sniffImage } from '@/lib/storage';
import { mealSlot } from '@/lib/validators/portal';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/** Upload a meal photo (the browser has already resized it and stripped its metadata). */
export async function POST(request: Request) {
  const me = await getPortalClient();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await rateLimit('portal-photo', 600, 40)))
    return NextResponse.json({ error: 'rateLimited' }, { status: 429 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const day = String(form?.get('day') ?? '');
  const slot = mealSlot.safeParse(form?.get('slot'));
  const today = todayISO();
  if (!(file instanceof File) || !slot.success || clampDay(day, today) !== day) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > LIMITS.photoMaxBytes)
    return NextResponse.json({ error: 'tooLarge' }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes); // the real type, from the bytes — never the declared one
  if (!type) return NextResponse.json({ error: 'type' }, { status: 415 });

  const prefix = await portal.photoPrefix(me.user.id);
  if (!prefix) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const path = `${prefix}${crypto.randomUUID()}.${EXT[type]}`;
  await putObject('diary-photos', path, bytes.buffer as ArrayBuffer, type);
  const { mealId, previous } = await portal.setMealPhoto(
    me.user.id,
    me.status.clientId,
    day,
    slot.data,
    path,
  );
  if (previous && previous !== path)
    await removeObjects('diary-photos', [previous]).catch(() => undefined);
  return NextResponse.json({ ok: true, mealId });
}
