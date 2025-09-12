import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '../../../lib/auth';

interface DeliveryItem {
  item: {
    name: string;
    unit: string | null;
  };
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create delivery plans
    if (!AuthService.hasPermission(user, 'deliveries:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();

    const storeSlugs = formData.getAll('stores') as string[];
    const date = String(formData.get('date'));
    const rawStatus = String(formData.get('status'));
    const status = (['DRAFT','CONFIRMED','SENT'].includes(rawStatus) ? rawStatus : 'DRAFT') as 'DRAFT'|'CONFIRMED'|'SENT';
    const customerIds = formData.getAll('customers') as string[];

    // Find stores if provided
    const stores = [];
    if (storeSlugs.length > 0) {
      const foundStores = await prisma.store.findMany({
        where: { slug: { in: storeSlugs } }
      });
      stores.push(...foundStores);
    }

    // Find customers if provided
    const customers = [];
    if (customerIds.length > 0) {
      const foundCustomers = await prisma.customer.findMany({
        where: { id: { in: customerIds } }
      });
      customers.push(...foundCustomers);
    }

    if (stores.length === 0 && customers.length === 0) {
      return NextResponse.json({ error: 'No destinations selected' }, { status: 400 });
    }

    // Get all items for reference
    const allItems = await prisma.item.findMany();

    // Process each destination (store or customer)
    const destinations = [
      ...stores.map(store => ({ type: 'store' as const, id: store.id, slug: store.slug, name: store.name })),
      ...customers.map(customer => ({ type: 'customer' as const, id: customer.id, name: customer.name }))
    ];

    const createdPlans = [];

    for (const dest of destinations) {
      // Get items for this specific destination
      const itemsKey = `items_${dest.type}_${dest.type === 'store' ? dest.slug : dest.id}`;
      const lines = String(formData.get(itemsKey) || '');

      if (!lines.trim()) continue; // Skip if no items specified

      const items = lines
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [name, qty] = l.split(':');
          return { name: name.trim(), qty: parseFloat(String(qty || '').trim()) };
        })
        .filter((i) => Number.isFinite(i.qty));

      const mapped = items
        .map((i) => {
          const match = allItems.find((x: { id: string; name: string }) => x.name.toLowerCase() === i.name.toLowerCase());
          return match ? { itemId: match.id, quantity: i.qty } : null;
        })
        .filter(Boolean) as { itemId: string; quantity: number }[];

      if (mapped.length === 0) continue;

      // Create delivery plan for this destination
      const deliveryPlanData: {
        date: Date;
        status: 'DRAFT' | 'CONFIRMED' | 'SENT';
        items: { createMany: { data: { itemId: string; quantity: number }[] } };
        storeId?: string;
        customers?: { create: { customerId: string; priority: number; notes: null }[] };
      } = {
        date: new Date(date),
        status,
        items: { createMany: { data: mapped } },
      };

      if (dest.type === 'store') {
        deliveryPlanData.storeId = dest.id;
      } else {
        // For customers, we still need to link them via the junction table
        deliveryPlanData.customers = {
          create: [{
            customerId: dest.id,
            priority: 1,
            notes: null
          }]
        };
      }

      const plan = await prisma.deliveryPlan.create({
        data: deliveryPlanData,
        include: {
          items: {
            include: {
              item: true
            }
          },
          store: true,
          customers: {
            include: {
              customer: true
            }
          }
        }
      });

      createdPlans.push(plan);
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdPlans.length} delivery plan(s) with ${createdPlans.reduce((total, plan) => total + plan.items.length, 0)} items`,
      plans: createdPlans.map((plan) => ({
        id: plan.id,
        destination: plan.store?.name || plan.customers.map((pc: { customer: { name: string } }) => pc.customer.name).join(', ') || 'Unknown',
        date: plan.date,
        status: plan.status,
        itemCount: plan.items.length,
        items: plan.items.map((deliveryItem: DeliveryItem) => ({
          name: deliveryItem.item.name,
          quantity: deliveryItem.quantity,
          unit: deliveryItem.item.unit || ''
        }))
      }))
    });

  } catch (error) {
    console.error('Error creating delivery plans:', error);
    return NextResponse.json(
      { error: 'Failed to create delivery plans' },
      { status: 500 }
    );
  }
}
