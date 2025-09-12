import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['DRAFT', 'CONFIRMED', 'SENT'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be DRAFT, CONFIRMED, or SENT' },
        { status: 400 }
      );
    }

    const updatedDelivery = await prisma.deliveryPlan.update({
      where: { id },
      data: { status },
      include: {
        store: true,
        customers: {
          include: { customer: true },
        },
        items: {
          include: {
            item: {
              include: { category: true },
            },
          },
        },
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
