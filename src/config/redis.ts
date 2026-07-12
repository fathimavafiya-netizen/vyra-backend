import Redis from 'ioredis';
import env from './env';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

// Simple in-memory mock client to avoid checks throughout the codebase
class MockRedis extends EventEmitter {
  private static store = new Map<string, string>();
  private static sets = new Map<string, Set<string>>();
  private static pubsub = new EventEmitter();

  constructor() {
    super();
  }

  async get(key: string): Promise<string | null> {
    return MockRedis.store.get(key) ?? null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<'OK'> {
    // Simple parsing for EX (seconds)
    // args could be ['EX', 120] or similar
    MockRedis.store.set(key, value);
    const exIndex = args.indexOf('EX');
    if (exIndex !== -1 && typeof args[exIndex + 1] === 'number') {
      const ttlMs = args[exIndex + 1] * 1000;
      setTimeout(() => {
        MockRedis.store.delete(key);
      }, ttlMs);
    }
    return 'OK';
  }

  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    for (const k of keys) {
      if (MockRedis.store.delete(k)) count++;
      if (MockRedis.sets.delete(k)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matches: string[] = [];
    for (const k of MockRedis.store.keys()) {
      if (regex.test(k)) matches.push(k);
    }
    for (const k of MockRedis.sets.keys()) {
      if (regex.test(k)) matches.push(k);
    }
    return matches;
  }

  scanStream(options: { match?: string; count?: number }) {
    const emitter = new EventEmitter();
    const pattern = options.match ?? '*';
    process.nextTick(async () => {
      const matchedKeys = await this.keys(pattern);
      if (matchedKeys.length > 0) {
        emitter.emit('data', matchedKeys);
      }
      emitter.emit('end');
    });
    return emitter;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!MockRedis.sets.has(key)) {
      MockRedis.sets.set(key, new Set());
    }
    const set = MockRedis.sets.get(key)!;
    let count = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        count++;
      }
    }
    return count;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = MockRedis.sets.get(key);
    if (!set) return 0;
    let count = 0;
    for (const m of members) {
      if (set.delete(m)) {
        count++;
      }
    }
    if (set.size === 0) {
      MockRedis.sets.delete(key);
    }
    return count;
  }

  async sismember(key: string, member: string): Promise<number> {
    const set = MockRedis.sets.get(key);
    return set?.has(member) ? 1 : 0;
  }

  async smembers(key: string): Promise<string[]> {
    const set = MockRedis.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async subscribe(channel: string): Promise<number> {
    MockRedis.pubsub.on(channel, (message: string) => {
      this.emit('message', channel, message);
    });
    return 1;
  }

  async publish(channel: string, message: string): Promise<number> {
    MockRedis.pubsub.emit(channel, message);
    return 1;
  }

  duplicate(): MockRedis {
    return new MockRedis();
  }

  disconnect() {}
  quit() {}
}

export let redisClient: any;
export let pub: any;
export let sub: any;
export let isRedisMock = false;

if (env.REDIS_URL) {
  try {
    logger.info('🔌 Connecting to Redis at ' + env.REDIS_URL);
    redisClient = new Redis(env.REDIS_URL);
    pub = new Redis(env.REDIS_URL);
    sub = new Redis(env.REDIS_URL);

    redisClient.on('error', (err: any) => {
      logger.error('Redis error: ' + err.message);
    });
  } catch (err: any) {
    logger.warn('⚠️ Failed to initialize Redis. Falling back to MockRedis: ' + err.message);
    redisClient = new MockRedis();
    pub = new MockRedis();
    sub = new MockRedis();
    isRedisMock = true;
  }
} else {
  logger.info('ℹ️ REDIS_URL not set. Initializing in-memory MockRedis fallback.');
  redisClient = new MockRedis();
  pub = new MockRedis();
  sub = new MockRedis();
  isRedisMock = true;
}

export default redisClient;
