import { Server } from 'socket.io';
import { redisClient, pub, sub } from '../config/redis';
import logger from '../utils/logger';

export class SocketGatewayCluster {
  /**
   * Configures horizontal scalability adapter for Socket.IO Server.
   * If Redis is enabled, mounts pub/sub listeners to broadcast events across multiple nodes.
   */
  static configureAdapter(io: Server): void {
    try {
      const isMock = !process.env.REDIS_URL;
      
      if (isMock) {
        logger.info('ℹ️ SocketGatewayCluster: Running in single-node mock mode.');
        return;
      }

      // Dynamically attempt to load the redis adapter to prevent compilation failures if not in dependencies
      try {
        const { createAdapter } = require('@socket.io/redis-adapter');
        io.adapter(createAdapter(pub, sub));
        logger.info('🚀 SocketGatewayCluster: Scaled cluster Redis adapter mounted successfully.');
      } catch (adapterLoadErr) {
        logger.warn('⚠️ SocketGatewayCluster: @socket.io/redis-adapter package not found. Implementing manual Pub/Sub relay fallback.');
        
        // Manual relay fallback using our EventBus/Redis Pub/Sub setup
        sub.on('message', (channel: string, message: string) => {
          if (channel.startsWith('socket:relay:')) {
            try {
              const { event, data } = JSON.parse(message);
              io.emit(event, data);
            } catch (err: any) {
              logger.error(`[SocketRelay] Message parse failed: ${err.message}`);
            }
          }
        });
      }
    } catch (err: any) {
      logger.error(`SocketGatewayCluster configuration failed: ${err.message}`);
    }
  }

  /**
   * Broadcasts an event to all nodes in the Socket.IO cluster.
   */
  static async broadcastCluster(event: string, data: any): Promise<void> {
    try {
      const payload = JSON.stringify({ event, data });
      await pub.publish(`socket:relay:${event}`, payload);
      logger.debug(`[SocketGatewayCluster] Broadcasted cluster event: ${event}`);
    } catch (err: any) {
      logger.error(`[SocketGatewayCluster] Cluster broadcast failed: ${err.message}`);
    }
  }
}

export default SocketGatewayCluster;
