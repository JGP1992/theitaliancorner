'use server';

import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthService } from '@/lib/auth';

export async function addPackaging(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'system_admin'))) {
    redirect('/');
  }

  const name = String(formData.get('name') || '').trim();
  const type = String(formData.get('type') || '');
  const sizeValueRaw = String(formData.get('sizeValue') || '').trim();
  const sizeUnit = String(formData.get('sizeUnit') || '').trim() || null;
  const variableWeight = String(formData.get('variableWeight') || '') === 'on';
  const allowStores = String(formData.get('allowStores') || 'on') === 'on';
  const allowCustomers = String(formData.get('allowCustomers') || 'on') === 'on';
  const sortOrderRaw = String(formData.get('sortOrder') || '').trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;

  const sizeValue = sizeValueRaw ? Number(sizeValueRaw) : null;

  await prisma.packagingOption.create({
    data: {
      name: name || `${type} ${sizeValue ?? ''} ${sizeUnit ?? ''}`.trim(),
      type: type as any,
      sizeValue,
      sizeUnit: sizeUnit as any,
      variableWeight,
      allowStores,
      allowCustomers,
      sortOrder,
      isActive: true,
    }
  });

  redirect('/admin/packaging');
}

export async function deactivatePackaging(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'system_admin'))) {
    redirect('/');
  }

  const id = String(formData.get('id') || '');
  if (!id) redirect('/admin/packaging');

  await prisma.packagingOption.update({ where: { id }, data: { isActive: false } });
  redirect('/admin/packaging');
}

export async function assignPackaging(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'system_admin'))) {
    redirect('/');
  }

  const itemId = String(formData.get('itemId') || '');
  const selected = String(formData.get('selected') || '');
  const defaultId = String(formData.get('defaultId') || '');
  const defaultStoresId = String(formData.get('defaultStoresId') || '');
  const defaultCustomersId = String(formData.get('defaultCustomersId') || '');
  if (!itemId) redirect('/admin/packaging');

  const selectedIds = selected
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const existing: any[] = await (prisma as any).itemPackagingOption.findMany({ where: { itemId } });
  const existingIds = new Set(existing.map((e: any) => e.packagingOptionId));

  // Create missing
  const toCreate = selectedIds.filter((id) => !existingIds.has(id));
  if (toCreate.length) {
    await (prisma as any).itemPackagingOption.createMany({
      data: toCreate.map((packagingOptionId) => ({
        itemId,
        packagingOptionId,
        isDefault: defaultId === packagingOptionId || defaultStoresId === packagingOptionId || defaultCustomersId === packagingOptionId,
        isDefaultForStores: defaultStoresId === packagingOptionId,
        isDefaultForCustomers: defaultCustomersId === packagingOptionId,
      })),
      skipDuplicates: true,
    });
  }

  // Delete removed
  const toDelete = existing.filter((e: any) => !selectedIds.includes(e.packagingOptionId));
  if (toDelete.length) {
    await (prisma as any).itemPackagingOption.deleteMany({
      where: { itemId, packagingOptionId: { in: toDelete.map((e: any) => e.packagingOptionId) } }
    });
  }

  // Reset defaults then set per audience
  await (prisma as any).itemPackagingOption.updateMany({
    where: { itemId },
    data: { isDefault: false, isDefaultForStores: false, isDefaultForCustomers: false }
  });
  if (defaultId && selectedIds.includes(defaultId)) {
    await (prisma as any).itemPackagingOption.updateMany({
      where: { itemId, packagingOptionId: defaultId },
      data: { isDefault: true }
    });
  }
  if (defaultStoresId && selectedIds.includes(defaultStoresId)) {
    await (prisma as any).itemPackagingOption.updateMany({
      where: { itemId, packagingOptionId: defaultStoresId },
      data: { isDefaultForStores: true, isDefault: true }
    });
  }
  if (defaultCustomersId && selectedIds.includes(defaultCustomersId)) {
    await (prisma as any).itemPackagingOption.updateMany({
      where: { itemId, packagingOptionId: defaultCustomersId },
      data: { isDefaultForCustomers: true, isDefault: true }
    });
  }

  redirect('/admin/packaging');
}
