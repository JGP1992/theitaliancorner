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

  // Simplified: no category grouping; show a single grid of all flavors.

  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  const user = token ? AuthService.verifyToken(token) : null;
  const isAdmin = !!user && (
    AuthService.hasRole(user, 'admin') ||
    AuthService.hasRole(user, 'system_admin')
  );

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
  // Note: Avoid clearing cookies during Server Component render to prevent RSC errors.
  // The import details cookie is short-lived (maxAge set at write). It will expire automatically.

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

  {/* Quick Add Flavor (admin/system_admin only) */}
        <AddFlavorCard />

        {/* All Flavors (simple grid) */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">All Flavors</h2>
            <span className="text-sm text-gray-600">{flavors.length} total</span>
          </div>
          {flavors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No flavors yet. Add one above.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {flavors.map((flavor: Flavor) => (
                <div key={flavor.id} className="bg-gray-50 rounded-lg p-4 border hover:shadow-sm transition-shadow">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">{flavor.name}</h3>
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                      <form action={toggleFlavorActive}>
                        <input type="hidden" name="id" defaultValue={flavor.id} />
                        <input type="hidden" name="active" defaultValue={flavor.isActive ? '0' : '1'} />
                        <button className="px-2 py-1 border rounded hover:bg-gray-100">{flavor.isActive ? 'Deactivate' : 'Activate'}</button>
                      </form>
                      <a href={`/admin/packaging?itemId=${flavor.id}`} className="px-2 py-1 border rounded hover:bg-gray-100">Packaging…</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories removed for simplicity */}

        {/* Quick Actions removed for simplicity */}

        {/* Bulk Import (CSV) */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Bulk Import Flavors (CSV)</h2>
          <p className="text-sm text-gray-600 mb-3">Columns: name, unit, sortOrder, isActive. Target fields are no longer used.</p>
          <form action={importFlavorsCsv} className="flex items-center gap-3">
            <input type="file" name="file" accept=".csv,text/csv" className="border border-gray-300 rounded px-3 py-2" required />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Import CSV</button>
          </form>
        </div>

  {/* Inline Edit (admin/system_admin) */}
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

  // AuthZ: only admin or system_admin can create flavors
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'system_admin'))) {
    redirect('/login');
  }

  const name = String(formData.get('name') || '').trim();
  const unit = String(formData.get('unit') || '').trim() || null;
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
      sortOrder,
      isActive
    }
  });
  // Fetch the created item id to redirect to packaging setup
  const created = await prisma.item.findFirst({ where: { name, categoryId: gelatoCategory.id }, orderBy: { createdAt: 'desc' } as any });
  if (created?.id) {
    redirect(`/admin/packaging?itemId=${created.id}`);
  }
  redirect('/flavors');
}

// Isolated component to render the creation card; kept in same file for simplicity
function AddFlavorCard() {
  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Flavor</h2>
      <form action={addFlavor} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Flavor Name</label>
          <input name="name" required placeholder="e.g., Pistachio" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit (optional)</label>
          <input name="unit" placeholder="e.g., tubs, kg, L" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
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
      <p className="text-xs text-gray-600 mt-2">
        Tip: First create the flavor here, then assign its sizes/packaging in
        {' '}<a href="/admin/packaging" className="underline text-blue-600 hover:text-blue-700">Admin → Packaging Options</a>.
      </p>
    </div>
  );
}

async function toggleFlavorActive(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  const user = AuthService.verifyToken(token);
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'system_admin'))) {
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
  if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'system_admin'))) {
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

  const toCreate: Array<{ name: string; unit: string | null; sortOrder: number; isActive: boolean; categoryId: string }>= [];
  for (let i = start; i < lines.length; i++) {
    const row = lines[i];
    const parts = row.split(',');
    const name = (parts[0] || '').trim();
    if (!name) continue;
    const unit = (parts[1] || '').trim() || null;
    // Support both legacy format (name, unit, targetText, targetNumber, sortOrder, isActive)
    // and new format (name, unit, sortOrder, isActive)
    let sortOrderStr = '';
    let isActiveStr = '';
    if (parts.length >= 6) {
      sortOrderStr = (parts[4] || '').trim();
      isActiveStr = (parts[5] || '1').trim();
    } else {
      sortOrderStr = (parts[2] || '').trim();
      isActiveStr = (parts[3] || '1').trim();
    }

    toCreate.push({
      name,
      unit,
      sortOrder: sortOrderStr ? Number(sortOrderStr) : 0,
      isActive: isActiveStr === '1' || isActiveStr.toLowerCase() === 'true',
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
