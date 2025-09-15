import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

function dayBounds(dateStr?: string) {
  if (!dateStr) return {} as { gte?: Date; lte?: Date };
  // Expect YYYY-MM-DD (from toISOString().slice(0,10))
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { gte: start, lte: end };
}

export async function GET(req: NextRequest) {
  try {
    // Auth
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'deliveries:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'DRAFT' | 'CONFIRMED' | 'SENT' | null;
    const date = searchParams.get('date') || undefined;
    const storeId = searchParams.get('storeId') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    // Build date condition: single day has precedence; otherwise use from/to range if provided
    let dateCond: { gte?: Date; lte?: Date } | undefined = undefined;
    if (date) {
      dateCond = dayBounds(date);
    } else if (from || to) {
      const cond: { gte?: Date; lte?: Date } = {};
      if (from) cond.gte = new Date(`${from}T00:00:00`);
      if (to) cond.lte = new Date(`${to}T23:59:59.999`);
      dateCond = cond;
    }

    const plans = await prisma.deliveryPlan.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(dateCond ? { date: dateCond } : {}),
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { date: 'asc' },
      // Cast include as any to handle newly added relations pre-generate
      include: ({
        store: { select: { id: true, name: true, slug: true } },
        customers: { include: { customer: true } },
        items: { include: { item: { include: { category: true } }, packagingOption: true } },
      } as any),
      take: 1000,
    });

    // Ensure date is string and trim item shape
    const pList: any[] = plans as any[];
    const result = pList.map((p: any) => ({
      id: p.id,
      date: p.date.toISOString(),
      status: p.status,
      notes: p.notes ?? undefined,
      store: p.store ? { id: p.store.id, name: p.store.name, slug: p.store.slug } : undefined,
  customers: p.customers.map((pc: any) => ({ customer: { id: pc.customer.id, name: pc.customer.name, type: pc.customer.type } })),
      items: p.items.map((di: any) => ({
        id: di.id,
        quantity: di.quantity,
        note: di.note ?? undefined,
        packaging: di.packagingOption
          ? {
              id: di.packagingOption.id,
              name: di.packagingOption.name,
              type: di.packagingOption.type,
              sizeValue: di.packagingOption.sizeValue,
              sizeUnit: di.packagingOption.sizeUnit,
              variableWeight: di.packagingOption.variableWeight,
            }
          : undefined,
        weightKg: di.weightKg ?? undefined,
        item: {
          id: di.item.id,
          name: di.item.name,
          unit: di.item.unit ?? undefined,
          category: di.item.category ? { name: di.item.category.name } : null,
        },
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}
