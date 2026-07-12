import redisClient from '../config/redis';
import logger from './logger';

export const cache = {
  /**
   * Get an item from the cache. Handles JSON parsing.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err: any) {
      logger.error(`Cache GET error for key ${key}: ${err.message}`);
      return null;
    }
  },

  /**
   * Set an item in the cache. Handles JSON stringifying and optional TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const data = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await redisClient.set(key, data, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, data);
      }
    } catch (err: any) {
      logger.error(`Cache SET error for key ${key}: ${err.message}`);
    }
  },

  /**
   * Delete an item from the cache.
   */
  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (err: any) {
      logger.error(`Cache DEL error for key ${key}: ${err.message}`);
    }
  },

  async invalidate(pattern: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const stream = redisClient.scanStream({
          match: pattern,
          count: 100,
        });

        const deletePromises: Promise<any>[] = [];

        stream.on('data', (keys: string[]) => {
          if (keys && keys.length > 0) {
            deletePromises.push(
              redisClient.del(keys).catch((delErr: any) => {
                logger.error(`Cache invalidation batch DEL error: ${delErr.message}`);
              })
            );
          }
        });

        stream.on('end', async () => {
          try {
            await Promise.all(deletePromises);
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        stream.on('error', (err: any) => {
          logger.error(`Cache scanStream error for pattern ${pattern}: ${err.message}`);
          resolve(); // Resolve anyway to avoid breaking callers
        });
      } catch (err: any) {
        logger.error(`Cache invalidate error for pattern ${pattern}: ${err.message}`);
        resolve();
      }
    });
  },
};

export default cache;
