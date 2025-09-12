import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

interface RecipeIngredientInput {
  itemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to read recipes
    if (!AuthService.hasPermission(user, 'recipes:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: {
          include: {
            item: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Failed to fetch recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create recipes
    if (!AuthService.hasPermission(user, 'recipes:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, category, ingredients }: {
      name: string;
      description?: string;
      category?: string;
      ingredients: RecipeIngredientInput[];
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Recipe name is required' },
        { status: 400 }
      );
    }

    const recipe = await prisma.recipe.create({
      data: {
        name,
        description,
        category: category || 'gelato',
        ingredients: {
          create: ingredients.map((ing: RecipeIngredientInput) => ({
            itemId: ing.itemId,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes
          }))
        }
      },
      include: {
        ingredients: {
          include: {
            item: true
          }
        }
      }
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error('Failed to create recipe:', error);
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    );
  }
}
