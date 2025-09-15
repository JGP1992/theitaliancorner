import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '../../../lib/auth';

interface DeliveryItem {
  item: {
    name: string;
    unit: string | null;
  };
  quantity: number;
  packagingOption?: { id: string; name: string } | null;
  weightKg?: number | null;
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

    // Validate required fields
    if (!date || Number.isNaN(Date.parse(date))) {
      return NextResponse.json({ error: 'A valid date is required (YYYY-MM-DD).' }, { status: 400 });
    }

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

    // Get all items and packaging for reference
    const [allItems, allPackaging] = await Promise.all([
      prisma.item.findMany(),
      (prisma as any).packagingOption.findMany({ where: { isActive: true } })
    ]);

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
          const [name, qty, packagingOptionId, weight] = l.split(':');
          return {
            name: name.trim(),
            qty: parseFloat(String(qty || '').trim()),
            packagingOptionId: (packagingOptionId || '').trim() || undefined,
            weightKg: weight !== undefined && weight !== null && String(weight).trim() !== '' ? parseFloat(String(weight).trim()) : undefined,
          };
        })
        .filter((i) => Number.isFinite(i.qty));

      // Validate and map lines
      const mapped: { itemId: string; quantity: number; packagingOptionId?: string | null; weightKg?: number | null }[] = [];
      for (const i of items) {
        const match = allItems.find((x: { id: string; name: string }) => x.name.toLowerCase() === i.name.toLowerCase());
        if (!match) {
          return NextResponse.json({ error: `Unknown item '${i.name}' for ${dest.type} '${dest.name}'` }, { status: 400 });
        }
        // Quantity must be greater than 0
        if (!(Number.isFinite(i.qty) && i.qty > 0)) {
          return NextResponse.json({ error: `Quantity must be greater than 0 for '${i.name}'.` }, { status: 400 });
        }

        let packagingOptionId: string | undefined = i.packagingOptionId;
        let weightKg: number | undefined = i.weightKg;
        if (packagingOptionId) {
          const p = (allPackaging as any[]).find(po => String(po.id) === String(packagingOptionId));
          if (!p) {
            return NextResponse.json({ error: `Unknown packaging option for '${i.name}'` }, { status: 400 });
          }
          const allowed = dest.type === 'store' ? Boolean(p.allowStores) : Boolean(p.allowCustomers);
          if (!allowed) {
            return NextResponse.json({ error: `Packaging '${p.name}' is not allowed for ${dest.type} destinations` }, { status: 400 });
          }
          // If packaging has variable weight (e.g., trays), weight can be captured later at loading time.
          // Only enforce when creating a plan directly as SENT.
          if (p.variableWeight && status === 'SENT') {
            if (weightKg == null || Number.isNaN(weightKg) || weightKg <= 0) {
              return NextResponse.json({ error: `Weight (kg) is required for '${p.name}' on '${i.name}' when sending immediately. Create as Draft/Confirmed to fill weights later.` }, { status: 400 });
            }
          }
        }
        mapped.push({ itemId: match.id, quantity: i.qty, packagingOptionId: packagingOptionId ?? null, weightKg: weightKg ?? null });
      }

      if (mapped.length === 0) continue;

      // Create delivery plan for this destination
      const deliveryPlanData: {
        date: Date;
        status: 'DRAFT' | 'CONFIRMED' | 'SENT';
        items: { createMany: { data: { itemId: string; quantity: number; packagingOptionId?: string | null; weightKg?: number | null }[] } };
        storeId?: string;
        customers?: { create: { customerId: string; priority: number; notes: null }[] };
      } = {
        date: new Date(date),
        status,
        items: { createMany: { data: mapped.map(m => ({
          itemId: m.itemId,
          quantity: m.quantity,
          packagingOptionId: m.packagingOptionId || null,
          weightKg: m.weightKg ?? null,
        })) } },
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
            include: ({
              item: true,
              packagingOption: true,
            } as any)
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

    if (createdPlans.length === 0) {
      return NextResponse.json({ error: 'No valid destinations or items. Please add at least one item with a positive quantity.' }, { status: 400 });
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
        items: (plan as any).items.map((deliveryItem: any) => ({
          name: deliveryItem.item.name,
          quantity: deliveryItem.quantity,
          unit: deliveryItem.item.unit || '',
          packaging: deliveryItem.packagingOption ? { id: deliveryItem.packagingOption.id, name: deliveryItem.packagingOption.name } : undefined,
          weightKg: deliveryItem.weightKg ?? undefined,
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
