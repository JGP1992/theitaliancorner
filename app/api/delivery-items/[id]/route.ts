import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth
    const token = request.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'deliveries:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { weightKg } = body as { weightKg?: number | null };

    if (weightKg != null) {
      const n = Number(weightKg);
      if (Number.isNaN(n) || n <= 0) {
        return NextResponse.json({ error: 'weightKg must be a positive number' }, { status: 400 });
      }
    }

    // Ensure item exists
    const item = await prisma.deliveryItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'Delivery item not found' }, { status: 404 });

    const updated = await prisma.deliveryItem.update({
      where: { id },
      data: { weightKg: weightKg == null ? null : Number(weightKg) },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error updating delivery item weight:', error);
    return NextResponse.json({ error: 'Failed to update delivery item' }, { status: 500 });
  }
}
