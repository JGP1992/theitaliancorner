import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

interface DeliveryPlanWhereInput {
  status?: 'DRAFT' | 'CONFIRMED' | 'SENT';
  date?: {
    gte?: Date;
    lte?: Date;
  };
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

    // Check if user has permission to read delivery plans
    if (!AuthService.hasPermission(user, 'deliveries:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    const where: DeliveryPlanWhereInput = {};

    if (status) {
      where.status = status as 'DRAFT' | 'CONFIRMED' | 'SENT';
    }

    if (date) {
      // Filter for deliveries on the specific date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const plans = await prisma.deliveryPlan.findMany({
      where,
      include: {
        store: true,
        customers: {
          include: { customer: true },
        },
        items: {
          include: { item: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to recent plans
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching delivery plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delivery plans' },
      { status: 500 }
    );
  }
}
