import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class FeatureFlagService {
  private cache: Map<string, boolean> = new Map();
  private lastFetch: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds

  async isEnabled(key: string): Promise<boolean> {
    await this.refreshCacheIfNeeded();
    return this.cache.get(key) ?? false;
  }

  async getAllFlags(): Promise<Record<string, boolean>> {
    await this.refreshCacheIfNeeded();
    return Object.fromEntries(this.cache);
  }

  private async refreshCacheIfNeeded() {
    const now = Date.now();
    if (now - this.lastFetch > this.CACHE_TTL_MS) {
      try {
        const flags = await prisma.featureFlag.findMany();
        this.cache.clear();
        for (const flag of flags) {
          this.cache.set(flag.key, flag.isEnabled);
        }
        this.lastFetch = now;
      } catch (err) {
        logger.error(`Failed to refresh Feature Flags: ${err}`);
      }
    }
  }
}

export default new FeatureFlagService();
