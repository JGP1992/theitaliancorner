import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';

interface StocktakeItemWithItem {
  id: string;
  itemId: string;
  quantity: number | null;
  note: string | null;
  item: {
    id: string;
    name: string;
    category: {
      id: string;
      name: string;
      sortOrder: number;
    } | null;
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to read stocktakes
    if (!AuthService.hasPermission(user, 'stocktakes:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: stocktakeId } = await params;

    const stocktake = await (prisma.stocktake.findUnique({
      where: { id: stocktakeId },
      include: {
        store: true,
        submittedBy: { select: { firstName: true, lastName: true } },
        items: {
          include: {
            item: {
              include: {
                category: true
              }
            }
          },
          orderBy: [
            { item: { category: { sortOrder: 'asc' } } },
            { item: { sortOrder: 'asc' } },
            { item: { name: 'asc' } }
          ]
        }
      } as any
    }) as any);

    if (!stocktake) {
      return NextResponse.json({ error: 'Stocktake not found' }, { status: 404 });
    }

    // Calculate totals
  const itemCount = (stocktake.items as StocktakeItemWithItem[]).filter((item: StocktakeItemWithItem) => item.quantity !== null).length;
  const totalQuantity = (stocktake.items as StocktakeItemWithItem[]).reduce((sum: number, item: StocktakeItemWithItem) => sum + (item.quantity || 0), 0);

    const formattedStocktake = {
      id: stocktake.id,
      date: stocktake.date,
      submittedAt: stocktake.submittedAt,
      submittedBy: stocktake.submittedBy ? {
        firstName: stocktake.submittedBy.firstName,
        lastName: stocktake.submittedBy.lastName,
      } : null,
      photoUrl: stocktake.photoUrl,
      notes: stocktake.notes,
      store: stocktake.store,
      items: (stocktake.items as StocktakeItemWithItem[]).map((stocktakeItem: StocktakeItemWithItem) => ({
        id: stocktakeItem.id,
        itemId: stocktakeItem.itemId,
        quantity: stocktakeItem.quantity,
        note: stocktakeItem.note,
        item: stocktakeItem.item
      })),
      itemCount,
      totalQuantity
    };

    return NextResponse.json(formattedStocktake);
  } catch (error) {
    console.error('Error fetching stocktake:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stocktake' },
      { status: 500 }
    );
  }
}
