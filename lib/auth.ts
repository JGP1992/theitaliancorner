import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../app/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

interface JWTPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

interface UserRoleWithPermissions {
  role: {
    name: string;
    permissions: Array<{
      permission: {
        name: string;
      };
    }>;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions
      },
      JWT_SECRET as string,
      { expiresIn: '7d' }
    );
  }

  static verifyToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET as string) as JWTPayload;
      return {
        id: decoded.userId,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        roles: decoded.roles,
        permissions: decoded.permissions
      };
    } catch (error) {
      return null;
    }
  }

  static async getUserWithRolesAndPermissions(userId: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) return null;

    const roles = user.roles.map((ur: UserRoleWithPermissions) => ur.role.name);
    const permissions = user.roles.flatMap((ur: UserRoleWithPermissions) =>
      ur.role.permissions.map((rp) => rp.permission.name)
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions: [...new Set(permissions)] as string[] // Remove duplicates
    };
  }

  static async authenticateUser(email: string, password: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: { email, isActive: true }
    });

    if (!user) return null;

    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) return null;

    return this.getUserWithRolesAndPermissions(user.id);
  }

  static async createUser(email: string, password: string, firstName: string, lastName: string, roleIds: string[] = []): Promise<AuthUser | null> {
    const hashedPassword = await this.hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        roles: {
          create: roleIds.map(roleId => ({ roleId }))
        }
      }
    });

    return this.getUserWithRolesAndPermissions(user.id);
  }

  static hasPermission(user: AuthUser, permission: string): boolean {
    return user.permissions.includes(permission);
  }

  static hasRole(user: AuthUser, role: string): boolean {
    return user.roles.includes(role);
  }

  static hasAnyPermission(user: AuthUser, permissions: string[]): boolean {
    return permissions.some(permission => user.permissions.includes(permission));
  }

  static hasAnyRole(user: AuthUser, roles: string[]): boolean {
    return roles.some(role => user.roles.includes(role));
  }
}
