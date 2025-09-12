'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChefHat } from 'lucide-react';

interface Recipe {
  id: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  ingredients: RecipeIngredient[];
}

interface RecipeIngredient {
  id: string;
  item: {
    id: string;
    name: string;
  };
  quantity: number;
  unit: string;
  notes?: string;
}

interface Item {
  id: string;
  name: string;
  category: {
    name: string;
  };
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    loadRecipes();
    loadItems();
  }, []);

  const loadRecipes = async () => {
    try {
      const response = await fetch('/api/recipes');
      if (response.ok) {
        const data = await response.json();
        setRecipes(data);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const response = await fetch('/api/items');
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRecipes(recipes.filter(r => r.id !== recipeId));
      } else {
        const error = await response.json();
        alert(`Failed to delete recipe: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      alert('Failed to delete recipe');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-blue-600" />
            Recipe Builder
          </h1>
          <p className="text-gray-600 mt-2">Create and manage gelato recipes</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Recipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map((recipe) => (
          <div key={recipe.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{recipe.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{recipe.category}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingRecipe(recipe)}
                  className="text-blue-600 hover:text-blue-800 p-1"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteRecipe(recipe.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {recipe.description && (
              <p className="text-gray-600 mb-4">{recipe.description}</p>
            )}

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Ingredients:</h4>
              {recipe.ingredients.map((ingredient) => (
                <div key={ingredient.id} className="flex justify-between text-sm">
                  <span>{ingredient.item.name}</span>
                  <span className="text-gray-500">
                    {ingredient.quantity} {ingredient.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                Produce Batch
              </button>
            </div>
          </div>
        ))}
      </div>

      {recipes.length === 0 && (
        <div className="text-center py-12">
          <ChefHat className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No recipes yet</h3>
          <p className="text-gray-500 mb-4">Create your first gelato recipe to get started</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Create Recipe
          </button>
        </div>
      )}

      {showCreateForm && (
        <RecipeForm
          items={items}
          onClose={() => setShowCreateForm(false)}
          onSave={() => {
            setShowCreateForm(false);
            loadRecipes();
          }}
        />
      )}

      {editingRecipe && (
        <RecipeForm
          recipe={editingRecipe}
          items={items}
          onClose={() => setEditingRecipe(null)}
          onSave={() => {
            setEditingRecipe(null);
            loadRecipes();
          }}
        />
      )}
    </div>
  );
}

interface RecipeFormProps {
  recipe?: Recipe;
  items: Item[];
  onClose: () => void;
  onSave: () => void;
}

function RecipeForm({ recipe, items, onClose, onSave }: RecipeFormProps) {
  const [formData, setFormData] = useState({
    name: recipe?.name || '',
    description: recipe?.description || '',
    category: recipe?.category || 'gelato',
    ingredients: recipe?.ingredients || []
  });

  const [newIngredient, setNewIngredient] = useState({
    itemId: '',
    quantity: '',
    unit: 'kg',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = recipe ? `/api/recipes/${recipe.id}` : '/api/recipes';
      const method = recipe ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.json();
        alert(`Failed to save recipe: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to save recipe:', error);
      alert('Failed to save recipe');
    }
  };

  const addIngredient = () => {
    if (!newIngredient.itemId || !newIngredient.quantity) return;

    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, {
        id: Date.now().toString(),
        item: items.find(i => i.id === newIngredient.itemId)!,
        quantity: parseFloat(newIngredient.quantity),
        unit: newIngredient.unit,
        notes: newIngredient.notes
      }]
    });

    setNewIngredient({ itemId: '', quantity: '', unit: 'kg', notes: '' });
  };

  const removeIngredient = (index: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {recipe ? 'Edit Recipe' : 'Create New Recipe'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipe Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="gelato">Gelato</option>
                <option value="sorbet">Sorbet</option>
                <option value="granita">Granita</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Ingredients
              </label>

              <div className="space-y-3 mb-4">
                {formData.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="flex-1">{ingredient.item.name}</span>
                    <span className="text-sm text-gray-600">
                      {ingredient.quantity} {ingredient.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select
                  value={newIngredient.itemId}
                  onChange={(e) => setNewIngredient({ ...newIngredient, itemId: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Ingredient</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Quantity"
                  value={newIngredient.quantity}
                  onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />

                <select
                  value={newIngredient.unit}
                  onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="cups">cups</option>
                  <option value="tbsp">tbsp</option>
                  <option value="tsp">tsp</option>
                </select>

                <button
                  type="button"
                  onClick={addIngredient}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                {recipe ? 'Update Recipe' : 'Create Recipe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
