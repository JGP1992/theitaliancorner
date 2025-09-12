import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { Prisma } from '@prisma/client';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { email, firstName, lastName, roleIds }: {
      email: string;
      firstName: string;
      lastName: string;
      roleIds?: string[];
    } = body;

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, firstName, and lastName are required' },
        { status: 400 }
      );
    }

    // Check if another user with this email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: id }
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Another user with this email already exists' },
        { status: 409 }
      );
    }

    // Update user and roles in a transaction
    const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update user basic info
      await tx.user.update({
        where: { id: id },
        data: {
          email,
          firstName,
          lastName,
        },
      });

      // Delete existing role assignments
      await tx.userRole.deleteMany({
        where: { userId: id }
      });

      // Create new role assignments
      if (roleIds && roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId: string) => ({
            userId: id,
            roleId
          }))
        });
      }

      // Return updated user with roles
      return await tx.user.findUnique({
        where: { id: id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.user.update({
      where: { id: id },
      data: { isActive: false }
    });

    return NextResponse.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
