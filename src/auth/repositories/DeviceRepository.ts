import prisma from '../../config/db';

export class DeviceRepository {
  async findByUserIdAndDeviceId(userId: string, deviceId: string) {
    return prisma.device.findUnique({
      where: {
        userId_deviceId: { userId, deviceId },
      },
    });
  }

  async upsertDevice(data: {
    userId: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    pushToken?: string;
    trustedDays: number;
  }) {
    const trustedUntil = new Date(Date.now() + data.trustedDays * 24 * 60 * 60 * 1000);

    return prisma.device.upsert({
      where: {
        userId_deviceId: { userId: data.userId, deviceId: data.deviceId },
      },
      update: {
        deviceName: data.deviceName,
        platform: data.platform,
        pushToken: data.pushToken || null,
        trustedUntil,
        lastLogin: new Date(),
      },
      create: {
        userId: data.userId,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        platform: data.platform,
        pushToken: data.pushToken || null,
        trustedUntil,
      },
    });
  }

  async findByUserId(userId: string) {
    return prisma.device.findMany({
      where: { userId },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    return prisma.device.delete({
      where: {
        userId_deviceId: { userId, deviceId },
      },
    });
  }
}

export default new DeviceRepository();
