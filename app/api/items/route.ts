import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

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

  // Allow if user has recipes:read OR stores:read OR deliveries permissions (used by delivery UIs)
  const canReadItems = AuthService.hasPermission(user, 'recipes:read') || AuthService.hasPermission(user, 'stores:read');
  const canUseDeliveries = AuthService.hasAnyPermission(user, ['deliveries:read', 'deliveries:create']);
  if (!canReadItems && !canUseDeliveries) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const items = await prisma.item.findMany({
      include: {
        category: true
      },
      where: { isActive: true },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
