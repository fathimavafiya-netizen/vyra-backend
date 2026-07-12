import deviceRepository from '../repositories/DeviceRepository';
import { env } from '../../config/env';

export class DeviceService {
  /**
   * Registers or updates a device trusted profile mapping (90 days lifecycle)
   */
  async registerOrUpdateDevice(data: {
    userId: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    pushToken?: string;
    rememberDevice?: boolean;
  }) {
    const trustedDays = data.rememberDevice ? env.TRUSTED_DEVICE_DAYS : 7;
    return deviceRepository.upsertDevice({
      userId: data.userId,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      platform: data.platform,
      pushToken: data.pushToken,
      trustedDays,
    });
  }

  /**
   * Lists devices associated with user
   */
  async getDevicesByUser(userId: string) {
    return deviceRepository.findByUserId(userId);
  }

  /**
   * Revoke device trusted profile
   */
  async revokeDevice(userId: string, deviceId: string) {
    return deviceRepository.removeDevice(userId, deviceId);
  }
}

export default new DeviceService();
