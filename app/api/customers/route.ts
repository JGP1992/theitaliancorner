import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
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

  // Allow access if user can read customers OR has deliveries permissions (for planning UIs)
  const canReadCustomers = AuthService.hasPermission(user, 'customers:read');
  const canUseDeliveries = AuthService.hasAnyPermission(user, ['deliveries:read', 'deliveries:create']);
  if (!canReadCustomers && !canUseDeliveries) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AuthService.hasPermission(user, 'customers:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, address, phone, email, contactName } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        type: type || 'restaurant',
        address: address || null,
        phone: phone || null,
        email: email || null,
        contactName: contactName || null,
        isActive: true,
      }
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AuthService.hasPermission(user, 'customers:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, type, address, phone, email, contactName, isActive } = body;

    if (!id) return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        type: type ?? existing.type,
        address: address !== undefined ? address : existing.address,
        phone: phone !== undefined ? phone : existing.phone,
        email: email !== undefined ? email : existing.email,
        contactName: contactName !== undefined ? contactName : existing.contactName,
        isActive: typeof isActive === 'boolean' ? isActive : existing.isActive,
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AuthService.hasPermission(user, 'customers:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Check for linked delivery plans (optional informational check only)
    const linkedPlans = await prisma.deliveryPlanCustomer.count({ where: { customerId: id } });
    if (linkedPlans > 0) {
      // We still soft delete, but warn client so they understand historical linkage remains
      console.log(`Soft deleting customer ${id} still linked to ${linkedPlans} delivery plan(s)`);
    }

    await prisma.customer.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
