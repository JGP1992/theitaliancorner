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

  // Allow access if user can read customers OR has deliveries permissions (for planning UIs)
  const canReadCustomers = AuthService.hasPermission(user, 'customers:read');
  const canUseDeliveries = AuthService.hasAnyPermission(user, ['deliveries:read', 'deliveries:create']);
  if (!canReadCustomers && !canUseDeliveries) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}
