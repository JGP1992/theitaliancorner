import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';
import { logAudit } from '../../../lib/audit';

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
  if (!AuthService.hasPermission(user, 'production:create')) {
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

    // Inventory impact: create a factory stocktake that deducts used ingredients
    // Choose factory store (prefer slug 'factory', else first available)
    const stores = await prisma.store.findMany({ take: 1 });
    if (stores.length === 0) {
      // No stores configured; still return production but report missing inventory context
      return NextResponse.json(production, { status: 201 });
    }
    const factoryStore = (await prisma.store.findFirst({ where: { slug: 'factory' } })) || stores[0];

    // Create a stocktake with negative quantities to represent consumption
    const stocktake = await prisma.stocktake.create({
      data: {
        storeId: factoryStore.id,
        date: new Date(),
        notes: `Production usage for recipe ${production.recipe.name} (batch ${batchSize} ${production.batchUnit})`,
        items: {
          create: production.ingredients.map((pi) => ({
            itemId: pi.itemId,
            quantity: -Math.abs(pi.quantityUsed),
            note: `Used in production ${production.id}`
          }))
        }
      }
    });

    // Audit log for production and inventory impact
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'create',
      resource: 'production',
      resourceId: production.id,
      metadata: { batchSize, batchUnit: production.batchUnit, recipeId, stocktakeId: stocktake.id },
      ip: request.headers.get('x-forwarded-for') || (request as any).ip || null,
      userAgent: request.headers.get('user-agent'),
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
  if (!AuthService.hasPermission(user, 'production:read')) {
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
