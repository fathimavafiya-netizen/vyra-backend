import prisma from '../config/db';
import logger from './logger';
import { env } from '../config/env';

/**
 * Initializes separated cleanup timers with specific intervals
 */
export const startCleanupScheduler = (): void => {
  logger.info('⏰ Starting Version 3.0 separate cleanup schedulers...');

  // 1. Every 5 minutes: Clean up expired or verified OTP records
  setInterval(async () => {
    try {
      const result = await prisma.otpVerification.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { verified: true },
          ],
        },
      });
      if (result.count > 0) {
        logger.info(`[CRON] Cleaned ${result.count} expired/verified OTP records.`);
      }

      // Clean up expired stories (expiresAt < now)
      const storiesResult = await prisma.story.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      });
      if (storiesResult.count > 0) {
        logger.info(`[CRON] Cleaned ${storiesResult.count} expired stories.`);
      }
    } catch (err: any) {
      logger.error(`[CRON] OTP/Story cleanup failed: ${err.message}`);
    }
  }, 5 * 60 * 1000);

  // 2. Every hour: Clean up expired or invalid sessions
  setInterval(async () => {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isValid: false },
          ],
        },
      });
      if (result.count > 0) {
        logger.info(`[CRON] Cleaned ${result.count} expired/invalid sessions.`);
      }
    } catch (err: any) {
      logger.error(`[CRON] Session cleanup failed: ${err.message}`);
    }
  }, 60 * 60 * 1000);

  // 3. Daily (every 24h): Clean up old audit logs and read notifications older than 30 days
  setInterval(async () => {
    try {
      const cutOffDate = new Date();
      cutOffDate.setDate(cutOffDate.getDate() - env.AUDIT_RETENTION_DAYS);

      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutOffDate },
        },
      });
      if (result.count > 0) {
        logger.info(`[CRON] Cleaned ${result.count} audit logs older than ${env.AUDIT_RETENTION_DAYS} days.`);
      }

      const notifCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const notifResult = await prisma.notification.deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: notifCutoff }
        }
      });
      if (notifResult.count > 0) {
        logger.info(`[CRON] Cleaned ${notifResult.count} read notifications older than 30 days.`);
      }
    } catch (err: any) {
      logger.error(`[CRON] Daily cleanup failed: ${err.message}`);
    }
  }, 24 * 60 * 60 * 1000);
};

export default {
  startCleanupScheduler,
};
