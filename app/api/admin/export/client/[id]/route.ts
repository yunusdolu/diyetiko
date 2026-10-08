import { NextResponse, type NextRequest } from 'next/server';
import { exportClientJson } from '@/lib/admin/clients';
import { getStaffUser } from '@/lib/auth';

/** Full data export for one client (KVKK access request). Audited; never cached. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser(); // dietitian only (a signed-in client gets 401)
  if (!user) return new NextResponse('unauthorized', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('not found', { status: 404 });
  const data = await exportClientJson(user.id, id);
  if (!data) return new NextResponse('not found', { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="client-${id.slice(0, 8)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
