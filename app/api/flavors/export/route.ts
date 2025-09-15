import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasAnyRole(user, ['admin', 'manager'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const flavors: any[] = await (prisma as any).item.findMany({
      where: { isActive: true, category: { name: 'Gelato Flavors' } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    const header = ['name','unit','targetText','targetNumber','sortOrder','isActive','defaultQuantity'];
    const rows = flavors.map((f: any) => [
      escapeCsv(f.name),
      escapeCsv(f.unit || ''),
      escapeCsv(f.targetText || ''),
      f.targetNumber ?? '',
      f.sortOrder ?? 0,
      f.isActive ? 1 : 0,
      f.defaultQuantity ?? ''
    ].join(','));

    const csv = [header.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="flavors-template.csv"`
      }
    });
  } catch (error) {
    console.error('Export flavors failed:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
