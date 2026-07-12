import { pub, sub, isRedisMock } from '../config/redis';
import logger from '../utils/logger';

// Simple presence map that handles multi-instance state sync via Redis Pub/Sub
class DistributedPresenceMap {
  private localMap = new Map<string, string>(); // userId -> socketId

  constructor() {
    this.initSync();
  }

  private initSync() {
    // If Redis is mocked/disabled, we don't need pubsub syncing
    if (isRedisMock) return;

    try {
      sub.subscribe('presence:online');
      sub.subscribe('presence:offline');

      sub.on('message', (channel: string, message: string) => {
        try {
          const data = JSON.parse(message);
          if (channel === 'presence:online') {
            // Only store remote online users if we don't already have a local connection
            if (!this.localMap.has(data.userId)) {
              this.localMap.set(data.userId, 'remote');
            }
          } else if (channel === 'presence:offline') {
            // Remove if it's marked as remote or if we're syncing offline status
            const current = this.localMap.get(data.userId);
            if (current === 'remote') {
              this.localMap.delete(data.userId);
            }
          }
        } catch (err: any) {
          logger.error(`Error parsing presence pubsub message: ${err.message}`);
        }
      });
    } catch (err: any) {
      logger.error(`Failed to initialize presence pubsub syncing: ${err.message}`);
    }
  }

  has(userId: string): boolean {
    return this.localMap.has(userId);
  }

  get(userId: string): string | undefined {
    return this.localMap.get(userId);
  }

  set(userId: string, socketId: string): this {
    this.localMap.set(userId, socketId);
    if (!isRedisMock) {
      pub.publish('presence:online', JSON.stringify({ userId, socketId })).catch(() => {});
    }
    return this;
  }

  delete(userId: string): boolean {
    const existed = this.localMap.delete(userId);
    if (existed && !isRedisMock) {
      pub.publish('presence:offline', JSON.stringify({ userId })).catch(() => {});
    }
    return existed;
  }

  clear() {
    this.localMap.clear();
  }
}

export const onlineUsers = new DistributedPresenceMap();
export const activeLiveStreams = new Map<string, Set<string>>(); // streamId -> Set of socketId (viewers)

export default onlineUsers;
