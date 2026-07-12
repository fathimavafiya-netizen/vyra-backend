import prisma from '../config/db';

export class SessionRepository {
  async create(data: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    appVersion?: string;
    familyId?: string;
  }) {
    return prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || 'unknown',
        deviceId: data.deviceId || 'unknown',
        deviceName: data.deviceName || 'unknown',
        platform: data.platform || 'WEB',
        appVersion: data.appVersion || '1.0.0',
        familyId: data.familyId || 'unknown',
      },
    });
  }

  async findByHash(refreshTokenHash: string) {
    return prisma.session.findUnique({
      where: { refreshTokenHash },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });
  }

  async invalidateByHash(refreshTokenHash: string) {
    return prisma.session.update({
      where: { refreshTokenHash },
      data: { isValid: false },
    });
  }

  async invalidateAllUserSessions(userId: string) {
    return prisma.session.updateMany({
      where: { userId, isValid: true },
      data: { isValid: false },
    });
  }
}

export default new SessionRepository();
