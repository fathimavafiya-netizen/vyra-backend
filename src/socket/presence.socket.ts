import { Server, Socket } from 'socket.io';
import { onlineUsers } from './state';
import chatRepository from '../repositories/ChatRepository';
import prisma from '../config/db';
import logger from '../utils/logger';

export default function registerPresenceHandlers(io: Server, socket: Socket) {
  // Bug #3 fix: userId is always sourced from the JWT-verified socket property.
  // The legacy `user_online` event no longer lets the client override socket.userId.
  const userId = (socket as any).userId as string;

  /**
   * get_presence — client requests online status + lastSeen for a list of users.
   * Responds only to the requesting socket (not broadcast).
   */
  socket.on('get_presence', async (data: { userIds: string[] }) => {
    if (!data?.userIds || !Array.isArray(data.userIds)) return;

    try {
      // Find restrictions involving the current user and target users
      const restrictions = await prisma.restrictedUser.findMany({
        where: {
          OR: [
            { restrictorId: userId, restrictedId: { in: data.userIds } },
            { restrictorId: { in: data.userIds }, restrictedId: userId },
          ]
        }
      });
      const restrictedUserIds = new Set(
        restrictions.map((r: any) => r.restrictorId === userId ? r.restrictedId : r.restrictorId)
      );

      const records = await chatRepository.getPresence(data.userIds);
      const result: Record<string, { status: 'online' | 'offline'; lastSeen: string | null }> = {};

      for (const record of records) {
        const isRestricted = restrictedUserIds.has(record.id);
        const isOnline = !isRestricted && onlineUsers.has(record.id);
        result[record.id] = {
          status: isOnline ? 'online' : 'offline',
          lastSeen: isRestricted ? null : (record.lastSeen ? record.lastSeen.toISOString() : null),
        };
      }

      socket.emit('presence_response', result);
    } catch (err: any) {
      logger.error(`get_presence error: ${err.message}`);
    }
  });

  /**
   * heartbeat — client pings every 30 s to stay "online".
   * Responds with `heartbeat_ack` so the client knows the server is alive.
   */
  socket.on('heartbeat', async () => {
    if (!userId) return;
    // Re-register in onlineUsers in case of stale state
    onlineUsers.set(userId, socket.id);
    socket.emit('heartbeat_ack', { ts: Date.now() });
  });

  // Legacy no-op: the `user_online` event was the spoofing vector.
  // We keep the handler as a no-op for backward compat with older clients.
  socket.on('user_online', () => {
    // Intentionally ignored — online status is set from JWT userId on connection.
    logger.debug(`user_online event ignored (userId derived from JWT): ${socket.id}`);
  });
}

export { registerPresenceHandlers };
