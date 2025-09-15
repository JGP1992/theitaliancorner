import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'deliveries:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const audience = searchParams.get('audience'); // 'store' | 'customer' | null
    const itemId = searchParams.get('itemId'); // specific flavor/item id

    // Base filter
    const baseWhere: any = { isActive: true };
    if (audience === 'store') baseWhere.allowStores = true;
    if (audience === 'customer') baseWhere.allowCustomers = true;

  let options: any[] = [];
  // Map of packagingOptionId -> default flags (global + audience-specific)
  let defaultMap: Record<string, { any: boolean; stores: boolean; customers: boolean }> = {} as Record<string, { any: boolean; stores: boolean; customers: boolean }>;
    if (itemId) {
      // If itemId provided, try to fetch mapped options via join table. If none mapped, fall back to base.
      const mapped = await (prisma as any).itemPackagingOption.findMany({
        where: { itemId },
        select: { packagingOptionId: true, isDefault: true, isDefaultForStores: true, isDefaultForCustomers: true }
      });

      if (Array.isArray(mapped) && mapped.length > 0) {
        const ids = mapped.map((m: any) => m.packagingOptionId);
        defaultMap = Object.fromEntries(
          mapped.map((m: any) => [
            m.packagingOptionId,
            {
              any: Boolean(m.isDefault),
              stores: Boolean(m.isDefaultForStores),
              customers: Boolean(m.isDefaultForCustomers),
            },
          ])
        ) as Record<string, { any: boolean; stores: boolean; customers: boolean }>;
        options = await (prisma as any).packagingOption.findMany({
          where: { ...baseWhere, id: { in: ids } },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
      } else {
        options = await (prisma as any).packagingOption.findMany({
          where: baseWhere,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
      }
    } else {
      options = await (prisma as any).packagingOption.findMany({
        where: baseWhere,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }
    const payload: PackagingOptionDTO[] = (options || []).map((o: any) => ({
      id: String(o.id),
      name: String(o.name),
      type: String(o.type),
      sizeValue: o.sizeValue == null ? null : Number(o.sizeValue),
      sizeUnit: o.sizeUnit == null ? null : String(o.sizeUnit),
      variableWeight: Boolean(o.variableWeight),
      allowStores: Boolean(o.allowStores),
      allowCustomers: Boolean(o.allowCustomers),
      isDefault: Boolean(defaultMap[String(o.id)]?.any || false),
      isDefaultForStores: Boolean(defaultMap[String(o.id)]?.stores || false),
      isDefaultForCustomers: Boolean(defaultMap[String(o.id)]?.customers || false),
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching packaging options:', error);
    return NextResponse.json({ error: 'Failed to fetch packaging options' }, { status: 500 });
  }
}
type PackagingOptionDTO = {
  id: string;
  name: string;
  type: string;
  sizeValue: number | null;
  sizeUnit: string | null;
  variableWeight: boolean;
  allowStores: boolean;
  allowCustomers: boolean;
  isDefault?: boolean;
  isDefaultForStores?: boolean;
  isDefaultForCustomers?: boolean;
};
