import prisma from '../../config/db';

export class SessionRepository {
  async create(data: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress: string;
    userAgent: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    appVersion: string;
    familyId: string;
  }) {
    return prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        platform: data.platform,
        appVersion: data.appVersion,
        familyId: data.familyId,
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

  async findById(id: string) {
    return prisma.session.findUnique({
      where: { id },
    });
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return prisma.session.count({
      where: { userId, isValid: true, expiresAt: { gt: new Date() } },
    });
  }

  async findActiveByUserId(userId: string) {
    return prisma.session.findMany({
      where: { userId, isValid: true, expiresAt: { gt: new Date() } },
      orderBy: { lastActive: 'asc' },
    });
  }

  async updateLastActive(id: string) {
    return prisma.session.update({
      where: { id },
      data: { lastActive: new Date() },
    });
  }

  async invalidate(id: string) {
    return prisma.session.update({
      where: { id },
      data: { isValid: false },
    });
  }

  async invalidateMany(ids: string[]) {
    return prisma.session.updateMany({
      where: { id: { in: ids } },
      data: { isValid: false },
    });
  }

  async invalidateAllOtherSessions(userId: string, currentSessionId: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        isValid: true,
      },
      data: { isValid: false },
    });
  }

  async invalidateFamily(familyId: string) {
    return prisma.session.updateMany({
      where: { familyId, isValid: true },
      data: { isValid: false },
    });
  }
}

export default new SessionRepository();
