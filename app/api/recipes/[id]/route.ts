import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

interface RecipeIngredientInput {
  itemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            item: true
          }
        }
      }
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Failed to fetch recipe:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { name, description, category, ingredients }: {
      name: string;
      description?: string;
      category?: string;
      ingredients: RecipeIngredientInput[];
    } = body;
    const { id } = await params;

    if (!name) {
      return NextResponse.json(
        { error: 'Recipe name is required' },
        { status: 400 }
      );
    }

    // Delete existing ingredients
    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: id }
    });

    // Update recipe with new data
    const recipe = await prisma.recipe.update({
      where: { id },
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

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Failed to update recipe:', error);
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if recipe is used in any productions
    const productionCount = await prisma.production.count({
      where: { recipeId: id }
    });

    if (productionCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete recipe that has been used in production' },
        { status: 400 }
      );
    }

    await prisma.recipe.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    );
  }
}
