import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../app/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { AuthService } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const {
      currentPassword,
      newPassword,
    }: {
      currentPassword?: string;
      newPassword: string;
    } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

  const { id } = await params;

    // Authenticate actor
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const actor = AuthService.verifyToken(token);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user
    const targetUser = await prisma.user.findUnique({
      where: { id: id, isActive: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Basic rate limiting using recent attempts in AuditLog (max 5 per 10 minutes per actor/target)
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const attempts = await prisma.auditLog.count({
      where: {
        action: 'user.password.update_attempt',
        resource: 'user',
        userId: actor.id,
        resourceId: id,
        createdAt: { gte: tenMinAgo }
      }
    });
    if (attempts >= 5) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        userEmail: actor.email,
        action: 'user.password.update_attempt',
        resource: 'user',
        resourceId: id,
        metadata: { self: actor.id === id },
        ip,
        userAgent,
      }
    });

    const isSelf = actor.id === id;
    // Authorization: self must provide currentPassword; otherwise require admin/system_admin or users:update permission
    if (isSelf) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change your own password' },
          { status: 400 }
        );
      }
      const isValidPassword = await bcrypt.compare(currentPassword, targetUser.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        );
      }
    } else {
      const isAdmin = AuthService.hasRole(actor, 'admin') || AuthService.hasRole(actor, 'system_admin') || AuthService.hasPermission(actor, 'users:update');
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update the password
    await prisma.user.update({
      where: { id: id },
      data: { password: hashedNewPassword }
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        userEmail: actor.email,
        action: 'user.password.updated',
        resource: 'user',
        resourceId: id,
        metadata: { self: isSelf },
        ip,
        userAgent,
      }
    });

    return NextResponse.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    );
  }
}
