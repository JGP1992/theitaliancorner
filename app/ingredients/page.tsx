import { prisma } from '@/app/lib/prisma';
import Link from 'next/link';

type Ingredient = {
  id: string;
  name: string;
  targetText: string | null;
  targetNumber: number | null;
  unit: string | null;
  isActive: boolean;
};

export default async function IngredientsPage() {
  let ingredients: Ingredient[] = [];
  
  try {
    ingredients = await prisma.item.findMany({
      where: {
        category: { name: 'Ingredients' },
        isActive: true
      },
      include: { category: true },
      orderBy: { sortOrder: 'asc' }
    });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    // Return empty array if database is not available
    ingredients = [];
  }

  // Group ingredients by type
  const baseIngredients = ingredients.filter((i: Ingredient) =>
    ['Whole Milk', 'Heavy Cream', 'Sugar', 'Salt', 'Stabilizer Blend', 'Emulsifier'].includes(i.name)
  );

  const flavorings = ingredients.filter((i: Ingredient) =>
    ['Vanilla Extract', 'Cocoa Powder', 'Coffee Extract'].includes(i.name) ||
    i.name.includes('Puree') || i.name.includes('Paste') || i.name.includes('Sauce')
  );

  const fruits = ingredients.filter((i: Ingredient) =>
    i.name.includes('Puree') && !i.name.includes('Passion') ||
    ['Banana Puree', 'Pineapple Puree', 'Peach Puree', 'Blueberry Puree', 'Raspberry Puree'].includes(i.name)
  );

  const specialty = ingredients.filter((i: Ingredient) =>
    ['Coconut Milk', 'Pistachio Paste', 'Hazelnut Paste', 'Caramel Sauce'].includes(i.name)
  );

  const categories = [
    { name: 'Base Ingredients', ingredients: baseIngredients, color: 'bg-blue-50 border-blue-200', icon: '🥛' },
    { name: 'Flavorings', ingredients: flavorings, color: 'bg-green-50 border-green-200', icon: '🧪' },
    { name: 'Fruits', ingredients: fruits, color: 'bg-orange-50 border-orange-200', icon: '🍓' },
    { name: 'Specialty', ingredients: specialty, color: 'bg-purple-50 border-purple-200', icon: '⭐' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ingredients</h1>
              <p className="mt-2 text-gray-600">Manage your gelato production ingredients and raw materials</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/admin"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Full Admin
              </Link>
              <Link
                href="/factory"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Factory Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Ingredient Stats */}
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
                <p className="text-sm font-medium text-gray-600">Total Ingredients</p>
                <p className="text-2xl font-bold text-gray-900">{ingredients.length}</p>
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
                <p className="text-sm font-medium text-gray-600">Base Ingredients</p>
                <p className="text-2xl font-bold text-gray-900">{baseIngredients.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Fruit Ingredients</p>
                <p className="text-2xl font-bold text-gray-900">{fruits.length}</p>
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
                <p className="text-sm font-medium text-gray-600">Specialty Items</p>
                <p className="text-2xl font-bold text-gray-900">{specialty.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ingredient Categories */}
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category.name} className={`${category.color} rounded-lg border p-6`}>
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">{category.icon}</span>
                <h2 className="text-xl font-semibold text-gray-900">{category.name}</h2>
                <span className="ml-2 px-2 py-1 bg-white bg-opacity-50 rounded-full text-sm font-medium">
                  {category.ingredients.length} ingredients
                </span>
              </div>

              {category.ingredients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No ingredients in this category yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {category.ingredients.map((ingredient: Ingredient) => (
                    <div key={ingredient.id} className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">{ingredient.name}</h3>
                        {ingredient.targetText && (
                          <p className="text-sm text-gray-600">
                            Target: {ingredient.targetText}
                            {ingredient.unit && ` ${ingredient.unit}`}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
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
                <h3 className="font-medium text-gray-900">Check Production Needs</h3>
                <p className="text-sm text-gray-600">View ingredient requirements for upcoming deliveries</p>
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
                <h3 className="font-medium text-gray-900">Manage Stock Levels</h3>
                <p className="text-sm text-gray-600">Update ingredient targets and current stock</p>
              </div>
            </Link>

            <div className="flex items-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Usage Analytics</h3>
                <p className="text-sm text-gray-600">Track ingredient consumption and costs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
