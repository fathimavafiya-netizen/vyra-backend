import prisma from '../config/db';
import logger from './logger';
import { env } from '../config/env';
import fs from 'fs';
import os from 'os';
import path from 'path';

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
      const isConnectivityError = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].some(
        code => err.message?.includes(code)
      );
      if (isConnectivityError) {
        logger.warn(`[CRON] OTP/Story cleanup skipped — database unreachable: ${err.message?.split('\n')[0]}`);
      } else {
        logger.error(`[CRON] OTP/Story cleanup failed: ${err.message}`);
      }
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
      const isConnectivityError = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].some(
        code => err.message?.includes(code)
      );
      if (isConnectivityError) {
        logger.warn(`[CRON] Session cleanup skipped — database unreachable: ${err.message?.split('\n')[0]}`);
      } else {
        logger.error(`[CRON] Session cleanup failed: ${err.message}`);
      }
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
      const isConnectivityError = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].some(
        code => err.message?.includes(code)
      );
      if (isConnectivityError) {
        logger.warn(`[CRON] Daily cleanup skipped — database unreachable: ${err.message?.split('\n')[0]}`);
      } else {
        logger.error(`[CRON] Daily cleanup failed: ${err.message}`);
      }
    }
  }, 24 * 60 * 60 * 1000);

  // 4. Every hour: Clean up stale temporary files
  setInterval(async () => {
    try {
      const tmpDir = os.tmpdir();
      const files = await fs.promises.readdir(tmpDir);
      
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (file.startsWith('sociall-upload-') || file.startsWith('sociall-processed-')) {
          const filePath = path.join(tmpDir, file);
          try {
            const stats = await fs.promises.stat(filePath);
            if (now - stats.mtimeMs > ONE_HOUR) {
              await fs.promises.unlink(filePath);
              deletedCount++;
            }
          } catch (statErr) {
            // Ignore stat/unlink errors for individual files
          }
        }
      }

      if (deletedCount > 0) {
        logger.info(`[CRON] Cleaned ${deletedCount} stale temporary media files.`);
      }
    } catch (err: any) {
      logger.error(`[CRON] Temp file cleanup failed: ${err.message}`);
    }
  }, 60 * 60 * 1000);
};

export default {
  startCleanupScheduler,
};
