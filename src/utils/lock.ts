import redisClient from '../config/redis';
import logger from './logger';

// In-memory fallback map for active locks (when Redis is offline / development fallback)
const localLocks = new Set<string>();

/**
 * Acquires a distributed lock using Redis (set with NX and PX options)
 * Falls back to an in-memory lock if Redis is offline/unavailable.
 * 
 * @param key The lock identifier
 * @param ttlMs Time-to-live for the lock in milliseconds
 * @returns boolean indicating if lock was successfully acquired
 */
export const acquireLock = async (key: string, ttlMs: number): Promise<boolean> => {
  try {
    const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';

    if (isRealRedis) {
      const result = await redisClient.set(key, 'LOCKED', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } else {
      // Database / In-Memory single-node fallback
      if (localLocks.has(key)) {
        return false;
      }
      localLocks.add(key);
      // Auto-expire local lock after TTL
      setTimeout(() => {
        localLocks.delete(key);
      }, ttlMs);
      return true;
    }
  } catch (err: any) {
    logger.error(`Distributed lock acquire error for key [${key}]: ${err.message}`);
    // Safe fallback under lock failure
    return false;
  }
};

/**
 * Releases a previously acquired lock
 * 
 * @param key The lock identifier
 */
export const releaseLock = async (key: string): Promise<boolean> => {
  try {
    const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';

    if (isRealRedis) {
      const result = await redisClient.del(key);
      return result > 0;
    } else {
      const deleted = localLocks.delete(key);
      return deleted;
    }
  } catch (err: any) {
    logger.error(`Distributed lock release error for key [${key}]: ${err.message}`);
    return false;
  }
};

export default {
  acquireLock,
  releaseLock,
};
