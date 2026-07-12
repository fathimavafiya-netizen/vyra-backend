import { Server, Socket } from 'socket.io';
import { activeLiveStreams } from './state';
import prisma from '../config/db';
import logger from '../utils/logger';

export default function registerLiveHandlers(io: Server, socket: Socket) {
  socket.on('join_stream', async ({ streamId, userId }: { streamId: string; userId: string }) => {
    socket.join(streamId);
    (socket as any).streamId = streamId;

    if (!activeLiveStreams.has(streamId)) {
      activeLiveStreams.set(streamId, new Set());
    }
    activeLiveStreams.get(streamId)!.add(socket.id);

    const viewerCount = activeLiveStreams.get(streamId)!.size;

    try {
      await prisma.liveStream.update({
        where: { id: streamId },
        data: { viewerCount },
      });
    } catch (err: any) {
      logger.error(`Error updating live viewer count: ${err.message}`);
    }

    io.to(streamId).emit('stream_viewers_updated', { streamId, viewerCount });
    logger.info(`👤 Socket joined stream ${streamId}. Current viewers: ${viewerCount}`);

    // Periodically shift viewer count to simulate organic fluctuations
    if (!(socket as any).viewerInterval) {
      (socket as any).viewerInterval = setInterval(async () => {
        try {
          const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
          if (!stream || !stream.isLive) {
            clearInterval((socket as any).viewerInterval);
            (socket as any).viewerInterval = null;
            return;
          }
          const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
          const nextViewerCount = Math.max(1, stream.viewerCount + delta);
          await prisma.liveStream.update({
            where: { id: streamId },
            data: { viewerCount: nextViewerCount }
          });
          io.to(streamId).emit('stream_viewers_updated', { streamId, viewerCount: nextViewerCount });
        } catch (e) {}
      }, 8000);
    }
  });

  socket.on('leave_stream', async ({ streamId }: { streamId: string }) => {
    if ((socket as any).viewerInterval) {
      clearInterval((socket as any).viewerInterval);
      (socket as any).viewerInterval = null;
    }

    socket.leave(streamId);
    (socket as any).streamId = null;

    if (activeLiveStreams.has(streamId)) {
      activeLiveStreams.get(streamId)!.delete(socket.id);
      const viewerCount = activeLiveStreams.get(streamId)!.size;

      try {
        await prisma.liveStream.update({
          where: { id: streamId },
          data: { viewerCount },
        });
      } catch (err: any) {
        logger.error(`Error updating live viewer count: ${err.message}`);
      }

      io.to(streamId).emit('stream_viewers_updated', { streamId, viewerCount });
    }
  });

  socket.on('live_comment', (data: { streamId: string; senderName: string; senderPic: string; text: string }) => {
    const { streamId, senderName, senderPic, text } = data;
    if (!streamId || !text) return;

    const commentPayload = {
      _id: Math.random().toString(36).substring(2, 9),
      senderName: senderName || 'Viewer',
      senderPic: senderPic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      text,
      createdAt: new Date(),
    };

    io.to(streamId).emit('receive_live_comment', commentPayload);
  });

  socket.on('live_reaction', (data: { streamId: string; reactionType: string }) => {
    const { streamId, reactionType } = data;
    if (!streamId) return;

    io.to(streamId).emit('receive_live_reaction', { reactionType });
  });

  socket.on('end_stream', ({ streamId }: { streamId: string }) => {
    logger.info(`🚨 Broadcaster ended stream ${streamId}`);
    io.to(streamId).emit('stream_ended', { streamId });
  });
}
export { registerLiveHandlers };
