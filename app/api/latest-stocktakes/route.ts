import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
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

    const stocktakes = await prisma.stocktake.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 6, // Show only the 6 most recent stocktakes
      include: {
        store: true,
        items: {
          include: { item: true },
          where: { quantity: { not: null } }
        }
      },
    });
    return NextResponse.json(stocktakes);
  } catch (error) {
    console.error('Error fetching latest stocktakes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest stocktakes' },
      { status: 500 }
    );
  }
}
