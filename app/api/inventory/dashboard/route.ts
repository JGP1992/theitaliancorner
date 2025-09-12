import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';

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

    // Check if user has permission to read inventory
    if (!AuthService.hasPermission(user, 'stocktakes:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all items with their categories
    const items = await prisma.item.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' }
      ]
    });

    // Get current stock levels from latest stocktakes
    const latestStocktakes = await prisma.stocktake.findMany({
      include: {
        items: {
          include: { item: true }
        },
        store: true
      },
      orderBy: { date: 'desc' },
      take: 50 // Get recent stocktakes
    });

    // Get incoming supplies (pending orders)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const incomingOrders = await prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        expectedDate: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        items: {
          include: { item: true }
        }
      }
    });

    // Get outgoing deliveries (confirmed delivery plans for today)
    const outgoingDeliveries = await prisma.deliveryPlan.findMany({
      where: {
        status: 'CONFIRMED',
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        items: {
          include: { item: true }
        }
      }
    });

    // Get production usage for today
    const todaysProductions = await prisma.production.findMany({
      where: {
        producedAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        ingredients: {
          include: { item: true }
        }
      }
    });

    // Calculate inventory data for each item
    const inventoryData = items.map((item: { id: string; name: string; category: { name: string }; targetNumber: number | null; unit: string | null }) => {
      // Get current stock from latest stocktake
      const latestStocktakeItem = latestStocktakes
        .flatMap((st: { items: { itemId: string; quantity: number | null }[] }) => st.items)
        .find((sti: { itemId: string; quantity: number | null }) => sti.itemId === item.id);

      const currentStock = latestStocktakeItem?.quantity || 0;

      // Calculate incoming quantity
      const incomingQuantity = incomingOrders
        .flatMap((order: { items: { itemId: string; quantity: number }[] }) => order.items)
        .filter((orderItem: { itemId: string; quantity: number }) => orderItem.itemId === item.id)
        .reduce((sum: number, orderItem: { itemId: string; quantity: number }) => sum + orderItem.quantity, 0);

      // Calculate outgoing quantity
      const outgoingQuantity = outgoingDeliveries
        .flatMap((delivery: { items: { itemId: string; quantity: number }[] }) => delivery.items)
        .filter((deliveryItem: { itemId: string; quantity: number }) => deliveryItem.itemId === item.id)
        .reduce((sum: number, deliveryItem: { itemId: string; quantity: number }) => sum + deliveryItem.quantity, 0);

      // Calculate production usage
      const productionUsage = todaysProductions
        .flatMap((production: { ingredients: { itemId: string; quantityUsed: number }[] }) => production.ingredients)
        .filter((ingredient: { itemId: string; quantityUsed: number }) => ingredient.itemId === item.id)
        .reduce((sum: number, ingredient: { itemId: string; quantityUsed: number }) => sum + ingredient.quantityUsed, 0);

      // Determine status based on current stock vs target
      let status: 'low' | 'normal' | 'high' | 'critical' = 'normal';
      const targetStock = item.targetNumber || 10; // Default target if not set

      if (currentStock === 0) {
        status = 'critical';
      } else if (currentStock < targetStock * 0.25) {
        status = 'critical';
      } else if (currentStock < targetStock * 0.5) {
        status = 'low';
      } else if (currentStock > targetStock * 2) {
        status = 'high';
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category.name,
        currentStock,
        unit: item.unit || 'units',
        incoming: incomingQuantity,
        outgoing: outgoingQuantity,
        production: productionUsage,
        targetStock,
        status
      };
    });

    // Calculate summary statistics
    const summary = {
      totalItems: inventoryData.length,
      lowStockItems: inventoryData.filter((item: { status: string }) => item.status === 'low').length,
      outOfStockItems: inventoryData.filter((item: { status: string }) => item.status === 'critical').length,
      incomingToday: inventoryData.reduce((sum: number, item: { incoming: number }) => sum + item.incoming, 0),
      outgoingToday: inventoryData.reduce((sum: number, item: { outgoing: number }) => sum + item.outgoing, 0),
      productionToday: inventoryData.reduce((sum: number, item: { production: number }) => sum + item.production, 0)
    };

    return NextResponse.json({
      inventory: inventoryData,
      summary
    });
  } catch (error) {
    console.error('Error fetching inventory dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
