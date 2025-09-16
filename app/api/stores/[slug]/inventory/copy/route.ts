import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { AuthService } from '../../../../../../lib/auth';
import { logAudit } from '../../../../../../lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AuthService.hasPermission(user, 'stores:manage_inventory')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { slug } = await params;
    const { fromStoreSlug, replace } = await req.json();
    if (!fromStoreSlug) {
      return NextResponse.json({ error: 'fromStoreSlug is required' }, { status: 400 });
    }

    const destStore = await prisma.store.findUnique({ where: { slug } });
    if (!destStore) return NextResponse.json({ error: 'Destination store not found' }, { status: 404 });

    const srcStore = await prisma.store.findUnique({ where: { slug: fromStoreSlug } });
    if (!srcStore) return NextResponse.json({ error: 'Source store not found' }, { status: 404 });

    // Source active inventory
    const srcInventory = await prisma.storeInventory.findMany({
      where: { storeId: srcStore.id, isActive: true },
      include: { item: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Optionally deactivate destination items first
    if (replace) {
      await prisma.storeInventory.updateMany({
        where: { storeId: destStore.id },
        data: { isActive: false, updatedAt: new Date() },
      });
    }

    let upserts = 0;
    for (const si of srcInventory) {
      await prisma.storeInventory.upsert({
        where: { storeId_itemId: { storeId: destStore.id, itemId: si.itemId } },
        update: {
          targetQuantity: si.targetQuantity ?? null,
          targetText: si.targetText ?? null,
          unit: si.unit ?? si.item.unit ?? null,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          storeId: destStore.id,
          itemId: si.itemId,
          targetQuantity: si.targetQuantity ?? null,
          targetText: si.targetText ?? null,
          unit: si.unit ?? si.item.unit ?? null,
          isActive: true,
        },
      });
      upserts++;
    }

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'copy',
      resource: 'storeInventory',
      resourceId: destStore.id,
      metadata: { fromStoreSlug, toStoreSlug: slug, replace: !!replace, count: upserts },
      ip: req.headers.get('x-forwarded-for') || (req as any).ip || null,
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true, copied: upserts, replace: !!replace });
  } catch (error) {
    console.error('Error copying store inventory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
