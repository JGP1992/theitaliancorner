import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

interface StocktakeWhere {
  submittedAt?: {
    gte?: Date;
    lte?: Date;
  };
  storeId?: string;
}

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const before = searchParams.get('before');
    const storeId = searchParams.get('storeId');

    const where: StocktakeWhere = {};
    if (after) {
      try {
        where.submittedAt = { gte: new Date(after) };
      } catch {
        console.error('Invalid after date:', after);
        return NextResponse.json({ error: 'Invalid after date format' }, { status: 400 });
      }
    }
    if (before) {
      try {
        where.submittedAt = { ...where.submittedAt, lte: new Date(before) };
      } catch {
        console.error('Invalid before date:', before);
        return NextResponse.json({ error: 'Invalid before date format' }, { status: 400 });
      }
    }
    if (storeId) {
      where.storeId = storeId;
    }

    const stocktakes = await prisma.stocktake.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: { store: true, items: { include: { item: true } } },
      take: 100,
    });

    // Transform the data for the frontend
    const transformedStocktakes = stocktakes.map((stocktake: {
      id: string;
      date: Date;
      store: { id: string; name: string; slug: string };
      submittedAt: Date;
      items: { quantity: number | null }[]
    }) => ({
      id: stocktake.id,
      date: stocktake.date,
      store: {
        id: stocktake.store.id,
        name: stocktake.store.name,
        slug: stocktake.store.slug
      },
      submittedAt: stocktake.submittedAt,
      itemCount: stocktake.items.length,
      totalQuantity: stocktake.items.reduce((sum: number, item: { quantity: number | null }) => sum + (item.quantity || 0), 0)
    }));

    return NextResponse.json({ stocktakes: transformedStocktakes });
  } catch (error) {
    console.error('Error fetching stocktakes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stocktakes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create stocktakes
    if (!AuthService.hasPermission(user, 'stocktakes:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const apiKey = req.headers.get('x-api-key') ?? undefined;
    const body = await req.json();
    const { storeSlug, date, photoUrl, items, notes }: {
      storeSlug: string;
      date: string;
      photoUrl?: string;
      notes?: string;
      items: { itemId: string; quantity?: number; note?: string }[];
    } = body;

    if (!storeSlug || !date || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (store.apiKey && apiKey && apiKey !== store.apiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const created = await prisma.stocktake.create({
      data: {
        storeId: store.id,
        date: new Date(date),
        photoUrl,
        notes,
        items: {
          createMany: {
            data: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity ?? null, note: i.note })),
          },
        },
      },
      include: { items: true },
    });
    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating stocktake:', error);
    return NextResponse.json(
      { error: 'Failed to create stocktake' },
      { status: 500 }
    );
  }
}
