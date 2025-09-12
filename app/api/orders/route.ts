import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

interface OrderItemInput {
  itemId: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
}

interface OrderData {
  supplierId?: string;
  items: {
    create: OrderItemInput[];
  };
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

    // Check if user has permission to read orders
    if (!AuthService.hasPermission(user, 'orders:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orders = await prisma.order.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            item: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: { orderDate: 'desc' }
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
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

    // Check if user has permission to create orders
    if (!AuthService.hasPermission(user, 'orders:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { supplierId, items }: {
      supplierId?: string;
      items: OrderItemInput[];
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    const orderData: OrderData = {
      items: {
        create: items.map((item: OrderItemInput) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice
        }))
      }
    };

    // Only include supplierId if provided
    if (supplierId) {
      orderData.supplierId = supplierId;
    }

    const order = await prisma.order.create({
      data: orderData,
      include: {
        supplier: true,
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

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Failed to create order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
