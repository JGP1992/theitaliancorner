import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

interface ReceivedItem {
  itemId: string;
  receivedQuantity: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { receivedItems }: { receivedItems: ReceivedItem[] } = body;
    const { id } = await params;

    if (!receivedItems || !Array.isArray(receivedItems)) {
      return NextResponse.json(
        { error: 'Received items are required' },
        { status: 400 }
      );
    }

    // Get the order with its items
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: {
              include: {
                category: true
              }
            }
          }
        },
        supplier: true
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Order has already been received' },
        { status: 400 }
      );
    }

    // Update order status and received date
    await prisma.order.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedDate: new Date()
      }
    });

    // Create a stocktake entry for the received items
    // We'll use a default store for factory stocktakes - you might want to make this configurable
    const stores = await prisma.store.findMany({ take: 1 });
    if (stores.length === 0) {
      return NextResponse.json(
        { error: 'No stores found - please create a store first' },
        { status: 400 }
      );
    }

    const factoryStore = stores[0]; // Use the first store as factory

    // Create stocktake with received quantities
    await prisma.stocktake.create({
      data: {
        storeId: factoryStore.id,
        date: new Date(),
        notes: `Stock receipt for order ${order.id} from ${order.supplier?.name || 'Unknown Supplier'}`,
        items: {
          create: receivedItems.map((receivedItem: ReceivedItem) => ({
            itemId: receivedItem.itemId,
            quantity: receivedItem.receivedQuantity,
            note: `Received from order ${order.id}`
          }))
        }
      }
    });

    return NextResponse.json({
      message: 'Stock receipt recorded successfully',
      orderId: id
    });

  } catch (error) {
    console.error('Failed to record stock receipt:', error);
    return NextResponse.json(
      { error: 'Failed to record stock receipt' },
      { status: 500 }
    );
  }
}
