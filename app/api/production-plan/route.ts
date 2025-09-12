import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

interface ProductionRequirement {
  flavorName: string;
  totalTubs: number;
  deliveries: Array<{
    date: string;
    destination: string;
    quantity: number;
    status: string;
  }>;
}

interface InventoryLevel {
  itemName: string;
  category: string;
  totalQuantity: number;
  lastUpdated: string;
  stocktakes: Array<{
    store: string;
    quantity: number;
    date: string;
  }>;
}

interface FlavorRequirements {
  [key: string]: ProductionRequirement;
}

interface InventoryLevels {
  [key: string]: InventoryLevel;
}

interface StocktakeItemWithItem {
  itemId: string;
  quantity: number | null;
  item: {
    name: string;
    category: {
      name: string;
    } | null;
  };
}

interface StocktakeWithIncludes {
  submittedAt: Date;
  store: {
    name: string;
  };
  items: StocktakeItemWithItem[];
}

interface DeliveryItemWithItem {
  item: {
    name: string;
    category: {
      name: string;
    } | null;
  };
  quantity: number;
}

interface DeliveryPlanCustomerWithCustomer {
  customer: {
    name: string;
  };
}

interface DeliveryPlanWithIncludes {
  date: Date;
  status: string;
  store: {
    name: string;
  } | null;
  items: DeliveryItemWithItem[];
  customers: DeliveryPlanCustomerWithCustomer[];
}

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

    // Check if user has permission to read production plans
    if (!AuthService.hasPermission(user, 'productions:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');

    // Calculate date range
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    endDate.setHours(23, 59, 59, 999);

    // Get all confirmed and draft delivery plans within the date range
    const deliveryPlans = await prisma.deliveryPlan.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        status: {
          in: ['CONFIRMED', 'DRAFT']
        }
      },
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
        store: true,
        customers: {
          include: {
            customer: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Calculate production requirements by flavor
    const flavorRequirements: FlavorRequirements = {};

    // Get latest stocktakes for inventory levels
    const latestStocktakes = await prisma.stocktake.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 10, // Get recent stocktakes
      include: {
        store: true,
        items: {
          include: {
            item: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    // Calculate current inventory levels
    const inventoryLevels: InventoryLevels = {};

    // Process stocktakes for inventory
    latestStocktakes.forEach((stocktake: StocktakeWithIncludes) => {
      stocktake.items.forEach((stocktakeItem: StocktakeItemWithItem) => {
        const itemId = stocktakeItem.itemId;
        const itemName = stocktakeItem.item.name;
        const category = stocktakeItem.item.category?.name || 'Unknown';

        if (!inventoryLevels[itemId]) {
          inventoryLevels[itemId] = {
            itemName,
            category,
            totalQuantity: 0,
            lastUpdated: stocktake.submittedAt.toISOString(),
            stocktakes: []
          };
        }

        if (stocktakeItem.quantity) {
          inventoryLevels[itemId].stocktakes.push({
            store: stocktake.store.name,
            quantity: stocktakeItem.quantity,
            date: stocktake.submittedAt.toISOString().split('T')[0]
          });

          // Update total quantity (sum across stores)
          inventoryLevels[itemId].totalQuantity += stocktakeItem.quantity;

          // Update last updated if this is more recent
          if (new Date(stocktake.submittedAt) > new Date(inventoryLevels[itemId].lastUpdated)) {
            inventoryLevels[itemId].lastUpdated = stocktake.submittedAt.toISOString();
          }
        }
      });
    });

    // Process delivery plans for production requirements
    deliveryPlans.forEach((plan: DeliveryPlanWithIncludes) => {
      plan.items.forEach((deliveryItem: DeliveryItemWithItem) => {
        const item = deliveryItem.item;
        const category = item.category?.name;

        // Only process gelato flavors
        if (category === 'Gelato Flavors') {
          const flavorName = item.name;

          if (!flavorRequirements[flavorName]) {
            flavorRequirements[flavorName] = {
              flavorName,
              totalTubs: 0,
              deliveries: []
            };
          }

          const destination = plan.store?.name ||
            (plan.customers.length > 0
              ? plan.customers.map((pc: DeliveryPlanCustomerWithCustomer) => pc.customer.name).join(', ')
              : 'Unknown');

          flavorRequirements[flavorName].totalTubs += deliveryItem.quantity;
          flavorRequirements[flavorName].deliveries.push({
            date: plan.date.toISOString().split('T')[0],
            destination,
            quantity: deliveryItem.quantity,
            status: plan.status
          });
        }
      });
    });

    // Sort deliveries by date for each flavor
    Object.values(flavorRequirements).forEach(requirement => {
      requirement.deliveries.sort((a, b) => a.date.localeCompare(b.date));
    });

    // Convert to arrays and sort by total tubs needed
    const productionPlan = Object.values(flavorRequirements)
      .sort((a, b) => b.totalTubs - a.totalTubs);

    const inventory = Object.values(inventoryLevels)
      .sort((a, b) => a.category.localeCompare(b.category));

    return NextResponse.json({
      productionPlan,
      inventory,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      summary: {
        totalFlavors: productionPlan.length,
        totalTubs: productionPlan.reduce((sum, flavor) => sum + flavor.totalTubs, 0),
        upcomingDeliveries: deliveryPlans.length
      }
    });

  } catch (error) {
    console.error('Error fetching production plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch production plan' },
      { status: 500 }
    );
  }
}
