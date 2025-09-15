import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth
    const token = request.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'deliveries:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

  const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['DRAFT', 'CONFIRMED', 'SENT'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be DRAFT, CONFIRMED, or SENT' },
        { status: 400 }
      );
    }

    // If moving to SENT, enforce that all variable-weight items have weights
    if (status === 'SENT') {
      const plan = await prisma.deliveryPlan.findUnique({
        where: { id },
        include: {
          items: { include: { packagingOption: true, item: { include: { category: true } } } },
          store: true,
          customers: { include: { customer: true } },
        },
      });
      if (!plan) return NextResponse.json({ error: 'Delivery plan not found' }, { status: 404 });
      const missing = plan.items.filter(di => di.packagingOption?.variableWeight && (!di.weightKg || di.weightKg <= 0));
      if (missing.length > 0) {
        const names = missing.map(m => `${m.item.name} (${m.packagingOption?.name})`).join(', ');
        return NextResponse.json({ error: `Weight (kg) required before dispatch for: ${names}` }, { status: 400 });
      }
    }

    const updatedDelivery = await prisma.deliveryPlan.update({
      where: { id },
      data: { status },
      include: {
        store: true,
        customers: { include: { customer: true } },
        items: { include: { item: { include: { category: true } } } },
      },
    });

    return NextResponse.json(updatedDelivery);
  } catch (error) {
    console.error('Error updating delivery plan:', error);
    return NextResponse.json(
      { error: 'Failed to update delivery plan' },
      { status: 500 }
    );
  }
}
