import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

type UpdateDeliveryItem = {
  itemId: string;
  quantity: number;
  note?: string | null;
};

type UpdateDeliveryPlanRequest = {
  id: string;
  items?: UpdateDeliveryItem[];
  status?: 'DRAFT' | 'CONFIRMED' | 'SENT';
  notes?: string | null;
};

export async function PUT(req: NextRequest) {
  try {
    const { id, items, status, notes }: UpdateDeliveryPlanRequest = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Delivery plan ID is required' }, { status: 400 });
    }

    // Start a transaction to update the delivery plan and its items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedPlan = await prisma.$transaction(async (tx: any) => {
      // Update the delivery plan status and notes if provided
      const updateData: Record<string, unknown> = {};
      if (status && ['DRAFT', 'CONFIRMED', 'SENT'].includes(status)) {
        updateData.status = status;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.deliveryPlan.update({
          where: { id },
          data: updateData,
        });
      }

      // If items are provided, update them
      if (items && Array.isArray(items)) {
        // Delete existing items
        await tx.deliveryItem.deleteMany({
          where: { planId: id },
        });

        // Create new items
        if (items.length > 0) {
          await tx.deliveryItem.createMany({
            data: items.map((item: UpdateDeliveryItem) => ({
              planId: id,
              itemId: item.itemId,
              quantity: item.quantity,
              note: item.note || null,
            })),
          });
        }
      }

      // Return the updated plan with all related data
      return tx.deliveryPlan.findUnique({
        where: { id },
        include: {
          store: true,
          customers: {
            include: { customer: true },
          },
          items: {
            include: { item: true },
          },
        },
      });
    });

    if (!updatedPlan) {
      return NextResponse.json({ error: 'Delivery plan not found' }, { status: 404 });
    }

    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error('Error updating delivery plan:', error);
    return NextResponse.json({ error: 'Failed to update delivery plan' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Delivery plan ID is required' }, { status: 400 });
    }

    // Delete the delivery plan (cascade will handle related items and customer links)
    await prisma.deliveryPlan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Delivery plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting delivery plan:', error);
    return NextResponse.json({ error: 'Failed to delete delivery plan' }, { status: 500 });
  }
}
