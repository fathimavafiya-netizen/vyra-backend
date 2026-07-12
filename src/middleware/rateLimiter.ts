import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import logger from '../utils/logger';

// In-memory sliding window store: key -> timestamps[]
const memoryStore = new Map<string, number[]>();

// Periodic memory store cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of memoryStore.entries()) {
    // Keep only timestamps within last 24h
    const valid = timestamps.filter(ts => now - ts < 24 * 3600 * 1000);
    if (valid.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, valid);
    }
  }
}, 60 * 1000);

interface LimiterOptions {
  windowMs: number;
  max: number;
  message: string;
}

export const createRateLimiter = (options: LimiterOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const contact = req.body.email || req.body.mobile || '';
    const key = `ratelimit:${req.path}:${ip}:${contact}`;

    const now = Date.now();
    const windowStart = now - options.windowMs;

    try {
      // Determine if Redis client is real and active
      const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';

      if (isRealRedis) {
        const multi = redisClient.multi();
        multi.zremrangebyscore(key, 0, windowStart);
        multi.zadd(key, now, now.toString());
        multi.zcard(key);
        multi.expire(key, Math.ceil(options.windowMs / 1000));

        const results = await multi.exec();
        if (results && results[2]) {
          const count = results[2][1] as number;
          if (count > options.max) {
            return res.status(429).json({ success: false, message: options.message });
          }
        }
      } else {
        // Local in-memory sliding window fallback
        let timestamps = memoryStore.get(key) || [];
        timestamps = timestamps.filter(ts => ts > windowStart);
        timestamps.push(now);
        memoryStore.set(key, timestamps);

        if (timestamps.length > options.max) {
          return res.status(429).json({ success: false, message: options.message });
        }
      }

      return next();
    } catch (err: any) {
      logger.error(`Rate limiter execution error: ${err.message}`);
      // Fail open under exception to keep app running
      return next();
    }
  };
};

export const otpSendLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many OTP requests from this device or contact. Please try again after an hour.',
});

export const otpVerifyLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many verification attempts. Please try again after an hour.',
});

export const loginLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Too many login attempts. Please try again after an hour.',
});

export default {
  otpSendLimiter,
  otpVerifyLimiter,
  loginLimiter,
};
