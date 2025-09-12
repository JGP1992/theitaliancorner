import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

interface ProductionIngredientInput {
  itemId: string;
  quantityUsed: number;
  unit: string;
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

    // Check if user has permission to create productions
    if (!AuthService.hasPermission(user, 'productions:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { recipeId, batchSize, batchUnit, ingredients }: {
      recipeId: string;
      batchSize: number;
      batchUnit?: string;
      ingredients: ProductionIngredientInput[];
    } = body;

    if (!recipeId || !batchSize || !ingredients) {
      return NextResponse.json(
        { error: 'Recipe ID, batch size, and ingredients are required' },
        { status: 400 }
      );
    }

    // Create production record
    const production = await prisma.production.create({
      data: {
        recipeId,
        batchSize,
        batchUnit: batchUnit || 'kg',
        ingredients: {
          create: ingredients.map((ing: ProductionIngredientInput) => ({
            itemId: ing.itemId,
            quantityUsed: ing.quantityUsed,
            unit: ing.unit
          }))
        }
      },
      include: {
        recipe: true,
        ingredients: {
          include: {
            item: true
          }
        }
      }
    });

    return NextResponse.json(production, { status: 201 });
  } catch (error) {
    console.error('Failed to create production:', error);
    return NextResponse.json(
      { error: 'Failed to create production' },
      { status: 500 }
    );
  }
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

    // Check if user has permission to read productions
    if (!AuthService.hasPermission(user, 'productions:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const productions = await prisma.production.findMany({
      include: {
        recipe: true,
        ingredients: {
          include: {
            item: true
          }
        }
      },
      orderBy: { producedAt: 'desc' }
    });

    return NextResponse.json(productions);
  } catch (error) {
    console.error('Failed to fetch productions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch productions' },
      { status: 500 }
    );
  }
}
