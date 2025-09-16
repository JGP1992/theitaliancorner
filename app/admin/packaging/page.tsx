import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthService } from '@/lib/auth';
import '../../globals.css';
import { addPackaging, deactivatePackaging, assignPackaging } from './actions';
import AssignPackagingFormClient from './AssignPackagingForm.client';

export const dynamic = 'force-dynamic';

export default async function PackagingAdminPage({ searchParams }: { searchParams?: Promise<{ itemId?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'system_admin'))) {
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
          <AssignPackagingFormClient
            flavors={flavors as any}
            options={options as any}
            defaultItemId={selectedItemId}
            preselectedIds={(preselected as any[]).map((p: any) => p.packagingOptionId)}
            defaultId={(preselected as any[]).find((p: any) => p.isDefault)?.packagingOptionId}
            defaultIdStores={(preselected as any[]).find((p: any) => p.isDefaultForStores)?.packagingOptionId}
            defaultIdCustomers={(preselected as any[]).find((p: any) => p.isDefaultForCustomers)?.packagingOptionId}
            action={assignPackaging}
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

function AddPackagingForm() {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-medium mb-1">Add Packaging Option</h2>
      <p className="text-sm text-gray-500 mb-4">Define a cup, tub, or tray option. You can map these to flavors below.</p>
      <form action={addPackaging} className="space-y-5">
        {/* Basic details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select name="type" required className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="TUB">Tub</option>
              <option value="CUP">Cup</option>
              <option value="TRAY">Tray</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Controls behavior (e.g., trays can require weight).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Size Value</label>
            <input name="sizeValue" type="number" step="0.1" min="0" placeholder="e.g., 2 or 5" className="w-full border border-gray-300 rounded-md px-3 py-2" />
            <p className="text-xs text-gray-500 mt-1">Numeric size (leave blank for label-only names).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Size Unit</label>
            <select name="sizeUnit" className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">—</option>
              <option value="L">L</option>
              <option value="ML">ML</option>
              <option value="KG">KG</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Pick the unit for the size.</p>
          </div>
        </div>

        {/* Naming */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name (optional)</label>
          <input name="name" placeholder="e.g., 2 L tub (preferred label)" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          <p className="text-xs text-gray-500 mt-1">If left blank, a name will be generated from type and size.</p>
        </div>

        {/* Audience & behavior */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <span className="block text-sm font-medium text-gray-700 mb-1">Who can use this?</span>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="allowStores" defaultChecked className="rounded border-gray-300" /> Stores
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="allowCustomers" defaultChecked className="rounded border-gray-300" /> Customers
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">Controls visibility when mapping to flavors per audience.</p>
          </div>
          <div className="flex items-start">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 mt-6 md:mt-0">
              <input type="checkbox" name="variableWeight" className="rounded border-gray-300" /> Variable weight (capture kg)
            </label>
          </div>
        </div>

        {/* Advanced */}
        <details className="rounded border border-gray-200 p-3 bg-gray-50">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">Advanced</summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order (optional)</label>
              <input name="sortOrder" type="number" step="1" placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">Lower appears first; leave blank for automatic ordering.</p>
            </div>
          </div>
        </details>

        <div className="flex justify-end">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add Option</button>
        </div>
      </form>
    </div>
  );
}
