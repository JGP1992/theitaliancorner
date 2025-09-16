import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { AuthService } from '../../../../../lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'stores:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const preferences = (store as any).preferences ?? {};
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('GET /api/stores/[slug]/preferences error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'stores:manage_inventory')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { slug } = await params;
    const body = await req.json();
    // Expect partial preferences, e.g., { categoryVisibility: { [categoryId]: boolean } }
    const incoming = body && typeof body === 'object' ? body : {};
  const store = await prisma.store.findUnique({ where: { slug } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const existing = ((store as any).preferences ?? {}) as Record<string, any>;
    const updated = { ...existing, ...incoming };
  await prisma.store.update({ where: { id: store.id }, data: ({ preferences: updated } as any) });
    return NextResponse.json({ success: true, preferences: updated });
  } catch (error) {
    console.error('POST /api/stores/[slug]/preferences error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
