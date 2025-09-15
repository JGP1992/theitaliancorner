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

  // Allow access if user can read stores OR has deliveries permissions (for planning UIs)
  const canReadStores = AuthService.hasPermission(user, 'stores:read');
  const canUseDeliveries = AuthService.hasAnyPermission(user, ['deliveries:read', 'deliveries:create']);
  if (!canReadStores && !canUseDeliveries) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}
