import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  const start = Date.now();
  try {
    // lightweight DB check
    await prisma.$queryRawUnsafe('SELECT 1');
    const ms = Date.now() - start;
    return NextResponse.json({ ok: true, db: true, ms });
  } catch (e: any) {
    const ms = Date.now() - start;
    return NextResponse.json({ ok: false, db: false, ms, error: e?.message }, { status: 500 });
  }
}
