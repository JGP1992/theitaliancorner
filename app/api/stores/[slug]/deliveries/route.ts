import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

interface DeliveryItemWithItem {
  item: {
    id: string;
    name: string;
    unit: string | null;
    category: {
      name: string;
    } | null;
  };
  quantity: number;
}

interface DeliveryPlanWithItems {
  id: string;
  date: Date;
  status: string;
  items: DeliveryItemWithItem[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // Find the store by slug
    const store = await prisma.store.findUnique({
      where: { slug }
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Get ALL deliveries for this store
    const deliveries = await prisma.deliveryPlan.findMany({
      where: {
        storeId: store.id,
        status: { in: ['CONFIRMED', 'SENT'] }
      },
      include: {
        items: {
          include: {
            item: {
              include: { category: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 100, // Get all deliveries, not just recent
    });

    // Extract gelato flavors from deliveries
    const gelatoDeliveries = deliveries.map((delivery: DeliveryPlanWithItems) => ({
      id: delivery.id,
      date: delivery.date,
      status: delivery.status,
      flavors: delivery.items
        .filter((item: DeliveryItemWithItem) => item.item.category?.name === 'Gelato Flavors')
        .map((item: DeliveryItemWithItem) => ({
          id: item.item.id,
          name: item.item.name,
          quantity: item.quantity,
          unit: item.item.unit || 'tubs'
        }))
    }));

    return NextResponse.json({
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug
      },
      deliveries: gelatoDeliveries
    });

  } catch (error) {
    console.error('Error fetching store deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}
