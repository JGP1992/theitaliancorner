import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    const count = await prisma.stocktake.count();
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching stocktake count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stocktake count' },
      { status: 500 }
    );
  }
}
