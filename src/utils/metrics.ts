import redisClient from '../config/redis';
import logger from './logger';

const localMetrics: Record<string, number> = {
  login_success: 0,
  login_failure: 0,
  otp_generated: 0,
  otp_failed: 0,
  otp_expired: 0,
  refresh_rotated: 0,
  replay_attacks: 0,
  locked_accounts: 0,
  otp_verified: 0,
  redis_latency_ms: 0,
};

/**
 * Increments an authentication metric by 1 (using Redis or in-memory fallback)
 */
export const incrementMetric = async (
  name:
    | 'login_success'
    | 'login_failure'
    | 'otp_generated'
    | 'otp_verified'
    | 'otp_failed'
    | 'otp_expired'
    | 'refresh_rotated'
    | 'replay_attacks'
    | 'locked_accounts'
): Promise<void> => {
  try {
    const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';
    if (isRealRedis) {
      await redisClient.hincrby('auth:metrics', name, 1);
    } else {
      localMetrics[name]++;
    }
  } catch (err: any) {
    logger.error(`Failed to increment metric ${name}: ${err.message}`);
  }
};

/**
 * Records the last measured Redis command execution latency
 */
export const recordRedisLatency = async (ms: number): Promise<void> => {
  try {
    const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';
    if (isRealRedis) {
      await redisClient.hset('auth:metrics', 'redis_latency_ms', ms);
    } else {
      localMetrics.redis_latency_ms = ms;
    }
  } catch (err) {}
};

/**
 * Retrieves the current dashboard metrics
 */
export const getMetrics = async (): Promise<Record<string, number>> => {
  try {
    const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';
    if (isRealRedis) {
      const data = await redisClient.hgetall('auth:metrics');
      const formatted: Record<string, number> = {};
      for (const k of Object.keys(localMetrics)) {
        formatted[k] = data[k] ? parseInt(data[k], 10) : 0;
      }
      return formatted;
    }
  } catch (err: any) {
    logger.error(`Failed to retrieve Redis metrics: ${err.message}`);
  }
  return localMetrics;
};

export default {
  incrementMetric,
  recordRedisLatency,
  getMetrics,
};
