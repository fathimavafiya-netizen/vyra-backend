import { Response, NextFunction } from 'express';
import notificationService from '../services/NotificationService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

export class NotificationController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const cursor = req.query.cursor as string | undefined;

      const notifications = await notificationService.getNotifications(userId, limit, cursor);
      const nextCursor = notifications.length === limit ? notifications[notifications.length - 1].id : null;

      return res.status(200).json({ success: true, notifications, nextCursor });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async unreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const count = await prisma.notification.count({
        where: { userId, isRead: false }
      });

      return res.status(200).json({ success: true, unreadCount: count });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async read(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) throw new Error('Unauthorized');

      await notificationService.markAsRead(userId, id);
      return res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async readAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      await notificationService.markAllAsRead(userId);
      return res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) throw new Error('Unauthorized');

      await notificationService.delete(userId, id);
      return res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new NotificationController();
