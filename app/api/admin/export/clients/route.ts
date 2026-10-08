import { NextResponse } from 'next/server';
import { exportClientsCsv } from '@/lib/admin/clients';
import { getStaffUser } from '@/lib/auth';

/** CSV export of client records (audited). BOM so Excel opens UTF-8 (Turkish characters) correctly. */
export async function GET() {
  const user = await getStaffUser(); // dietitian only (a signed-in client gets 401)
  if (!user) return new NextResponse('unauthorized', { status: 401 });
  const csv = await exportClientsCsv(user.id);
  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="danisanlar-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
