import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '../../../lib/auth';

interface StocktakeWithItems {
  id: string;
  submittedAt: Date;
  items: Array<{
    quantity: number | null;
    item: {
      name: string;
      category?: { name: string } | null;
    };
  }>;
}

interface DeliveryPlanWithDetails {
  id: string;
  date: Date;
  status: string;
  store?: { name: string } | null;
  customers: Array<{
    customer: { name: string };
  }>;
  items: Array<{
    quantity: number;
    item: {
      name: string;
      category?: { name: string } | null;
    };
  }>;
}

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

    // Check if user has permission to read analytics
    if (!AuthService.hasPermission(user, 'analytics:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all data in parallel for better performance
    const [
      totalStocktakes,
      allStocktakes,
      allDeliveryPlans,
      allStores,
      allCustomers
    ] = await Promise.all([
      prisma.stocktake.count(),
      prisma.stocktake.findMany({
        include: { items: { include: { item: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 100
      }),
      prisma.deliveryPlan.findMany({
        include: {
          store: true,
          customers: { include: { customer: true } },
          items: { include: { item: true } }
        }
      }),
      prisma.store.findMany(),
      prisma.customer.findMany({ where: { isActive: true } })
    ]);

    // Calculate weekly stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stocktakesThisWeek = allStocktakes.filter((st: StocktakeWithItems) =>
      new Date(st.submittedAt) >= weekAgo
    ).length;

    const deliveriesThisWeek = allDeliveryPlans.filter((dp: DeliveryPlanWithDetails) =>
      new Date(dp.date) >= weekAgo
    ).length;

    const avgItemsPerStocktake = allStocktakes.length > 0
      ? Math.round(allStocktakes.reduce((sum: number, st: StocktakeWithItems) => sum + st.items.length, 0) / allStocktakes.length)
      : 0;

    // Calculate top items
    const itemCounts: Record<string, { name: string; totalQuantity: number; category: string }> = {};
    allStocktakes.forEach((stocktake: StocktakeWithItems) => {
      stocktake.items.forEach((stocktakeItem) => {
        if (stocktakeItem.quantity && stocktakeItem.quantity > 0) {
          const key = stocktakeItem.item.name;
          if (!itemCounts[key]) {
            itemCounts[key] = {
              name: stocktakeItem.item.name,
              totalQuantity: 0,
              category: stocktakeItem.item.category?.name || 'Unknown'
            };
          }
          itemCounts[key].totalQuantity += stocktakeItem.quantity;
        }
      });
    });

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    // Delivery status breakdown
    const statusCounts = allDeliveryPlans.reduce((acc: Record<string, number>, plan: DeliveryPlanWithDetails) => {
      acc[plan.status] = (acc[plan.status] || 0) + 1;
      return acc;
    }, {});

    const deliveryStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count: count as number,
      percentage: allDeliveryPlans.length > 0 ? Math.round((count as number / allDeliveryPlans.length) * 100) : 0
    }));

    // Today's deliveries
    const today = new Date().toISOString().slice(0, 10);
    const todaysDeliveries = allDeliveryPlans.filter((plan: DeliveryPlanWithDetails) =>
      plan.date.toISOString().startsWith(today)
    );

    return NextResponse.json({
      summary: {
        totalStocktakes,
        activeStores: allStores.length,
        totalCustomers: allCustomers.length,
        pendingDeliveries: allDeliveryPlans.filter((p: DeliveryPlanWithDetails) => p.status === 'DRAFT').length,
        todaysDeliveries: todaysDeliveries.length
      },
      weeklyStats: {
        stocktakesThisWeek,
        deliveriesThisWeek,
        avgItemsPerStocktake
      },
      topItems,
      deliveryStatusBreakdown,
      todaysDeliveries,
      recentActivity: {
        latestStocktakes: allStocktakes.slice(0, 6),
        recentDeliveries: allDeliveryPlans.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
