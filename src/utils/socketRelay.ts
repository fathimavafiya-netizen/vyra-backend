import { Server } from 'socket.io';
import { pub, sub, isRedisMock } from '../config/redis';
import logger from './logger';

/**
 * Emit an event to a specific user. This handles cross-instance signaling
 * by emitting locally to the user's room and publishing a pubsub event
 * so that other server instances in the cluster do the same.
 */
export function emitToUser(io: Server, userId: string, event: string, data: any) {
  // Emit locally to the user's room (every connected socket for a user joins "user:<userId>")
  io.to(`user:${userId}`).emit(event, data);

  // If Redis is active, publish to Pub/Sub so other instances in the cluster relay it
  if (!isRedisMock) {
    pub.publish('socket:relay', JSON.stringify({ userId, event, data })).catch((err: any) => {
      logger.error(`Failed to publish socket relay: ${err.message}`);
    });
  }
}

/**
 * Register the Redis Pub/Sub socket relay listener for cross-instance events.
 */
export function registerSocketRelay(io: Server) {
  if (isRedisMock) return;

  try {
    sub.subscribe('socket:relay');
    sub.on('message', (channel: string, message: string) => {
      if (channel === 'socket:relay') {
        try {
          const { userId, event, data } = JSON.parse(message);
          // Emit to local sockets joined to "user:<userId>" room
          io.to(`user:${userId}`).emit(event, data);
        } catch (err: any) {
          logger.error(`Error parsing socket relay message: ${err.message}`);
        }
      }
    });
    logger.info('📡 Cross-instance Socket.IO Pub/Sub relay registered');
  } catch (err: any) {
    logger.error(`Failed to register socket relay: ${err.message}`);
  }
}

export default emitToUser;
