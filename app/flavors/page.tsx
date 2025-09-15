export const dynamic = 'force-dynamic';

import { prisma } from '@/app/lib/prisma';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthService } from '@/lib/auth';
import FlavorInlineEditor from './FlavorInlineEditor';
import '../globals.css';

type Flavor = {
  id: string;
  name: string;
  targetText: string | null;
  targetNumber: number | null;
  unit: string | null;
  isActive: boolean;
};

export default async function FlavorsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  let flavors: Flavor[] = [];
  
  try {
    flavors = await prisma.item.findMany({
      where: {
        category: { name: 'Gelato Flavors' },
        isActive: true
      },
      include: { category: true },
      orderBy: { sortOrder: 'asc' }
    });
  } catch (error) {
    console.error('Error fetching flavors:', error);
    // Return empty array if database is not available
    flavors = [];
  }

  // Group flavors by type
  const classicFlavors = flavors.filter((f: Flavor) =>
    ['Vanilla', 'Chocolate', 'Strawberry', 'Lemon', 'Pistachio', 'Hazelnut', 'Caramel', 'Coffee'].includes(f.name)
  );

  const fruitFlavors = flavors.filter((f: Flavor) =>
    ['Mango', 'Passion Fruit', 'Raspberry', 'Blueberry', 'Peach', 'Pineapple', 'Coconut', 'Banana'].includes(f.name)
  );

  const specialtyFlavors = flavors.filter((f: Flavor) =>
    ['Tiramisu', 'Cannoli', 'Panna Cotta', 'Ricotta', 'Stracciatella', 'Zabaione'].includes(f.name)
  );

  const alcoholicFlavors = flavors.filter((f: Flavor) =>
    ['Amaretto', 'Baileys', 'Limoncello', 'Frangelico', 'Sambuca'].includes(f.name)
  );

  const seasonalFlavors = flavors.filter((f: Flavor) =>
    f.name.includes('Seasonal') || ['Pumpkin Spice', 'Eggnog', 'Gingerbread', 'Peppermint Bark'].includes(f.name)
  );

  const dietaryFlavors = flavors.filter((f: Flavor) =>
    f.name.includes('Sugar Free') || f.name.includes('Vegan') || f.name.includes('Sorbet')
  );

  const categories = [
    { name: 'Classic Flavors', flavors: classicFlavors, color: 'bg-blue-50 border-blue-200', icon: '🍦' },
    { name: 'Fruit Flavors', flavors: fruitFlavors, color: 'bg-green-50 border-green-200', icon: '🍓' },
    { name: 'Specialty Flavors', flavors: specialtyFlavors, color: 'bg-purple-50 border-purple-200', icon: '⭐' },
    { name: 'Alcoholic Flavors', flavors: alcoholicFlavors, color: 'bg-amber-50 border-amber-200', icon: '🥃' },
    { name: 'Seasonal Flavors', flavors: seasonalFlavors, color: 'bg-orange-50 border-orange-200', icon: '🎃' },
    { name: 'Dietary Options', flavors: dietaryFlavors, color: 'bg-pink-50 border-pink-200', icon: '🌱' }
  ];

  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  const user = token ? AuthService.verifyToken(token) : null;
  const isAdmin = !!user && (AuthService.hasRole(user, 'admin') || AuthService.hasRole(user, 'manager'));

  // Import summary banner
  const sp = searchParams ? await searchParams : undefined;
  const created = Number(typeof sp?.created === 'string' ? sp?.created : Array.isArray(sp?.created) ? sp?.created?.[0] : 0) || 0;
  const skipped = Number(typeof sp?.skipped === 'string' ? sp?.skipped : Array.isArray(sp?.skipped) ? sp?.skipped?.[0] : 0) || 0;
  const errorsMsg = String(typeof sp?.errors === 'string' ? sp?.errors : Array.isArray(sp?.errors) ? sp?.errors?.[0] : '') || '';

  // Read detailed import results cookie if present
  const detailCookie = cookieStore.get('flavors_import_details')?.value;
  let importDetails: Array<{ row: number; status: 'created' | 'skipped' | 'error'; message?: string }> = [];
  if (detailCookie) {
    try { importDetails = JSON.parse(detailCookie); } catch {}
  }
  // Clear the details cookie after first render so it doesn't persist across refreshes
  if (detailCookie) {
    cookieStore.set('flavors_import_details', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/flavors' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gelato Flavors</h1>
              <p className="mt-2 text-gray-600">Manage your complete gelato flavor inventory</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/admin"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Manage All Items
              </Link>
              <Link
                href="/factory"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Factory Dashboard
              </Link>
              {isAdmin && (
                <a
                  href="/api/flavors/export"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Export CSV
                </a>
              )}
            </div>
          </div>
          {(created > 0 || skipped > 0 || errorsMsg) && (
            <div className="mt-4 rounded-md border p-3 bg-green-50 border-green-200 text-sm text-green-900">
              <div className="font-medium">Import Summary</div>
              <div className="mt-1">Created: {created} • Skipped: {skipped}</div>
              {errorsMsg && (
                <div className="mt-1 text-red-700">Errors: {errorsMsg}</div>
              )}
              {importDetails.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs border">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-2 py-1 text-left border">Row</th>
                        <th className="px-2 py-1 text-left border">Status</th>
                        <th className="px-2 py-1 text-left border">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importDetails.map((d, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1 border">{d.row}</td>
                          <td className="px-2 py-1 border">
                            <span className={d.status === 'error' ? 'text-red-700' : d.status === 'skipped' ? 'text-amber-700' : 'text-green-700'}>
                              {d.status}
                            </span>
                          </td>
                          <td className="px-2 py-1 border">{d.message || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Add Flavor (admin/manager only) */}
        <AddFlavorCard />

        {/* Flavor Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Flavors</p>
                <p className="text-2xl font-bold text-gray-900">{flavors.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Fruit Flavors</p>
                <p className="text-2xl font-bold text-gray-900">{fruitFlavors.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Specialty</p>
                <p className="text-2xl font-bold text-gray-900">{specialtyFlavors.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-pink-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Dietary Options</p>
                <p className="text-2xl font-bold text-gray-900">{dietaryFlavors.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Flavor Categories */}
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category.name} className={`${category.color} rounded-lg border p-6`}>
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">{category.icon}</span>
                <h2 className="text-xl font-semibold text-gray-900">{category.name}</h2>
                <span className="ml-2 px-2 py-1 bg-white bg-opacity-50 rounded-full text-sm font-medium">
                  {category.flavors.length} flavors
                </span>
              </div>

              {category.flavors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No flavors in this category yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {category.flavors.map((flavor: Flavor) => (
                    <div key={flavor.id} className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">{flavor.name}</h3>
                        {flavor.targetText && (
                          <p className="text-sm text-gray-600 whitespace-normal break-words">
                            Target: {flavor.targetText}
                            {flavor.unit && ` ${flavor.unit}`}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                          <form action={toggleFlavorActive}>
                            <input type="hidden" name="id" defaultValue={flavor.id} />
                            <input type="hidden" name="active" defaultValue={flavor.isActive ? '0' : '1'} />
                            <button className="px-2 py-1 border rounded hover:bg-gray-50">{flavor.isActive ? 'Deactivate' : 'Activate'}</button>
                          </form>
                          <a href={`/admin/packaging?itemId=${flavor.id}`} className="px-2 py-1 border rounded hover:bg-gray-50">Packaging…</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/factory"
              className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Create Delivery Plan</h3>
                <p className="text-sm text-gray-600">Plan flavor deliveries to stores</p>
              </div>
            </Link>

            <Link
              href="/admin"
              className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Manage Inventory</h3>
                <p className="text-sm text-gray-600">Update flavor targets and settings</p>
              </div>
            </Link>

            <div className="flex items-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Flavor Analytics</h3>
                <p className="text-sm text-gray-600">View flavor performance data</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Import (CSV) */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Bulk Import Flavors (CSV)</h2>
          <p className="text-sm text-gray-600 mb-3">Columns: name, unit, targetText, targetNumber, sortOrder, isActive</p>
          <form action={importFlavorsCsv} encType="multipart/form-data" className="flex items-center gap-3">
            <input type="file" name="file" accept=".csv,text/csv" className="border border-gray-300 rounded px-3 py-2" required />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Import CSV</button>
          </form>
        </div>

        {/* Inline Edit (admin/manager) */}
        {isAdmin && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Flavors Inline</h2>
            <FlavorInlineEditor initialFlavors={flavors as any} />
          </div>
        )}
      </div>
    </div>
  );
}

// Server action to add a new gelato flavor under the "Gelato Flavors" category
async function addFlavor(formData: FormData) {
  'use server';

  // AuthZ: only admin/manager can create flavors
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
    redirect('/login');
  }

  const name = String(formData.get('name') || '').trim();
  const unit = String(formData.get('unit') || '').trim() || null;
  const targetText = String(formData.get('targetText') || '').trim() || null;
  const targetNumberRaw = String(formData.get('targetNumber') || '').trim();
  const targetNumber = targetNumberRaw ? Number(targetNumberRaw) : null;
  const sortOrderRaw = String(formData.get('sortOrder') || '').trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  const isActive = String(formData.get('isActive') || 'on') === 'on';

  if (!name) {
    redirect('/flavors');
  }

  // Ensure the category exists
  let gelatoCategory = await prisma.category.findFirst({ where: { name: 'Gelato Flavors' } });
  if (!gelatoCategory) {
    gelatoCategory = await prisma.category.create({ data: { name: 'Gelato Flavors', sortOrder: 5 } });
  }

  // Create the flavor item
  await prisma.item.create({
    data: {
      name,
      categoryId: gelatoCategory.id,
      unit,
      targetText,
      targetNumber,
      sortOrder,
      isActive
    }
  });

  redirect('/flavors');
}

// Isolated component to render the creation card; kept in same file for simplicity
function AddFlavorCard() {
  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Flavor</h2>
      <form action={addFlavor} className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Flavor Name</label>
          <input name="name" required placeholder="e.g., Pistachio" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit (optional)</label>
          <input name="unit" placeholder="e.g., tubs, kg, L" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Text (optional)</label>
          <input name="targetText" placeholder="e.g., 10 tubs per week" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Number</label>
          <input name="targetNumber" type="number" step="0.1" min="0" placeholder="e.g., 10" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
          <input name="sortOrder" type="number" step="1" placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="isActive" defaultChecked className="rounded border-gray-300" /> Active
          </label>
        </div>
        <div className="md:col-span-6 flex justify-end">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Add Flavor</button>
        </div>
      </form>
      <p className="text-xs text-gray-500 mt-2">Tip: Packaging is configured separately in Admin → Packaging Options.</p>
    </div>
  );
}

async function toggleFlavorActive(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
    redirect('/');
  }

  const id = String(formData.get('id') || '');
  const activeRaw = String(formData.get('active') || '1');
  const isActive = activeRaw === '1';
  if (!id) redirect('/flavors');

  await prisma.item.update({ where: { id }, data: { isActive } });
  redirect('/flavors');
}

async function importFlavorsCsv(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
    redirect('/');
  }

  const file = formData.get('file') as File | null;
  if (!file) redirect('/flavors');

  // Read file text and parse CSV (simple split; robust enough for basic imports)
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  // Detect header if present
  let start = 0;
  if (lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('unit')) {
    start = 1;
  }

  // Ensure category exists
  let category = await prisma.category.findFirst({ where: { name: 'Gelato Flavors' } });
  if (!category) {
    category = await prisma.category.create({ data: { name: 'Gelato Flavors', sortOrder: 5 } });
  }

  const toCreate: Array<{ name: string; unit: string | null; targetText: string | null; targetNumber: number | null; sortOrder: number; isActive: boolean; categoryId: string }>= [];
  for (let i = start; i < lines.length; i++) {
    const row = lines[i];
    const parts = row.split(',');
    const name = (parts[0] || '').trim();
    if (!name) continue;
    const unit = (parts[1] || '').trim() || null;
    const targetText = (parts[2] || '').trim() || null;
    const targetNumber = (parts[3] || '').trim();
    const sortOrder = (parts[4] || '').trim();
    const isActive = (parts[5] || '1').trim();

    toCreate.push({
      name,
      unit,
      targetText,
      targetNumber: targetNumber ? Number(targetNumber) : null,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      isActive: isActive === '1' || isActive.toLowerCase() === 'true',
      categoryId: category.id,
    });
  }

  let created = 0; let skipped = 0; const errors: string[] = [];
  const details: Array<{ row: number; status: 'created' | 'skipped' | 'error'; message?: string }> = [];
  if (toCreate.length) {
    // Create sequentially to preserve order and avoid unique name conflicts errors aborting all
    for (const [idx, row] of toCreate.entries()) {
      try {
        await prisma.item.create({ data: row });
        created++;
        details.push({ row: idx + 1 + start, status: 'created' });
      } catch (e: any) {
        skipped++;
        const msg = e?.message || 'failed';
        if (errors.length < 5) errors.push(`Row ${idx+1}: ${msg}`);
        details.push({ row: idx + 1 + start, status: 'error', message: msg });
      }
    }
  }
  const params = new URLSearchParams();
  params.set('created', String(created));
  params.set('skipped', String(skipped));
  if (errors.length) params.set('errors', errors.join(' | '));
  // Store details in a short-lived cookie (5 minutes)
  const cookieWriter = await cookies();
  cookieWriter.set('flavors_import_details', JSON.stringify(details.slice(0, 200)), { httpOnly: true, sameSite: 'lax', maxAge: 300, path: '/flavors' });
  redirect(`/flavors?${params.toString()}`);
}

// Client editor moved to ./FlavorInlineEditor to avoid mixing client code in a server file.
