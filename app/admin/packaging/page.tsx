import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthService } from '@/lib/auth';
import '../../globals.css';

export const dynamic = 'force-dynamic';

export default async function PackagingAdminPage({ searchParams }: { searchParams?: Promise<{ itemId?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
    redirect('/');
  }

  // Fetch existing options and gelato flavors
  const sp = searchParams ? await searchParams : undefined;
  const selectedItemId = sp?.itemId || '';

  const [options, flavors, preselected] = await Promise.all([
    prisma.packagingOption.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  }),
    prisma.item.findMany({
      where: { isActive: true, category: { name: 'Gelato Flavors' } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    }),
    selectedItemId
      ? (prisma as any).itemPackagingOption.findMany({
          where: { itemId: selectedItemId },
          select: { packagingOptionId: true, isDefault: true, isDefaultForStores: true, isDefaultForCustomers: true }
        })
      : Promise.resolve([])
  ]).catch(() => [[], [], []] as any);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Packaging Options</h1>
            <p className="text-gray-600">Manage cups, tubs, trays, and whether weight is required.</p>
          </div>
          <a href="/admin" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Back to Admin</a>
        </div>

        <AddPackagingForm />

        <div className="mt-8 bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Assign Packaging to Flavor</h2>
          <AssignPackagingForm
            flavors={flavors as any}
            options={options as any}
            defaultItemId={selectedItemId}
            preselectedIds={(preselected as any[]).map((p: any) => p.packagingOptionId)}
            defaultId={(preselected as any[]).find((p: any) => p.isDefault)?.packagingOptionId}
            defaultIdStores={(preselected as any[]).find((p: any) => p.isDefaultForStores)?.packagingOptionId}
            defaultIdCustomers={(preselected as any[]).find((p: any) => p.isDefaultForCustomers)?.packagingOptionId}
          />
        </div>

        <div className="mt-8 bg-white border rounded-lg overflow-hidden shadow-sm">
          {Array.isArray(options) && options.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Variable Weight</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Allowed</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {options.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{o.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{o.type}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{o.sizeValue ? `${o.sizeValue}${o.sizeUnit ? ` ${o.sizeUnit}` : ''}` : '-'}</td>
                    <td className="px-4 py-2 text-sm">{o.variableWeight ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-sm">{[
                      o.allowStores ? 'Stores' : null,
                      o.allowCustomers ? 'Customers' : null
                    ].filter(Boolean).join(', ') || '-'}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      <form action={deactivatePackaging}>
                        <input type="hidden" name="id" defaultValue={o.id} />
                        <button className="text-red-600 hover:text-red-700">Deactivate</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500">No active options yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

async function addPackaging(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
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

async function deactivatePackaging(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
    redirect('/');
  }

  const id = String(formData.get('id') || '');
  if (!id) redirect('/admin/packaging');

  await prisma.packagingOption.update({ where: { id }, data: { isActive: false } });
  redirect('/admin/packaging');
}

function AddPackagingForm() {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-medium mb-4">Add Packaging Option</h2>
      <form action={addPackaging} className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input name="name" placeholder="Optional display name" className="w-full border border-gray-300 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select name="type" required className="w-full border border-gray-300 rounded-md px-3 py-2">
            <option value="TUB">Tub</option>
            <option value="CUP">Cup</option>
            <option value="TRAY">Tray</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Size Value</label>
          <input name="sizeValue" type="number" step="0.1" min="0" placeholder="e.g., 5" className="w-full border border-gray-300 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Size Unit</label>
          <select name="sizeUnit" className="w-full border border-gray-300 rounded-md px-3 py-2">
            <option value="">-</option>
            <option value="L">L</option>
            <option value="ML">ML</option>
            <option value="KG">KG</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="variableWeight" className="rounded border-gray-300" /> Variable weight (capture kg)
          </label>
        </div>
        <div className="flex items-end">
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="allowStores" defaultChecked className="rounded border-gray-300" /> Stores
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="allowCustomers" defaultChecked className="rounded border-gray-300" /> Customers
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
          <input name="sortOrder" type="number" step="1" placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
        </div>
        <div className="md:col-span-6 flex justify-end">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add Option</button>
        </div>
      </form>
    </div>
  );
}

async function assignPackaging(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
    redirect('/');
  }

  const itemId = String(formData.get('itemId') || '');
  const selected = String(formData.get('selected') || '');
  const defaultId = String(formData.get('defaultId') || '');
  const defaultStoresId = String(formData.get('defaultStoresId') || '');
  const defaultCustomersId = String(formData.get('defaultCustomersId') || '');
  if (!itemId) redirect('/admin/packaging');

  // Selected is comma-separated list of packagingOptionIds
  const selectedIds = selected
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Fetch existing
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

  // Ensure single defaults: reset all then set selected ones per audience
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

function AssignPackagingForm({ flavors, options, defaultItemId, preselectedIds, defaultId, defaultIdStores, defaultIdCustomers }: { flavors: Array<{ id: string; name: string }>; options: Array<{ id: string; name: string }>; defaultItemId?: string; preselectedIds?: string[]; defaultId?: string; defaultIdStores?: string; defaultIdCustomers?: string }) {
  return (
    <form action={assignPackaging} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Flavor</label>
          <select name="itemId" required className="w-full border border-gray-300 rounded-md px-3 py-2" defaultValue={defaultItemId || ''}>
            <option value="">Select flavor</option>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Packaging</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border border-gray-200 rounded p-3 max-h-60 overflow-auto">
            {options.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" value={o.id} className="rounded border-gray-300 assign-packaging-checkbox" defaultChecked={preselectedIds?.includes(o.id)} />
                  <span>{o.name}</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input type="radio" name="defaultIdRadio" value={o.id} className="text-blue-600" defaultChecked={defaultId === o.id} />
                    <span>Any</span>
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input type="radio" name="defaultStoresIdRadio" value={o.id} className="text-blue-600" defaultChecked={defaultIdStores === o.id} />
                    <span>Stores</span>
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input type="radio" name="defaultCustomersIdRadio" value={o.id} className="text-blue-600" defaultChecked={defaultIdCustomers === o.id} />
                    <span>Customers</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Hidden input populated by client script on submit */}
      <input type="hidden" name="selected" value="" />
      <input type="hidden" name="defaultId" value="" />
      <input type="hidden" name="defaultStoresId" value="" />
      <input type="hidden" name="defaultCustomersId" value="" />
      <div className="flex justify-end">
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={(e: any) => {
            // Collect selected on submit
            const form = e.currentTarget?.form as HTMLFormElement;
            if (!form) return;
            const boxes = Array.from(form.querySelectorAll('.assign-packaging-checkbox')) as HTMLInputElement[];
            const ids = boxes.filter(b => b.checked).map(b => b.value);
            const hidden = form.querySelector('input[name="selected"]') as HTMLInputElement;
            if (hidden) hidden.value = ids.join(',');
            const defaultRadio = form.querySelector('input[name="defaultIdRadio"]:checked') as HTMLInputElement | null;
            const hiddenDefault = form.querySelector('input[name="defaultId"]') as HTMLInputElement;
            if (hiddenDefault) hiddenDefault.value = defaultRadio?.value || '';
            const defaultStoresRadio = form.querySelector('input[name="defaultStoresIdRadio"]:checked') as HTMLInputElement | null;
            const hiddenDefaultStores = form.querySelector('input[name="defaultStoresId"]') as HTMLInputElement;
            if (hiddenDefaultStores) hiddenDefaultStores.value = defaultStoresRadio?.value || '';
            const defaultCustomersRadio = form.querySelector('input[name="defaultCustomersIdRadio"]:checked') as HTMLInputElement | null;
            const hiddenDefaultCustomers = form.querySelector('input[name="defaultCustomersId"]') as HTMLInputElement;
            if (hiddenDefaultCustomers) hiddenDefaultCustomers.value = defaultCustomersRadio?.value || '';
          }}
        >Save Mapping</button>
      </div>
      <p className="text-xs text-gray-500">Tip: If a flavor has no mapping, all allowed options will be shown by default.</p>
    </form>
  );
}
