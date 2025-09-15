import { prisma } from '../app/lib/prisma';

type AuditParams = {
  userId?: string;
  userEmail?: string;
  action: string; // e.g., 'create', 'update', 'delete', 'receive'
  resource: string; // e.g., 'orders', 'inventory', 'deliveries'
  resourceId?: string;
  metadata?: Record<string, any>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function logAudit({ userId, userEmail, action, resource, resourceId, metadata, ip, userAgent }: AuditParams) {
  try {
  await (prisma as any).auditLog.create({
      data: {
        userId,
        userEmail,
        action,
        resource,
        resourceId,
        metadata: metadata ? (metadata as any) : undefined,
        ip: ip || undefined,
        userAgent: userAgent || undefined,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}
