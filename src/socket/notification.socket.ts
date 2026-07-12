import { Server, Socket } from 'socket.io';
import notificationService from '../services/NotificationService';
import logger from '../utils/logger';

/**
 * notification.socket.ts
 *
 * Bug #5 fix: all notifications are now routed through NotificationService.send(),
 * which persists to DB before emitting. The old inline emit-only path is gone.
 *
 * Callers (chat.socket, story.socket, etc.) call NotificationService.send() directly.
 * This handler only exposes client-driven fetch/mark-read actions.
 */
export default function registerNotificationHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId as string;

  /** Client requests its pending notifications on connect */
  socket.on('get_notifications', async () => {
    if (!userId) return;
    try {
      const notifications = await notificationService.getNotifications(userId);
      socket.emit('notifications_list', notifications);
    } catch (err: any) {
      logger.error(`get_notifications error: ${err.message}`);
    }
  });

  /** Client marks a single notification as read */
  socket.on('mark_notification_read', async (data: { notificationId: string }) => {
    if (!userId || !data?.notificationId) return;
    try {
      await notificationService.markAsRead(userId, data.notificationId);
      socket.emit('notification_read_ack', { notificationId: data.notificationId });
    } catch (err: any) {
      logger.error(`mark_notification_read error: ${err.message}`);
    }
  });

  /** Client marks all notifications as read */
  socket.on('mark_all_notifications_read', async () => {
    if (!userId) return;
    try {
      await notificationService.markAllAsRead(userId);
      socket.emit('all_notifications_read_ack');
    } catch (err: any) {
      logger.error(`mark_all_notifications_read error: ${err.message}`);
    }
  });
}

export { registerNotificationHandlers };
