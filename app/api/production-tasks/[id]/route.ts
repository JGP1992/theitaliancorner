import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasAnyPermission(user, ['production:update', 'production:create'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, notes, assignedToUserId, start, complete, cancel } = body || {};

    const data: any = {};
    if (typeof notes === 'string') data.notes = notes;
    if (assignedToUserId !== undefined) data.assignedToUserId = assignedToUserId || null;

    const now = new Date();
    if (start) {
      data.status = 'IN_PROGRESS';
      data.startedAt = now;
      if (!data.assignedToUserId) data.assignedToUserId = user.id;
    }
    if (complete) {
      data.status = 'DONE';
      data.completedAt = now;
    }
    if (cancel) {
      data.status = 'CANCELLED';
    }
    if (status) data.status = status; // direct override if provided

    const updated = await (prisma as any).productionTask.update({
      where: { id },
      data,
      include: {
        item: { include: { category: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      }
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error('Error updating production task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
