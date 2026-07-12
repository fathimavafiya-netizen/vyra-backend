import { Server, Socket } from 'socket.io';
import registerPresenceHandlers from './presence.socket';
import registerChatHandlers from './chat.socket';
import registerNotificationHandlers from './notification.socket';
import registerStoryHandlers from './story.socket';
import registerLiveHandlers from './live.socket';
import registerCallHandlers from './call.socket';
import { onlineUsers, activeLiveStreams } from './state';
import chatRepository from '../repositories/ChatRepository';
import prisma from '../config/db';
import notificationService from '../services/NotificationService';
import logger from '../utils/logger';
import tokenService from '../auth/services/TokenService';
import { registerSocketRelay } from '../utils/socketRelay';
import SocketGatewayCluster from './SocketGatewayCluster';

export default function initSocketIO(io: Server) {
  SocketGatewayCluster.configureAdapter(io);
  registerSocketRelay(io);
  notificationService.setIo(io);

  // ─── JWT Handshake Auth Middleware ───
  io.use(async (socket: Socket, next) => {
    const token =
      (socket.handshake.query?.token as string) ||
      (socket.handshake.auth?.token as string);

    if (!token) {
      return next(new Error('Authentication error: Token is required'));
    }

    try {
      // 1. Verify access token signature using the rotate service
      const decoded = tokenService.verifyAccessToken(token);
      const userId = decoded.sub;

      // 2. Verify Session Validity in Database
      if (decoded.sessionId) {
        const session = await prisma.session.findUnique({
          where: { id: decoded.sessionId },
        });

        if (!session || !session.isValid || session.expiresAt < new Date()) {
          return next(new Error('Authentication error: Session is invalid or revoked'));
        }

        // 3. Token Versioning check
        if (
          decoded.accessTokenVersion !== undefined &&
          decoded.accessTokenVersion !== session.accessTokenVersion
        ) {
          return next(new Error('Authentication error: Access token has been revoked'));
        }

        (socket as any).sessionId = session.id;
      }

      // 4. Verify User status
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive || user.isBanned || user.deletedAt !== null) {
        return next(new Error('Authentication error: User is inactive or banned'));
      }

      (socket as any).userId = userId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // ─── Connection Lifecycle ───
  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;
    logger.info(`🔌 Authenticated socket: ${socket.id} (User: ${userId})`);

    // ─── Packet Authorization Middleware (runs on every event) ───
    socket.use(async (packet, next) => {
      try {
        const sessionId = (socket as any).sessionId;
        if (sessionId) {
          const session = await prisma.session.findUnique({
            where: { id: sessionId },
          });

          if (!session || !session.isValid || session.expiresAt < new Date()) {
            socket.emit('auth_error', { code: 'SESSION_REVOKED', message: 'Session revoked' });
            socket.disconnect(true);
            return next(new Error('Session revoked or expired'));
          }
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive || user.isBanned || user.deletedAt !== null) {
          socket.emit('auth_error', { code: 'USER_BANNED', message: 'User banned or inactive' });
          socket.disconnect(true);
          return next(new Error('User account de-authorized'));
        }

        next();
      } catch (err: any) {
        next(new Error(`Authorization failed: ${err.message}`));
      }
    });

    // Setup periodic session revalidation (every 60 seconds)
    const revalidationInterval = setInterval(async () => {
      try {
        const sessionId = (socket as any).sessionId;
        if (sessionId) {
          const session = await prisma.session.findUnique({
            where: { id: sessionId },
          });

          if (!session || !session.isValid || session.expiresAt < new Date()) {
            clearInterval(revalidationInterval);
            socket.emit('auth_error', { code: 'SESSION_REVOKED', message: 'Session revoked' });
            socket.disconnect(true);
            logger.info(`🔌 Force disconnected socket ${socket.id} (Session revoked)`);
            return;
          }
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive || user.isBanned || user.deletedAt !== null) {
          clearInterval(revalidationInterval);
          socket.emit('auth_error', { code: 'USER_BANNED', message: 'User banned or inactive' });
          socket.disconnect(true);
          logger.info(`🔌 Force disconnected socket ${socket.id} (User banned/deleted)`);
          return;
        }
      } catch (err: any) {
        logger.error(`Error in socket periodic revalidation: ${err.message}`);
      }
    }, 60 * 1000);

    // Heartbeat listener
    socket.on('heartbeat', () => {
      socket.emit('heartbeat_ack');
    });

    if (userId) {
      socket.join(`user:${userId}`);
      onlineUsers.set(userId, socket.id);
      io.emit('user_status_changed', { userId, status: 'online' });
    }

    // Register modular handlers
    registerPresenceHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerNotificationHandlers(io, socket);
    registerStoryHandlers(io, socket);
    registerLiveHandlers(io, socket);
    registerCallHandlers(io, socket);

    // ─── Disconnect ───
    socket.on('disconnect', async () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
      clearInterval(revalidationInterval);

      if ((socket as any).viewerInterval) {
        clearInterval((socket as any).viewerInterval);
        (socket as any).viewerInterval = null;
      }

      const disconnectedUserId = (socket as any).userId as string;
      if (disconnectedUserId) {
        onlineUsers.delete(disconnectedUserId);

        try {
          await chatRepository.updateLastSeen(disconnectedUserId);
        } catch (err: any) {
          logger.error(`Failed to persist lastSeen for ${disconnectedUserId}: ${err.message}`);
        }

        io.emit('user_status_changed', { userId: disconnectedUserId, status: 'offline' });
        logger.info(`🔴 User ${disconnectedUserId} is offline — lastSeen persisted`);
      }

      // Handle live stream cleanup
      const streamId = (socket as any).streamId;
      if (streamId && activeLiveStreams.has(streamId)) {
        activeLiveStreams.get(streamId)!.delete(socket.id);
        const viewerCount = activeLiveStreams.get(streamId)!.size;

        try {
          if (viewerCount === 0) {
            await prisma.liveStream.update({
              where: { id: streamId },
              data: { isLive: false },
            });
            activeLiveStreams.delete(streamId);
            io.emit('live_stream_ended', { streamId });
          } else {
            io.emit('live_viewer_count_changed', { streamId, viewerCount });
          }
        } catch (err: any) {
          logger.error(`Failed to cleanup live stream: ${err.message}`);
        }
      }
    });
  });
}
