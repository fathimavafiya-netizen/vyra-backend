import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class LiveController {
  async start(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const { title } = req.body;
      if (!title) throw new Error('Title is required');

      // Generate channel name: stream_hostId_timestamp
      const channelName = `stream_${userId}_${Date.now()}`;

      // Set any existing live streams by this host to inactive first, to prevent multiple active streams
      await prisma.liveStream.updateMany({
        where: { hostId: userId, isLive: true },
        data: { isLive: false },
      });

      const liveStream = await prisma.liveStream.create({
        data: {
          hostId: userId,
          title,
          channelName,
          isLive: true,
          viewerCount: 0,
        },
        include: {
          host: {
            include: {
              profile: true,
            },
          },
        },
      });

      // Create a mock post of type 'LIVE' to represent this stream in feed if needed, or simply return live stream
      await prisma.post.create({
        data: {
          userId,
          type: 'LIVE',
          caption: title,
        },
      });

      // Enqueue background job to fan out LIVE_STARTED notifications to followers
      const queueManager = require('../queue/queue').default;
      await queueManager.addJob('live_started', {
        hostId: userId,
        liveStreamId: liveStream.id,
        title,
      }, 'high');

      return res.status(201).json({
        success: true,
        message: 'Live stream started successfully',
        stream: liveStream,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async end(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) throw new Error('Unauthorized');

      const stream = await prisma.liveStream.findUnique({ where: { id } });
      if (!stream) {
        return res.status(404).json({ success: false, message: 'Stream not found' });
      }

      if (stream.hostId !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const updatedStream = await prisma.liveStream.update({
        where: { id },
        data: { isLive: false },
      });

      return res.status(200).json({
        success: true,
        message: 'Live stream ended successfully',
        stream: updatedStream,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const streams = await prisma.liveStream.findMany({
        where: { isLive: true },
        include: {
          host: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.status(200).json({
        success: true,
        streams,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stream = await prisma.liveStream.findUnique({
        where: { id },
        include: {
          host: {
            include: {
              profile: true,
            },
          },
        },
      });

      if (!stream) {
        return res.status(404).json({ success: false, message: 'Stream not found' });
      }

      return res.status(200).json({
        success: true,
        stream,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new LiveController();
