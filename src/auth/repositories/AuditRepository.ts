import prisma from '../../config/db';

export class AuditRepository {
  async log(data: {
    userId: string | null;
    action: string;
    severity: string;
    ipAddress: string | null;
    deviceId: string | null;
    userAgent: string | null;
    status: string;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        severity: data.severity,
        ipAddress: data.ipAddress,
        deviceId: data.deviceId,
        userAgent: data.userAgent,
        status: data.status,
      },
    });
  }

  async deleteBefore(cutoff: Date) {
    return prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });
  }
}

export default new AuditRepository();
