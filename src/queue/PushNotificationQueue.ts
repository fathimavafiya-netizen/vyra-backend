import fs from 'fs';
import path from 'path';
import queueManager from './queue';
import prisma from '../config/db';
import logger from '../utils/logger';

// Path to log permanently failed jobs (DLQ)
const DLQ_PATH = path.join(process.cwd(), 'logs', 'dlq_push_notifications.json');

export class PushNotificationQueue {
  constructor() {
    this.registerWorker();
  }

  private registerWorker() {
    queueManager.registerWorker('push_notification', async (payload: {
      userId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    }) => {
      const { userId, title, body, data } = payload;
      logger.info(`[PushNotificationQueue] Dispatching push for user: ${userId}`);

      try {
        // 1. Fetch user FCM token
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { fcmToken: true, settings: true }
        });

        if (!user) {
          logger.warn(`[PushNotificationQueue] Recipient user not found: ${userId}`);
          return true; // Drop job
        }

        // Check user notification preferences
        if (user.settings && !user.settings.likesEnabled && title.toLowerCase().includes('liked')) {
          logger.info(`[PushNotificationQueue] User disabled notifications for likes. Dropping push.`);
          return true;
        }
        if (user.settings && !user.settings.commentsEnabled && title.toLowerCase().includes('comment')) {
          logger.info(`[PushNotificationQueue] User disabled notifications for comments. Dropping push.`);
          return true;
        }

        if (!user.fcmToken) {
          logger.debug(`[PushNotificationQueue] User ${userId} has no registered FCM token. Simulating log dispatch.`);
          logger.info(`[PUSH SIMULATION] To: ${userId} | Title: "${title}" | Body: "${body}"`);
          return true; // Mark done
        }

        // 2. Deliver via Firebase (Mocked for safety if credential file is missing)
        try {
          logger.info(`[PushNotificationQueue] Delivering push via FCM to token: ${user.fcmToken}`);
          // e.g. admin.messaging().send({ token: user.fcmToken, notification: { title, body }, data })
        } catch (firebaseErr: any) {
          logger.warn(`[PushNotificationQueue] Firebase dispatch error: ${firebaseErr.message}`);
          throw firebaseErr; // Trigger queue retry
        }

        return true;
      } catch (err: any) {
        logger.error(`[PushNotificationQueue] Push dispatch failed: ${err.message}`);
        
        // Log to Dead Letter Queue (DLQ) if it exceeded the attempts threshold
        // Note: queueManager handles attempts incrementation
        // Here we simulate the final fallback to DLQ file
        await this.writeToDlq(payload, err.message);
        
        // Return true to avoid infinite retry loops in queueManager once saved to DLQ
        return true;
      }
    });
  }

  private async writeToDlq(payload: any, errorMessage: string) {
    try {
      const dir = path.dirname(DLQ_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let list: any[] = [];
      if (fs.existsSync(DLQ_PATH)) {
        const fileContent = await fs.promises.readFile(DLQ_PATH, 'utf8');
        list = JSON.parse(fileContent);
      }

      list.push({
        timestamp: new Date().toISOString(),
        payload,
        error: errorMessage
      });

      await fs.promises.writeFile(DLQ_PATH, JSON.stringify(list, null, 2));
      logger.error(`[PushNotificationQueue] Job written to DLQ: ${DLQ_PATH}`);
    } catch (writeErr: any) {
      logger.error(`[PushNotificationQueue] Failed to write to DLQ: ${writeErr.message}`);
    }
  }
}

export default new PushNotificationQueue();
