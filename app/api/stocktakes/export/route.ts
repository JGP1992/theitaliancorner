import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';
import ExcelJS from 'exceljs';

type StocktakeWhere = {
  submittedAt?: {
    gte?: Date;
    lte?: Date;
  };
  storeId?: string;
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'stocktakes:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const before = searchParams.get('before');
    const storeId = searchParams.get('storeId');

  const where: StocktakeWhere = {};
  if (after) where.submittedAt = { ...(where.submittedAt || {}), gte: new Date(after) };
  if (before) where.submittedAt = { ...(where.submittedAt || {}), lte: new Date(before) };
  if (storeId) where.storeId = storeId;

    const stocktakes = await prisma.stocktake.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: ({
        store: true,
        submittedBy: { select: { firstName: true, lastName: true } },
        items: { include: { item: { include: { category: true } } } },
      } as any),
      take: 2000,
    }) as any[];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stocktake App';
    const ws = wb.addWorksheet('Stocktakes');

    ws.columns = [
      { header: 'Store', key: 'store', width: 22 },
      { header: 'Submitted At', key: 'submittedAt', width: 22 },
      { header: 'Submitted By', key: 'submittedBy', width: 24 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Item', key: 'item', width: 28 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Stocktake ID', key: 'id', width: 20 },
    ];

  for (const st of stocktakes) {
      for (const si of st.items) {
        ws.addRow({
          store: st.store?.name,
          submittedAt: st.submittedAt ? new Date(st.submittedAt).toISOString() : '',
          submittedBy: st.submittedBy ? `${st.submittedBy.firstName} ${st.submittedBy.lastName}` : '',
          date: st.date ? new Date(st.date).toISOString().slice(0, 10) : '',
          item: si.item?.name,
          category: si.item?.category?.name,
          quantity: si.quantity ?? '',
          unit: si.item?.unit ?? '',
          notes: st.notes ?? '',
          id: st.id,
        });
      }
    }

    // Format header row
  const header = ws.getRow(1);
  header.font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stocktakes_${Date.now()}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Export failed', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
