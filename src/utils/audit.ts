import { Request } from 'express';
import prisma from '../config/db';
import logger from './logger';

export interface AuditLogData {
  userId?: string;
  action:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'OTP_GENERATED'
    | 'OTP_VERIFIED'
    | 'SESSION_REVOKED'
    | 'REFRESH_ROTATED'
    | 'ACCOUNT_LOCKED'
    | 'LOGOUT'
    | 'PASSWORD_RESET';
  severity: 'INFO' | 'WARNING' | 'SECURITY' | 'CRITICAL';
  status: string;
  req?: Request;
  ipAddress?: string;
  deviceId?: string;
  userAgent?: string;
}

/**
 * Creates a structured audit log event in the database
 */
export const logAuditEvent = async (data: AuditLogData): Promise<void> => {
  try {
    const ip = data.ipAddress || data.req?.ip || data.req?.socket?.remoteAddress || null;
    const ua = data.userAgent || data.req?.get('user-agent') || null;
    const deviceId = data.deviceId || data.req?.body?.deviceId || data.req?.get('x-device-id') || null;

    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        severity: data.severity,
        ipAddress: ip,
        deviceId,
        userAgent: ua,
        status: data.status,
      },
    });

    logger.debug(`[AUDIT LOG] Action: ${data.action}, Severity: ${data.severity}, Status: ${data.status}`);
  } catch (err: any) {
    logger.error(`Failed to create audit log: ${err.message}`);
  }
};

export default {
  logAuditEvent,
};
