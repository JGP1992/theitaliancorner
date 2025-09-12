import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../app/lib/prisma';
import { AuthService } from '../../../../../lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to read stores
    if (!AuthService.hasPermission(user, 'stores:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { slug } = await params;

    // Get store by slug
    const store = await prisma.store.findUnique({
      where: { slug: slug },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get store inventory with item details
    const inventory = await prisma.storeInventory.findMany({
      where: {
        storeId: store.id,
        isActive: true,
      },
      include: {
        item: {
          include: {
            category: true,
          },
        },
      },
      orderBy: [
        { item: { category: { sortOrder: 'asc' } } },
        { item: { sortOrder: 'asc' } },
      ],
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('Error fetching store inventory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage store inventory
    if (!AuthService.hasPermission(user, 'stores:manage_inventory')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { slug } = await params;
    const { itemId, targetQuantity, targetText, unit } = await req.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Get store by slug
    const store = await prisma.store.findUnique({
      where: { slug: slug },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verify item exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Create or update store inventory item
    const inventoryItem = await prisma.storeInventory.upsert({
      where: {
        storeId_itemId: {
          storeId: store.id,
          itemId: itemId,
        },
      },
      update: {
        targetQuantity: targetQuantity,
        targetText: targetText,
        unit: unit,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        storeId: store.id,
        itemId: itemId,
        targetQuantity: targetQuantity,
        targetText: targetText,
        unit: unit,
      },
      include: {
        item: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json({ inventoryItem });
  } catch (error) {
    console.error('Error updating store inventory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage store inventory
    if (!AuthService.hasPermission(user, 'stores:manage_inventory')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { slug } = await params;
    const { itemId } = await req.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Get store by slug
    const store = await prisma.store.findUnique({
      where: { slug: slug },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Soft delete by setting isActive to false
    const inventoryItem = await prisma.storeInventory.updateMany({
      where: {
        storeId: store.id,
        itemId: itemId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting store inventory item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
