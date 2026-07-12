import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import storyFeedService from '../auth/services/StoryFeedService';
import logger from '../utils/logger';

export class AdminStoryController {
  /**
   * Lists all stories flagged by reports.
   */
  async listReportedStories(req: Request, res: Response, next: NextFunction) {
    try {
      const reports = await prisma.storyReport.findMany({
        include: {
          story: {
            include: {
              user: { include: { profile: true } }
            }
          },
          reporter: { include: { profile: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ success: true, reports });
    } catch (e: any) {
      next(e);
    }
  }

  /**
   * Admin force overrides and approves a story (clears reports).
   */
  async approveStory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const story = await prisma.story.update({
        where: { id },
        data: { moderation: 'APPROVED' }
      });
      // Delete reports
      await prisma.storyReport.deleteMany({
        where: { storyId: id }
      });
      await storyFeedService.invalidateCache(story.userId);
      logger.info(`[AdminStory] Story approved: ${id}`);
      return res.json({ success: true, story });
    } catch (e: any) {
      next(e);
    }
  }

  /**
   * Admin force blocks/deletes a story.
   */
  async deleteStory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const story = await prisma.story.update({
        where: { id },
        data: {
          moderation: 'BLOCKED',
          deletedAt: new Date(),
          deletedBy: 'ADMIN',
          deleteReason: reason || 'Admin moderation action'
        }
      });

      await storyFeedService.invalidateCache(story.userId);
      logger.info(`[AdminStory] Story force blocked/deleted: ${id}`);
      return res.json({ success: true, story });
    } catch (e: any) {
      next(e);
    }
  }
}

export default new AdminStoryController();
