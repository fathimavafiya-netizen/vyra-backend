import redisClient from '../config/redis';
import logger from '../utils/logger';

export class IdempotencyService {
  private keyPrefix = 'idempotency:';

  /**
   * Checks if an idempotency key is already used or currently in-flight.
   * Returns:
   * - 'IN_FLIGHT' if the request is currently being processed.
   * - The saved JSON response payload if the request was completed earlier.
   * - null if the key has not been used yet.
   */
  async checkIdempotency(key: string): Promise<'IN_FLIGHT' | any | null> {
    try {
      const fullKey = `${this.keyPrefix}${key}`;
      const record = await redisClient.get(fullKey);

      if (!record) {
        // Set lock state 'IN_FLIGHT' with a 5-minute safety timeout to prevent permanent lockouts if node crashes
        await redisClient.set(fullKey, 'IN_FLIGHT', 'EX', 300);
        logger.debug(`[Idempotency] Locked key: ${key}`);
        return null;
      }

      if (record === 'IN_FLIGHT') {
        logger.warn(`[Idempotency] Request already in flight: ${key}`);
        return 'IN_FLIGHT';
      }

      logger.info(`[Idempotency] Duplicate request found. Serving cached result for: ${key}`);
      return JSON.parse(record);
    } catch (err: any) {
      logger.error(`[Idempotency] checkIdempotency error: ${err.message}`);
      return null;
    }
  }

  /**
   * Saves the final response result associated with the idempotency key.
   * Caches result with a 24-hour TTL (86400 seconds) to satisfy production durability.
   */
  async saveResult(key: string, result: any): Promise<void> {
    try {
      const fullKey = `${this.keyPrefix}${key}`;
      const payload = JSON.stringify(result);
      await redisClient.set(fullKey, payload, 'EX', 86400);
      logger.debug(`[Idempotency] Saved response result for key: ${key}`);
    } catch (err: any) {
      logger.error(`[Idempotency] saveResult error: ${err.message}`);
    }
  }

  /**
   * Releases an in-flight lock (used if request execution fails before completing).
   */
  async releaseLock(key: string): Promise<void> {
    try {
      const fullKey = `${this.keyPrefix}${key}`;
      await redisClient.del(fullKey);
      logger.debug(`[Idempotency] Released lock: ${key}`);
    } catch (err: any) {
      logger.error(`[Idempotency] releaseLock error: ${err.message}`);
    }
  }
}

export default new IdempotencyService();
