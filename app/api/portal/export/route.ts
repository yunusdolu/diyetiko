import { NextResponse } from 'next/server';
import { getPortalClient } from '@/lib/auth';
import * as portal from '@/lib/portal/data';
import { todayISO } from '@/lib/portal/logic';
import { rateLimit } from '@/lib/rate-limit';

/** KVKK right of access: everything the portal holds for the signed-in client, as one JSON file. */
export async function GET() {
  const me = await getPortalClient();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await rateLimit('portal-export', 600, 10)))
    return NextResponse.json({ error: 'rateLimited' }, { status: 429 });

  const today = todayISO();
  const data = await portal.exportOwnData(me.user.id, today);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="panel-verilerim-${today}.json"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
