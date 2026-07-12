import prisma from '../config/db';
import { onlineUsers } from '../socket/state';
import { NotificationType, NotificationChannel } from '../config/constants';
import logger from '../utils/logger';
import fcm from '../utils/fcm';

export interface NotificationPayload {
  userId: string;
  type: string; // one of NotificationType values
  title: string;
  message: string;
  referenceId?: string;
}

/**
 * NotificationService — central notification pipeline
 *
 * Flow:
 *   Caller (ChatService, StoryService, etc.)
 *     ↓
 *   NotificationService.send(payload)
 *     ↓
 *   DB: Notification.create()
 *     ↓
 *   Socket: emit to onlineUsers socketId  (if online)
 *     ↓
 *   Push: Expo / FCM via Device.deviceToken  (if offline or push enabled)
 */
export class NotificationService {
  /** io is injected once at server startup by socket/index.ts */
  private io: any = null;

  setIo(io: any) {
    this.io = io;
  }

  async getNotifications(userId: string, limit?: number, cursor?: string) {
    const take = limit ?? 20;
    const cursorCondition = cursor ? { id: cursor } : undefined;

    return prisma.notification.findMany({
      where: { userId },
      include: {
        actor: {
          include: {
            profile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursorCondition,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId },
      data: { isRead: true },
    });
  }

  async delete(userId: string, notificationId: string) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  /**
   * createNotification() — the upgraded entry point for all notification types.
   * Persists to DB, emits to user socket room, and triggers push.
   */
  async createNotification(payload: {
    userId: string;
    actorId?: string;
    type: string;
    targetType?: string;
    targetId?: string;
    title?: string;
    message?: string;
    referenceId?: string;
  }) {
    const { userId, actorId, type, targetType, targetId, title, message, referenceId } = payload;

    // 1. Self-action guard: don't notify users of their own actions
    if (actorId && userId === actorId) {
      logger.debug(`Self-action notification suppressed: userId=${userId}, type=${type}`);
      return null;
    }

    try {
      // 2. Deduplication check: check if a notification with same actor, type, and target was created in the last 10 seconds
      if (actorId && targetId) {
        const tenSecondsAgo = new Date(Date.now() - 10000);
        const recent = await prisma.notification.findFirst({
          where: {
            userId,
            actorId,
            type,
            targetId,
            createdAt: { gte: tenSecondsAgo }
          }
        });
        if (recent) {
          logger.debug(`Duplicate notification suppressed: userId=${userId}, type=${type}, targetId=${targetId}`);
          return recent;
        }
      }

      // 3. Check user preferences
      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      if (settings) {
        const enabled = this.isEnabledBySettings(type, settings);
        if (!enabled) {
          logger.debug(`🔕 Notification suppressed by preferences: type=${type}, user=${userId}`);
          return null;
        }
      }

      // Generate default title/message if not provided
      let finalTitle = title || 'Notification';
      let finalMessage = message || '';

      if (!message && actorId) {
        const actorUser = await prisma.user.findUnique({
          where: { id: actorId },
          include: { profile: true }
        });
        const actorName = actorUser?.profile?.name || actorUser?.username || 'Someone';
        
        switch (type) {
          case 'LIKE':
          case 'POST_LIKE':
            finalTitle = 'New Like';
            finalMessage = `${actorName} liked your post.`;
            break;
          case 'COMMENT':
          case 'POST_COMMENT':
            finalTitle = 'New Comment';
            finalMessage = `${actorName} commented on your post.`;
            break;
          case 'COMMENT_REPLY':
            finalTitle = 'Reply to Comment';
            finalMessage = `${actorName} replied to your comment.`;
            break;
          case 'POST_REPOST':
            finalTitle = 'New Repost';
            finalMessage = `${actorName} reposted your post.`;
            break;
          case 'FOLLOW':
          case 'NEW_FOLLOWER':
            finalTitle = 'New Follower';
            finalMessage = `${actorName} started following you.`;
            break;
          case 'FOLLOW_REQUEST':
            finalTitle = 'Follow Request';
            finalMessage = `${actorName} requested to follow you.`;
            break;
          case 'FOLLOW_ACCEPTED':
            finalTitle = 'Follow Request Accepted';
            finalMessage = `${actorName} accepted your follow request.`;
            break;
          case 'STORY_LIKE':
            finalTitle = 'Story Liked';
            finalMessage = `${actorName} liked your story.`;
            break;
          case 'STORY_REACTION':
            finalTitle = 'Story Reaction';
            finalMessage = `${actorName} reacted to your story.`;
            break;
          case 'STORY_REPLY':
            finalTitle = 'Story Reply';
            finalMessage = `${actorName} replied to your story.`;
            break;
          case 'STORY_MENTION':
          case 'POST_MENTION':
          case 'MENTION':
            finalTitle = 'You were mentioned!';
            finalMessage = `${actorName} mentioned you.`;
            break;
          case 'LIVE_STARTED':
            finalTitle = 'Live Stream';
            finalMessage = `${actorName} went live.`;
            break;
          default:
            break;
        }
      }

      // 4. Persist notification to DB
      const notification = await prisma.notification.create({
        data: {
          userId,
          actorId,
          type,
          targetType,
          targetId,
          title: finalTitle,
          message: finalMessage,
          referenceId,
          isRead: false
        },
        include: {
          actor: {
            include: {
              profile: true
            }
          }
        }
      });

      // 5. Real-time socket emit to the user's room
      if (this.io) {
        this.io.to(`user:${userId}`).emit('receive_notification', {
          ...notification,
          createdAt: notification.createdAt.toISOString(),
        });
        logger.info(`🔔 Real-time notification delivered: type=${type}, user=${userId}`);
      }

      // 6. Push notification (Expo or FCM)
      await this.sendPush({
        userId,
        type,
        title: finalTitle,
        message: finalMessage,
        referenceId: referenceId || targetId
      });

      return notification;
    } catch (e: any) {
      logger.error(`NotificationService.createNotification error: ${e.message}`);
      return null;
    }
  }

  /**
   * send() — legacy wrapper for compatibility.
   */
  async send(payload: NotificationPayload) {
    return this.createNotification({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      referenceId: payload.referenceId,
      targetId: payload.referenceId
    });
  }

  // Legacy alias — used by existing callers
  async sendNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    referenceId?: string,
  ) {
    return this.createNotification({
      userId,
      type,
      title,
      message,
      referenceId,
      targetId: referenceId
    });
  }

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────

  private isEnabledBySettings(type: string, settings: any): boolean {
    switch (type) {
      case 'LIKE':
      case 'POST_LIKE':
      case 'STORY_LIKE':
        return settings.likesEnabled;
      case 'COMMENT':
      case 'POST_COMMENT':
      case 'COMMENT_REPLY':
        return settings.commentsEnabled;
      case 'FOLLOW':
      case 'NEW_FOLLOWER':
      case 'FOLLOW_REQUEST':
      case 'FOLLOW_ACCEPTED':
        return settings.followersEnabled;
      case 'NEW_MESSAGE':
        return settings.messagesEnabled;
      case 'MISSED_CALL':
      case 'CALL_ENDED':
        return settings.messagesEnabled; // use messages pref
      default:
        return true;
    }
  }

  private async sendPush(payload: { userId: string; type: string; title: string; message: string; referenceId?: string }) {
    const { userId, type, title, message, referenceId } = payload;
    const channel = this.getChannelFromType(type);

    // 1. Try FCM using User.fcmToken first
    const fcmSent = await fcm.sendPushToUser(userId, {
      title,
      body: message,
      channel,
      data: referenceId ? { referenceId, type } : { type },
    });

    if (fcmSent) return;

    // 2. Fallback to Device table (e.g. ExponentPushToken)
    const devices = await prisma.device.findMany({ where: { userId } });
    if (devices.length === 0) return;

    for (const device of devices) {
      const token = device.pushToken;
      if (token && token.startsWith('ExponentPushToken')) {
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: token,
              sound: 'default',
              title,
              body: message,
              data: { type, referenceId },
            }),
          });
          logger.info(`📱 Expo push sent to ${token}`);
        } catch (err: any) {
          logger.error(`Expo push failed: ${err.message}`);
        }
      }
    }
  }

  private getChannelFromType(type: string): string {
    switch (type) {
      case 'NEW_MESSAGE':
        return NotificationChannel.MESSAGE;
      case 'MISSED_CALL':
      case 'CALL_ENDED':
        return NotificationChannel.CALL;
      case 'FOLLOW':
      case 'NEW_FOLLOWER':
      case 'FOLLOW_REQUEST':
      case 'FOLLOW_ACCEPTED':
        return NotificationChannel.FOLLOW;
      case 'LIKE':
      case 'POST_LIKE':
      case 'STORY_LIKE':
        return NotificationChannel.LIKE;
      case 'COMMENT':
      case 'POST_COMMENT':
      case 'COMMENT_REPLY':
        return NotificationChannel.COMMENT;
      case 'MENTION':
      case 'POST_MENTION':
      case 'STORY_MENTION':
        return NotificationChannel.MENTION;
      default:
        return NotificationChannel.SYSTEM;
    }
  }
}

export default new NotificationService();
