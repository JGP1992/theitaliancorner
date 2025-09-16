import '../globals.css';
import { prisma } from '@/app/lib/prisma';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AuthService } from '../../lib/auth';
// DeleteButton is no longer used here to avoid passing server actions to client components

export default async function AdminPage() {
  // Check authentication on server side
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;

  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (!user) {
    redirect('/login');
  }

  // Check if user has admin or system_admin role
  if (
    !AuthService.hasRole(user, 'admin') &&
    !AuthService.hasRole(user, 'system_admin')
  ) {
    redirect('/');
  }

  const [stores, categories, items, customers] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.item.findMany({
      include: { category: true },
      orderBy: { name: 'asc' }
    }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } })
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your stores, customers, categories, and inventory items</p>

          {/* Navigation Links */}
          <div className="mt-4 flex gap-4">
            <a
              href="/admin/users"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              👥 Manage Users
            </a>
            <a
              href="/admin/roles"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              🛡️ Manage Roles
            </a>
            <a
              href="/admin/packaging"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              📦 Packaging Options
            </a>
          </div>
        </div>

        {/* Quick Add Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Add Store</h2>
            <form action={addStore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                <input name="name" placeholder="Store Name" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input name="slug" placeholder="Slug" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key (optional)</label>
                <input name="apiKey" placeholder="API Key (optional)" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white rounded-md px-4 py-2 font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                Add Store
              </button>
            </form>
          </div>

          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Add Ingredient</h2>
            <form action={addIngredient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient Name</label>
                <input name="name" placeholder="e.g., Whole Milk, Sugar, Cocoa Powder" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Stock Level</label>
                <input name="target" placeholder="e.g., 50 liters, 25 kg, 2 liters" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select name="unit" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500">
                  <option value="">Select Unit</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="liters">liters</option>
                  <option value="ml">ml</option>
                  <option value="pieces">pieces</option>
                  <option value="boxes">boxes</option>
                  <option value="bottles">bottles</option>
                  <option value="tubs">tubs</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-green-600 text-white rounded-md px-4 py-2 font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                Add Ingredient
              </button>
            </form>
          </div>

          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Add Item</h2>
            <form action={addItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select name="categoryId" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                  <option value="">Select Category</option>
                  {categories.map((c: { id: string; name: string }) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input name="name" placeholder="Item Name" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target (optional)</label>
                <input name="target" placeholder="Target (optional)" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <button type="submit" className="w-full bg-purple-600 text-white rounded-md px-4 py-2 font-medium hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors">
                Add Item
              </button>
            </form>
          </div>

          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Add Customer</h2>
            <form action={addCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input name="name" placeholder="Restaurant/Customer Name" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select name="type" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                  <option value="restaurant">Restaurant</option>
                  <option value="cafe">Cafe</option>
                  <option value="hotel">Hotel</option>
                  <option value="catering">Catering</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input name="contactName" placeholder="Contact Person" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input name="phone" placeholder="Phone Number" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <button type="submit" className="w-full bg-orange-600 text-white rounded-md px-4 py-2 font-medium hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors">
                Add Customer
              </button>
            </form>
          </div>
        </div>

        {/* Management Tables */}
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-medium mb-4">Stores ({stores.length})</h2>
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              {stores.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <p>No stores found. Add your first store above.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stores.map((store: { id: string; name: string; slug: string; apiKey: string }) => (
                      <tr key={store.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{store.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{store.slug}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{store.apiKey}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <form action={deleteStoreAction}>
                            <input type="hidden" name="id" value={store.id} />
                            <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Categories ({categories.length})</h2>
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              {categories.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <p>No categories found. Add your first category above.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categories.map((category: { id: string; name: string }) => (
                      <tr key={category.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{category.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <form action={deleteCategoryAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Ingredients ({items.filter((item: { category: { name: string } }) => item.category.name === 'Ingredients').length})</h2>
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              {items.filter((item: { category: { name: string } }) => item.category.name === 'Ingredients').length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <p>No ingredients found. Add your first ingredient above.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items
                      .filter((item: { category: { name: string } }) => item.category.name === 'Ingredients')
                      .map((item: { id: string; name: string; targetText: string | null; unit: string | null }) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.targetText || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <form action={deleteItemAction}>
                              <input type="hidden" name="id" value={item.id} />
                              <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                                Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Items ({items.length})</h2>
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              {items.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <p>No items found. Add your first item above.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item: { id: string; name: string; targetText: string | null; category: { name: string } }) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.targetText || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <form action={deleteItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Customers ({customers.length})</h2>
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              {customers.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <p>No customers found. Add your first customer above.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer: { id: string; name: string; type: string; contactName: string | null; phone: string | null }) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{customer.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.contactName || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.phone || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <form action={deleteCustomerAction}>
                            <input type="hidden" name="id" value={customer.id} />
                            <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Server action wrappers for deletions (consume FormData from <form action={...}>)
async function deleteStoreAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  await deleteStore(id);
  redirect('/admin');
}

async function deleteCategoryAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  await deleteCategory(id);
  redirect('/admin');
}

async function deleteItemAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  await deleteItem(id);
  redirect('/admin');
}

async function deleteCustomerAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  await deleteCustomer(id);
  redirect('/admin');
}

async function addStore(formData: FormData) {
  'use server';

  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }

  const name = String(formData.get('name'));
  const slug = String(formData.get('slug'));
  let apiKey = String(formData.get('apiKey') || '');
  if (!apiKey) {
    apiKey = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
  await prisma.store.create({
    data: { name, slug, apiKey },
  });
  redirect('/admin');
}

async function addItem(formData: FormData) {
  'use server';

  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }

  const categoryId = String(formData.get('categoryId'));
  const name = String(formData.get('name'));
  const target = String(formData.get('target') || '');
  await prisma.item.create({
    data: { name, categoryId, targetText: target || null },
  });
  redirect('/admin');
}

async function addIngredient(formData: FormData) {
  'use server';
  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }
  const name = String(formData.get('name'));
  const target = String(formData.get('target') || '');
  const unit = String(formData.get('unit') || '');
  
  // Get or create the Ingredients category
  let ingredientsCategory = await prisma.category.findFirst({
    where: { name: 'Ingredients' }
  });
  
  if (!ingredientsCategory) {
    ingredientsCategory = await prisma.category.create({
      data: { name: 'Ingredients', sortOrder: 10 }
    });
  }
  
  await prisma.item.create({
    data: { 
      name, 
      categoryId: ingredientsCategory.id, 
      targetText: target || null,
      unit: unit || null
    },
  });
  redirect('/admin');
}

async function addCustomer(formData: FormData) {
  'use server';
  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }
  const name = String(formData.get('name'));
  const type = String(formData.get('type') || 'restaurant');
  const contactName = String(formData.get('contactName') || '');
  const phone = String(formData.get('phone') || '');
  await prisma.customer.create({
    data: {
      name,
      type,
      contactName: contactName || null,
      phone: phone || null
    },
  });
  redirect('/admin');
}

async function deleteStore(id: string) {
  'use server';
  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }
  try {
    await prisma.store.delete({ where: { id } });
  } catch (error) {
    console.error('Failed to delete store:', error);
    throw new Error('Cannot delete store. It may have associated stocktakes or delivery plans.');
  }
}

async function deleteCategory(id: string) {
  'use server';
  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }
  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    console.error('Failed to delete category:', error);
    throw new Error('Cannot delete category. It may contain items that are in use.');
  }
}

async function deleteItem(id: string) {
  'use server';
  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }
  try {
    await prisma.item.delete({ where: { id } });
  } catch (error) {
    console.error('Failed to delete item:', error);
    throw new Error('Cannot delete item. It may be referenced in stocktakes or delivery plans.');
  }
}

async function deleteCustomer(id: string) {
  'use server';
  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    redirect('/login');
  }

  const user = AuthService.verifyToken(token);
  if (
    !user ||
    (!AuthService.hasRole(user, 'admin') &&
      !AuthService.hasRole(user, 'system_admin'))
  ) {
    redirect('/login');
  }
  try {
    await prisma.customer.delete({ where: { id } });
  } catch (error) {
    console.error('Failed to delete customer:', error);
    throw new Error('Cannot delete customer. They may be referenced in delivery plans.');
  }
}
