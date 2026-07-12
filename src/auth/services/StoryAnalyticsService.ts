import redisClient from '../../config/redis';
import prisma from '../../config/db';
import logger from '../../utils/logger';

export class StoryAnalyticsService {
  private keyPrefix = 'story:analytics:';

  /**
   * Logs a story interaction event (VIEW, FORWARD, BACKWARD, EXIT, SHARE).
   * Persists views to the relational DB, while recording engagement flows in Redis.
   */
  async logInteraction(storyId: string, viewerId: string, eventType: 'VIEW' | 'FORWARD' | 'BACKWARD' | 'EXIT' | 'SHARE'): Promise<void> {
    try {
      const redisKey = `${this.keyPrefix}${storyId}`;

      // Increment respective field count in Redis hash
      const field = eventType.toLowerCase() + 's'; // e.g. views, exits, shares
      await redisClient.hincrby(redisKey, field, 1);

      // Persist to relational DB for audit if it is a main VIEW event
      if (eventType === 'VIEW') {
        const existing = await prisma.storyView.findUnique({
          where: { storyId_userId: { storyId, userId: viewerId } }
        });
        if (!existing) {
          await prisma.storyView.create({
            data: { storyId, userId: viewerId }
          });
        }
      }

      logger.debug(`[StoryAnalyticsService] Logged ${eventType} on story: ${storyId}`);
    } catch (err: any) {
      logger.error(`[StoryAnalyticsService] logInteraction error: ${err.message}`);
    }
  }

  /**
   * Compiles the aggregated engagement report for a story.
   */
  async getAnalytics(storyId: string, ownerId: string): Promise<any> {
    try {
      // Security: Verify user owns the story
      const story = await prisma.story.findFirst({
        where: { id: storyId, userId: ownerId }
      });

      if (!story) {
        throw new Error('Unauthorized or Story not found');
      }

      const redisKey = `${this.keyPrefix}${storyId}`;
      
      // Fetch metrics from Redis
      const views = parseInt((await redisClient.hget(redisKey, 'views')) || '0', 10);
      const forwards = parseInt((await redisClient.hget(redisKey, 'forwards')) || '0', 10);
      const backwards = parseInt((await redisClient.hget(redisKey, 'backwards')) || '0', 10);
      const exits = parseInt((await redisClient.hget(redisKey, 'exits')) || '0', 10);
      const shares = parseInt((await redisClient.hget(redisKey, 'shares')) || '0', 10);

      // Fetch replies from DB
      const commentCount = await prisma.comment.count({
        where: { postId: storyId } // In schema, story comments/replies map to comments
      });

      // Fetch reactions from DB
      const reactionCount = await prisma.storyReaction.count({
        where: { storyId }
      });

      // Compute Completion Rate
      const completionRate = views > 0 ? Math.max(0, Math.min(100, ((views - exits) / views) * 100)) : 0;

      return {
        storyId,
        views: Math.max(views, 1), // fallback if DB view registered but Redis hash not initialized
        reach: views,
        forwards,
        backwards,
        exits,
        shares,
        replies: commentCount,
        reactions: reactionCount,
        completionRate: parseFloat(completionRate.toFixed(2))
      };
    } catch (err: any) {
      logger.error(`[StoryAnalyticsService] getAnalytics error: ${err.message}`);
      throw err;
    }
  }
}

// Extension to ioredis typings for mock client compatibility
if (!(redisClient as any).hincrby) {
  (redisClient as any).hincrby = async function (key: string, field: string, increment: number): Promise<number> {
    const current = parseInt((await this.hget(key, field)) || '0', 10);
    const newVal = current + increment;
    await this.hset(key, field, newVal.toString());
    return newVal;
  };
  (redisClient as any).hget = async function (key: string, field: string): Promise<string | null> {
    const record = await this.get(`${key}:${field}`);
    return record;
  };
  (redisClient as any).hset = async function (key: string, field: string, value: string): Promise<number> {
    await this.set(`${key}:${field}`, value);
    return 1;
  };
}

export default new StoryAnalyticsService();
