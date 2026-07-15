import prisma from '../../config/db';
import storageProvider from '../../security/StorageProvider';
import redisClient from '../../config/redis';
import logger from '../../utils/logger';

export class StoryFeedService {
  private cachePrefix = 'story-feed:';

  /**
   * Compiles the personalized story feed for a viewer using score-based sorting.
   * Leverages Redis cache invalidation.
   */
  async getFeed(viewerId: string, cursor?: string, limit = 10): Promise<{ feed: any[]; nextCursor?: string }> {
    try {
      const cacheKey = `${this.cachePrefix}${viewerId}:${cursor || 'start'}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.debug(`[StoryFeedService] Serving cached story feed for user: ${viewerId}`);
        const parsed = JSON.parse(cached);
        // Refresh signed URLs in cached feed items (since they expire in 5 min)
        await this.refreshSignedUrls(parsed.feed);
        return parsed;
      }

      // 1. Resolve followers, mutes, blocks, and close friends bounds
      const following = await prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true }
      });
      const followingIds = following.map((f) => f.followingId);
      followingIds.push(viewerId); // Own stories always shown

      // Exclude blocked or blocking users
      const blocks = await prisma.blockedUser.findMany({
        where: {
          OR: [{ blockerId: viewerId }, { blockedId: viewerId }]
        },
        select: { blockerId: true, blockedId: true }
      });
      const blockedUserIds = new Set<string>();
      for (const b of blocks) {
        if (b.blockerId === viewerId) {
          blockedUserIds.add(b.blockedId);
        } else {
          blockedUserIds.add(b.blockerId);
        }
      }
      const activeUserIds = followingIds.filter((id) => id === viewerId || !blockedUserIds.has(id));

      // Fetch close friend relations
      const closeFriends = await prisma.closeFriend.findMany({
        where: { friendId: viewerId },
        select: { ownerId: true }
      });
      const closeFriendOwners = new Set(closeFriends.map((c) => c.ownerId));

      // 2. Query all active, approved, unexpired story slides
      const now = new Date();
      const slides = await prisma.story.findMany({
        where: {
          userId: { in: activeUserIds },
          expiresAt: { gt: now },
          deletedAt: null,
          moderation: 'APPROVED'
        },
        include: {
          user: { include: { profile: true } },
          views: { select: { userId: true } },
          reactions: true,
          variants: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // 3. Filter stories based on privacy visibility rules
      const filteredSlides = await Promise.all(
        slides.map(async (slide) => {
          if (slide.userId === viewerId) return slide; // own slides always visible
          
          if (slide.visibility === 'CLOSE_FRIENDS') {
            return closeFriendOwners.has(slide.userId) ? slide : null;
          }

          if (slide.visibility === 'CUSTOM') {
            try {
              const allowed = await (prisma as any).storyCustomAudience.findUnique({
                where: { storyId_userId: { storyId: slide.id, userId: viewerId } }
              });
              return allowed ? slide : null;
            } catch (e) {
              return null;
            }
          }

          if (slide.visibility === 'HIDDEN') {
            try {
              const hidden = await (prisma as any).storyHiddenAudience.findUnique({
                where: { storyId_userId: { storyId: slide.id, userId: viewerId } }
              });
              return hidden ? null : slide;
            } catch (e) {
              return slide;
            }
          }

          return slide; // PUBLIC and FOLLOWERS are visible (since users follow them)
        })
      );

      const activeSlides = filteredSlides.filter((s): s is NonNullable<typeof s> => s !== null);

      // 4. Group slides by User
      const userGroupMap = new Map<string, {
        userId: string;
        user: any;
        stories: typeof activeSlides;
        latestUpload: Date;
        hasUnseen: boolean;
        score: number;
      }>();

      for (const slide of activeSlides) {
        const uid = slide.userId;
        if (!userGroupMap.has(uid)) {
          userGroupMap.set(uid, {
            userId: uid,
            user: slide.user,
            stories: [],
            latestUpload: slide.createdAt,
            hasUnseen: false,
            score: 0
          });
        }
        const group = userGroupMap.get(uid)!;
        group.stories.push(slide);

        // Update latest upload timestamp
        if (slide.createdAt > group.latestUpload) {
          group.latestUpload = slide.createdAt;
        }

        // Check if this slide is unseen by the viewer
        const seen = slide.views.some((v) => v.userId === viewerId);
        if (!seen) {
          group.hasUnseen = true;
        }
      }

      // 5. Score and rank each User Group
      const groups = Array.from(userGroupMap.values());
      for (const g of groups) {
        let score = 0;
        // Recency score (newer stories = higher score)
        const ageHours = (Date.now() - g.latestUpload.getTime()) / (1000 * 60 * 60);
        score += Math.max(0, 24 - ageHours) * 2; // up to 48 points

        // Close Friend weight
        if (closeFriendOwners.has(g.userId)) {
          score += 50;
        }

        // Own story always gets boosted to front of its unviewed/viewed section
        if (g.userId === viewerId) {
          score += 1000;
        }

        g.score = score;
      }

      // 6. Sort Groups: Unviewed first, then Viewed. Within each section, sort by Score desc.
      groups.sort((a, b) => {
        // Own story (if viewerId) is always first
        if (a.userId === viewerId) return -1;
        if (b.userId === viewerId) return 1;

        if (a.hasUnseen && !b.hasUnseen) return -1;
        if (!a.hasUnseen && b.hasUnseen) return 1;

        return b.score - a.score;
      });

      // 7. Apply cursor-pagination on user groups
      let startIndex = 0;
      if (cursor) {
        const index = groups.findIndex((g) => g.userId === cursor);
        if (index !== -1) {
          startIndex = index + 1;
        }
      }

      const paginatedGroups = groups.slice(startIndex, startIndex + limit);
      const nextCursor = paginatedGroups.length === limit ? paginatedGroups[paginatedGroups.length - 1].userId : undefined;

      // 8. Generate short-lived signed URLs for media variants
      await this.refreshSignedUrls(paginatedGroups);

      const response = {
        feed: paginatedGroups,
        nextCursor
      };

      // Cache feed for 5 minutes (300s)
      await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 300);

      return response;
    } catch (err: any) {
      logger.error(`[StoryFeedService] getFeed error: ${err.message}`);
      return { feed: [] };
    }
  }

  /**
   * Helper to sign URLs for story variants dynamically.
   */
  private async refreshSignedUrls(feed: any[]): Promise<void> {
    for (const group of feed) {
      for (const story of group.stories) {
        for (const variant of story.variants) {
          // If the URL is absolute local path, sign it using the local provider signature
          variant.url = await storageProvider.getSignedUrl(variant.url);
        }
        // Map mediaUrl to the "original" variant for client compatibility
        const originalVariant = story.variants.find((v: any) => v.resolution === 'original') || story.variants[0];
        story.mediaUrl = originalVariant ? originalVariant.url : '';
      }
    }
  }

  /**
   * Helper to invalidate cache keys matching story feeds.
   */
  async invalidateCache(userId: string): Promise<void> {
    try {
      const keys = await redisClient.keys(`${this.cachePrefix}*`);
      for (const k of keys) {
        await redisClient.del(k);
      }
      logger.debug(`[StoryFeedService] Invalidated story feed cache on new upload for user: ${userId}`);
    } catch (err: any) {
      logger.error(`[StoryFeedService] cache invalidation error: ${err.message}`);
    }
  }
}

export default new StoryFeedService();
