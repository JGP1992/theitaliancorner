import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '../../../lib/auth';

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

    // Check if user has permission to read flavors
    if (!AuthService.hasPermission(user, 'flavors:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const flavors = await prisma.item.findMany({
      where: {
        category: { name: 'Gelato Flavors' },
        isActive: true
      },
      include: { category: true },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json(flavors);
  } catch (error) {
    console.error('Error fetching flavors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flavors' },
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

    // Check if user has permission to create flavors
    if (!AuthService.hasPermission(user, 'flavors:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

  const body = await request.json();
  const { name, unit, sortOrder } = body;

    // Get or create the Gelato Flavors category
    let category = await prisma.category.findFirst({
      where: { name: 'Gelato Flavors' }
    });

    if (!category) {
      category = await prisma.category.create({
        data: { name: 'Gelato Flavors' }
      });
    }

    const flavor = await prisma.item.create({
      data: {
        name,
        unit,
        sortOrder: sortOrder || 0,
        isActive: true,
        categoryId: category.id
      },
      include: { category: true }
    });

    return NextResponse.json(flavor, { status: 201 });
  } catch (error) {
    console.error('Error creating flavor:', error);
    return NextResponse.json(
      { error: 'Failed to create flavor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to update flavors
    if (!AuthService.hasPermission(user, 'flavors:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

  const body = await request.json();
  const { id, name, unit, sortOrder, isActive } = body;

    const flavor = await prisma.item.update({
      where: { id },
      data: {
        name,
        unit,
        sortOrder,
        isActive
      },
      include: { category: true }
    });

    return NextResponse.json(flavor);
  } catch (error) {
    console.error('Error updating flavor:', error);
    return NextResponse.json(
      { error: 'Failed to update flavor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to delete flavors
    if (!AuthService.hasPermission(user, 'flavors:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Flavor ID is required' },
        { status: 400 }
      );
    }

    await prisma.item.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flavor:', error);
    return NextResponse.json(
      { error: 'Failed to delete flavor' },
      { status: 500 }
    );
  }
}
