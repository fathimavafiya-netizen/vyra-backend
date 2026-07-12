import queueManager from './queue';
import prisma from '../config/db';
import logger from '../utils/logger';
import notificationService from '../services/NotificationService';

export class LiveNotificationQueue {
  constructor() {
    this.registerWorker();
  }

  private registerWorker() {
    queueManager.registerWorker('live_started', async (payload: {
      hostId: string;
      liveStreamId: string;
      title: string;
    }) => {
      const { hostId, liveStreamId, title } = payload;
      logger.info(`[LiveNotificationQueue] Processing live_started fan-out for host: ${hostId}`);

      try {
        // 1. Fetch all followers of the host
        const followers = await prisma.follow.findMany({
          where: { followingId: hostId },
          select: { followerId: true }
        });

        if (followers.length === 0) {
          logger.info(`[LiveNotificationQueue] Host ${hostId} has no followers. No notifications sent.`);
          return true;
        }

        logger.info(`[LiveNotificationQueue] Fanning out notifications to ${followers.length} followers.`);

        // 2. Create notifications for all followers in batches of 50
        const batchSize = 50;
        for (let i = 0; i < followers.length; i += batchSize) {
          const batch = followers.slice(i, i + batchSize);
          await Promise.all(
            batch.map(f => 
              notificationService.createNotification({
                userId: f.followerId,
                actorId: hostId,
                type: 'LIVE_STARTED',
                targetType: 'LIVE',
                targetId: liveStreamId,
                referenceId: liveStreamId,
                message: `went live: "${title}"`
              }).catch(err => logger.error(`[LiveNotificationQueue] Failed for follower ${f.followerId}: ${err.message}`))
            )
          );
        }

        return true;
      } catch (err: any) {
        logger.error(`[LiveNotificationQueue] Fan-out failed: ${err.message}`);
        return false; // Trigger retry
      }
    });
  }
}

export default new LiveNotificationQueue();
