import { Request } from 'express';
import auditRepository from '../repositories/AuditRepository';
import logger from '../../utils/logger';

export interface AuditLogPayload {
  userId?: string | null;
  action: string;
  severity: 'INFO' | 'WARNING' | 'SECURITY' | 'CRITICAL';
  status: string;
  req?: Request;
  ipAddress?: string;
  deviceId?: string;
  userAgent?: string;
}

export class AuditService {
  async logEvent(data: AuditLogPayload) {
    try {
      const ip = data.ipAddress || data.req?.ip || data.req?.socket?.remoteAddress || null;
      const ua = data.userAgent || data.req?.get('user-agent') || null;
      const deviceId = data.deviceId || data.req?.body?.deviceId || data.req?.get('x-device-id') || null;

      await auditRepository.log({
        userId: data.userId || null,
        action: data.action,
        severity: data.severity,
        ipAddress: ip,
        deviceId,
        userAgent: ua,
        status: data.status,
      });

      logger.debug(`[AUDIT] Action=${data.action} Severity=${data.severity} Status=${data.status}`);
    } catch (err: any) {
      logger.error(`[AuditService] Failed to record audit log: ${err.message}`);
    }
  }
}

export default new AuditService();
