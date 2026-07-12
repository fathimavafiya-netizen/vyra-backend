import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import storyService from '../services/StoryService';
import storyFeedService from '../auth/services/StoryFeedService';
import storyAnalyticsService from '../auth/services/StoryAnalyticsService';
import idempotencyService from '../security/IdempotencyService';
import queueManager from '../queue/queue';
import prisma from '../config/db';
import logger from '../utils/logger';
import { formatPostResponse } from './PostController';

export class StoryController {
  // ─── Stories ────────────────────────────────────────────────────────────────

  async createStory(req: Request, res: Response, next: NextFunction) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    if (idempotencyKey) {
      const cached = await idempotencyService.checkIdempotency(idempotencyKey);
      if (cached === 'IN_FLIGHT') {
        return res.status(409).json({ success: false, message: 'Concurrent request in flight. Please try again later.' });
      }
      if (cached) {
        return res.json(cached);
      }
    }

    let storyId: string | null = null;

    try {
      const userId = (req as any).user.id;
      const {
        caption,
        mediaUrl,
        mediaType,
        duration,
        isCloseFriends,
        visibility,
        filterApplied,
        textOverlays,
        stickers,
        musicTrackId,
        mentionedUserIds
      } = req.body;

      if (!mediaUrl) {
        if (idempotencyKey) await idempotencyService.releaseLock(idempotencyKey);
        return res.status(400).json({ success: false, message: 'mediaUrl is required.' });
      }

      // Serialize arrays/objects into JSON strings for SQLite schema storage
      const textOverlaysStr = textOverlays ? (typeof textOverlays === 'string' ? textOverlays : JSON.stringify(textOverlays)) : null;
      const stickersStr = stickers ? (typeof stickers === 'string' ? stickers : JSON.stringify(stickers)) : null;

      // 1. Create a DB record in PENDING state
      // Default expiry in 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const story = await prisma.story.create({
        data: {
          userId,
          caption: caption || '',
          expiresAt,
          isCloseFriends: isCloseFriends || visibility === 'CLOSE_FRIENDS',
          visibility: visibility || (isCloseFriends ? 'CLOSE_FRIENDS' : 'PUBLIC'),
          moderation: 'PENDING',
          mediaUrl,
          mediaType: mediaType || 'IMAGE',
          duration: duration ? Number(duration) : 5.0,
          filterApplied,
          textOverlays: textOverlaysStr,
          stickers: stickersStr,
          musicTrackId,
          mentions: mentionedUserIds && Array.isArray(mentionedUserIds) ? {
            create: mentionedUserIds.map((uid: string) => ({
              mentionedUserId: uid,
            })),
          } : undefined,
        },
        include: {
          user: { include: { profile: true } }
        }
      });

      storyId = story.id;

      // Trigger notifications for mentioned users asynchronously
      if (mentionedUserIds && Array.isArray(mentionedUserIds)) {
        const notificationService = require('../services/NotificationService').default;
        for (const uid of mentionedUserIds) {
          notificationService.createNotification({
            userId: uid,
            actorId: userId,
            type: 'STORY_MENTION',
            targetType: 'STORY',
            targetId: story.id,
            referenceId: story.id
          }).catch((err: any) => logger.error(`[StoryController] Mention notification failed for ${uid}: ${err.message}`));
        }
      }

      // Strip query parameters from URL before extracting basename
      const urlWithoutQuery = mediaUrl.split('?')[0];
      const urlParts = urlWithoutQuery.split('/uploads/');
      const relativeName = urlParts.length > 1 ? urlParts[1] : path.basename(urlWithoutQuery);
      const tempFilePath = path.join(process.cwd(), 'uploads', relativeName);

      // Verify file exists, otherwise fetch/write valid staging image buffer
      if (!fs.existsSync(tempFilePath)) {
        const dir = path.dirname(tempFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        let fileBuffer: Buffer | null = null;
        if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
          try {
            const fetchRes = await fetch(mediaUrl);
            if (fetchRes.ok) {
              const arrayBuffer = await fetchRes.arrayBuffer();
              fileBuffer = Buffer.from(arrayBuffer);
            }
          } catch (e: any) {
            logger.warn(`[StoryController] Failed to download remote story mediaUrl: ${mediaUrl}. Error: ${e.message}`);
          }
        }
        
        if (!fileBuffer) {
          // Fallback to valid 1x1 transparent PNG instead of Buffer.alloc(100)
          fileBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        }
        
        await fs.promises.writeFile(tempFilePath, fileBuffer);
      }

      const mimeType = mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg';

      // 2. Queue Media Processing
      await queueManager.addJob('media_processing', {
        storyId: story.id,
        userId,
        tempFilePath,
        originalName: relativeName,
        mimeType,
        caption
      }, 'high');

      // Invalidates viewer feed cache
      await storyFeedService.invalidateCache(userId);

      const responsePayload = {
        success: true,
        message: 'Story processing initiated.',
        storyId: story.id,
        status: 'PENDING'
      };

      if (idempotencyKey) {
        await idempotencyService.saveResult(idempotencyKey, responsePayload);
      }

      return res.status(201).json(responsePayload);
    } catch (e: any) {
      if (idempotencyKey) {
        await idempotencyService.releaseLock(idempotencyKey);
      }
      next(e);
    }
  }

  async getFeedStories(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { cursor, limit } = req.query;
      
      const result = await storyFeedService.getFeed(
        userId,
        cursor as string | undefined,
        limit ? Number(limit) : 10
      );

      return res.json({ success: true, stories: result.feed, nextCursor: result.nextCursor });
    } catch (e: any) {
      next(e);
    }
  }

  async getArchive(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const stories = await storyService.getArchive(userId);
      return res.json({ success: true, stories });
    } catch (e: any) {
      next(e);
    }
  }

  async deleteStory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await storyService.deleteStory(id, userId);

      await storyFeedService.invalidateCache(userId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  async likeStory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const storyLike = await storyService.likeStory(id, userId);

      // Trigger notification for story owner
      const story = await prisma.story.findUnique({
        where: { id },
        include: { user: { include: { profile: true } } }
      });
      if (story && story.userId !== userId) {
        const notificationService = require('../services/NotificationService').default;
        await notificationService.createNotification({
          userId: story.userId,
          actorId: userId,
          type: 'STORY_LIKE',
          targetType: 'STORY',
          targetId: story.id,
          referenceId: story.id
        });
      }

      return res.json({ success: true, storyLike });
    } catch (e: any) {
      next(e);
    }
  }

  async unlikeStory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await storyService.unlikeStory(id, userId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  async getStoryInteractions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { cursor, limit } = req.query;

      const result = await storyService.getStoryInteractions(id, userId, {
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : 20,
      });

      return res.json({ success: true, ...result });
    } catch (e: any) {
      next(e);
    }
  }

  // ─── Views & Reactions ──────────────────────────────────────────────────────

  async viewStory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Log VIEW interaction in analytics and persistence
      await storyAnalyticsService.logInteraction(id, userId, 'VIEW');
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  async reactToStory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { emoji } = req.body;
      const reaction = await storyService.reactToStory(id, userId, emoji);

      // Trigger notification for story owner
      const story = await prisma.story.findUnique({
        where: { id },
        include: { user: { include: { profile: true } } }
      });
      if (story && story.userId !== userId) {
        const notificationService = require('../services/NotificationService').default;
        await notificationService.createNotification({
          userId: story.userId,
          actorId: userId,
          type: 'STORY_REACTION',
          targetType: 'STORY',
          targetId: story.id,
          referenceId: story.id,
          message: `reacted to your story: ${emoji}`
        });
      }

      // Log interaction in background analytics
      await storyAnalyticsService.logInteraction(id, userId, 'SHARE'); // tracks engagement
      return res.json({ success: true, reaction });
    } catch (e: any) {
      next(e);
    }
  }

  async removeReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await storyService.removeReaction(id, userId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  // ─── Drafts ─────────────────────────────────────────────────────────────────

  async saveDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { caption, mediaUrl } = req.body;
      if (!mediaUrl) return res.status(400).json({ success: false, message: 'mediaUrl is required for drafts.' });

      const draft = await prisma.storyDraft.create({
        data: { userId, caption: caption || '', mediaUrl }
      });
      return res.status(201).json({ success: true, draft });
    } catch (e: any) {
      next(e);
    }
  }

  async getDrafts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const drafts = await prisma.storyDraft.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ success: true, drafts });
    } catch (e: any) {
      next(e);
    }
  }

  // ─── Analytics ───

  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const analytics = await storyAnalyticsService.getAnalytics(id, userId);
      return res.json({ success: true, analytics });
    } catch (e: any) {
      next(e);
    }
  }

  async logInteraction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { eventType } = req.body; // VIEW | FORWARD | BACKWARD | EXIT | SHARE
      
      if (!['VIEW', 'FORWARD', 'BACKWARD', 'EXIT', 'SHARE'].includes(eventType)) {
        return res.status(400).json({ success: false, message: 'Invalid interaction type' });
      }

      await storyAnalyticsService.logInteraction(id, userId, eventType);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  // ─── Reporting ───

  async reportStory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { reason } = req.body; // SPAM | HARASSMENT | VIOLENCE | NUDITY | COPYRIGHT | OTHER

      if (!['SPAM', 'HARASSMENT', 'VIOLENCE', 'NUDITY', 'COPYRIGHT', 'OTHER'].includes(reason)) {
        return res.status(400).json({ success: false, message: 'Invalid report reason' });
      }

      const report = await prisma.storyReport.create({
        data: { storyId: id, reporterId: userId, reason }
      });

      return res.status(201).json({ success: true, message: 'Story reported successfully.', report });
    } catch (e: any) {
      next(e);
    }
  }

  // ─── Highlights ─────────────────────────────────────────────────────────────

  async createHighlight(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { title, coverUrl } = req.body;
      const highlight = await storyService.createHighlight(userId, title, coverUrl || '');
      return res.status(201).json({ success: true, highlight });
    } catch (e: any) {
      next(e);
    }
  }

  async getHighlights(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const highlights = await storyService.getHighlights(userId);
      return res.json({ success: true, highlights });
    } catch (e: any) {
      next(e);
    }
  }

  async addStoryToHighlight(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { highlightId } = req.params;
      const { storyId } = req.body;
      await storyService.addStoryToHighlight(highlightId, storyId, userId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  async removeStoryFromHighlight(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { highlightId, storyId } = req.params;
      await storyService.removeStoryFromHighlight(highlightId, storyId, userId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  async deleteHighlight(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await storyService.deleteHighlight(id, userId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  // ─── Close Friends ──────────────────────────────────────────────────────────

  async getCloseFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const list = await storyService.getCloseFriends(userId);
      return res.json({ success: true, closeFriends: list });
    } catch (e: any) {
      next(e);
    }
  }

  async addCloseFriend(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { friendId } = req.body;
      await storyService.addCloseFriend(userId, friendId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  async removeCloseFriend(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { friendId } = req.params;
      await storyService.removeCloseFriend(userId, friendId);
      return res.json({ success: true });
    } catch (e: any) {
      next(e);
    }
  }

  // ─── Reels ──────────────────────────────────────────────────────────────────

  async getReelsFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { cursor, limit } = req.query;
      const reels = await storyService.getReelsFeed(
        userId,
        cursor as string | undefined,
        limit ? Number(limit) : undefined
      );
      const formattedReels = reels.map(r => formatPostResponse(r));
      return res.json({ success: true, reels: formattedReels });
    } catch (e: any) {
      next(e);
    }
  }

  async registerPostView(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const result = await storyService.registerPostView(id, userId);
      return res.json({ success: true, ...result });
    } catch (e: any) {
      next(e);
    }
  }
}

export default new StoryController();
