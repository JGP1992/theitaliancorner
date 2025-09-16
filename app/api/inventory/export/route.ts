import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return new NextResponse('Unauthorized', { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return new NextResponse('Unauthorized', { status: 401 });
    if (!AuthService.hasPermission(user, 'stocktakes:read')) return new NextResponse('Forbidden', { status: 403 });

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : new Date();
    if (!fromParam) from.setHours(0,0,0,0);
    const to = toParam ? new Date(toParam) : new Date(from.getTime());
    to.setHours(23,59,59,999);

    // Fetch items
    const items = await prisma.item.findMany({ where: { isActive: true }, include: { category: true }, orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] });

    // Master baseline snapshot (if any)
    const factoryStore = await prisma.store.findUnique({ where: { slug: 'factory' } });
    let masterMap: Record<string, number> = {};
    if (factoryStore) {
      const master = await prisma.stocktake.findFirst({ where: ({ storeId: factoryStore.id, isMaster: true } as any), include: { items: true }, orderBy: { date: 'desc' } });
      if (master) for (const sti of (master as any).items) masterMap[sti.itemId] = typeof sti.quantity === 'number' ? sti.quantity : 0;
    }

    // Movements in range
    const [orders, deliveries, productions] = await Promise.all([
      prisma.order.findMany({ where: { status: { in: ['PENDING','CONFIRMED'] }, expectedDate: { gte: from, lte: to } }, include: { items: true } }),
      prisma.deliveryPlan.findMany({ where: { status: 'CONFIRMED', date: { gte: from, lte: to } }, include: { items: true } }),
      prisma.production.findMany({ where: { producedAt: { gte: from, lte: to }, ingredients: { some: {} } }, include: { ingredients: true } })
    ]);

    const lines: string[] = [];
    const esc = (v: any) => {
      if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
    };
    lines.push(['Item','Category','Baseline','Incoming','Outgoing','Production','Net Movement','Derived Current','Unit','Target','Status','From','To'].map(esc).join(','));

    for (const item of items) {
      const baseline = masterMap[item.id] || 0;
      const incoming = orders.flatMap(o=>o.items).filter(i=>i.itemId===item.id).reduce((s,i)=>s+i.quantity,0);
      const outgoing = deliveries.flatMap(d=>d.items).filter(i=>i.itemId===item.id).reduce((s,i)=>s+i.quantity,0);
      const production = productions.flatMap(p=>p.ingredients).filter(i=>i.itemId===item.id).reduce((s,i)=>s+i.quantityUsed,0);
      const netMovement = incoming - outgoing + production;
      const derivedCurrent = baseline + netMovement;
      let status: string = 'normal';
      const target = item.targetNumber || 10;
      if (derivedCurrent === 0) status = 'critical'; else if (derivedCurrent < target*0.25) status='critical'; else if (derivedCurrent < target*0.5) status='low'; else if (derivedCurrent > target*2) status='high';
      lines.push([
        item.name,
        item.category.name,
        baseline,
        incoming,
        outgoing,
        production,
        netMovement,
        derivedCurrent,
        item.unit || 'units',
        target,
        status,
        from.toISOString().slice(0,10),
        to.toISOString().slice(0,10)
      ].map(esc).join(','));
    }

    const body = lines.join('\n');
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=inventory_export_${from.toISOString().slice(0,10)}_${to.toISOString().slice(0,10)}.csv`
      }
    });
  } catch (e) {
    console.error('Export error', e);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
