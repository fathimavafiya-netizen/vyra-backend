import prisma from '../config/db';
import { MediaType } from './PostRepository';

export class StoryRepository {
  /**
   * Create a new story (expires 24 h by default).
   * Supports isCloseFriends flag for restricted audience.
   */
  async createStory(data: {
    userId: string;
    caption?: string;
    mediaUrl: string;
    mediaType: MediaType;
    thumbnailUrl?: string;
    duration?: number;
    isCloseFriends?: boolean;
    expiresInHours?: number;
    filterApplied?: string;
    textOverlays?: string;
    stickers?: string;
    musicTrackId?: string;
    mentionedUserIds?: string[];
  }) {
    const hours = data.expiresInHours ?? 24;
    return prisma.story.create({
      data: {
        userId: data.userId,
        caption: data.caption ?? '',
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        isCloseFriends: data.isCloseFriends ?? false,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        duration: data.duration ?? 5.0,
        filterApplied: data.filterApplied,
        textOverlays: data.textOverlays,
        stickers: data.stickers,
        musicTrackId: data.musicTrackId,
        media: {
          create: {
            userId: data.userId,
            url: data.mediaUrl,
            type: data.mediaType,
            duration: data.duration ?? 0,
          },
        },
        mentions: data.mentionedUserIds ? {
          create: data.mentionedUserIds.map(uid => ({
            mentionedUserId: uid,
          })),
        } : undefined,
      },
      include: {
        media: true,
        user: { include: { profile: true } },
        views: true,
        reactions: true,
        likes: true,
        mentions: true,
      },
    });
  }

  /**
   * Fetch active (not expired, not soft-deleted) stories for the user's feed.
   * Filters Close Friends stories — only show them if the viewer
   * is in the story owner's close friends list.
   */
  async getActiveStories(viewerId: string) {
    const following = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);
    followingIds.push(viewerId); // include own stories

    // Fetch viewer's close-friend relationships once
    const closeFriendRows = await prisma.closeFriend.findMany({
      where: { friendId: viewerId },
      select: { ownerId: true },
    });
    // Set of user IDs whose close friends list contains the viewer
    const ownerIdsWhoAddedViewer = new Set(closeFriendRows.map(r => r.ownerId));

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: followingIds },
        expiresAt: { gt: new Date() },
        deletedAt: null, // Exclude soft-deleted stories
      },
      include: {
        media: true,
        user: { include: { profile: true } },
        views: { select: { userId: true } },
        reactions: { select: { userId: true, emoji: true } },
        likes: { select: { userId: true } },
        mentions: { select: { mentionedUserId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter: if isCloseFriends, only show to users who are in that owner's list
    return stories.filter(s => {
      if (!s.isCloseFriends) return true; // public story
      if (s.userId === viewerId) return true; // own story always visible
      return ownerIdsWhoAddedViewer.has(s.userId);
    });
  }

  /**
   * Create unique story like record.
   */
  async likeStory(storyId: string, userId: string) {
    return prisma.storyLike.upsert({
      where: { storyId_userId: { storyId, userId } },
      update: {},
      create: { storyId, userId },
    });
  }

  /**
   * Remove story like record.
   */
  async unlikeStory(storyId: string, userId: string) {
    return prisma.storyLike.deleteMany({
      where: { storyId, userId },
    });
  }

  /**
   * Get paginated views, likes, and reactions.
   */
  async getStoryInteractions(storyId: string, viewerId: string, options: { cursor?: string; limit?: number }) {
    const limit = options.limit ?? 20;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new Error('Story not found.');
    if (story.userId !== viewerId) throw new Error('Unauthorized.');

    const views = await prisma.storyView.findMany({
      where: { storyId },
      take: limit + 1,
      cursor: options.cursor ? { id: options.cursor } : undefined,
      orderBy: { viewedAt: 'desc' },
      include: { user: { include: { profile: true } } },
    });

    const likes = await prisma.storyLike.findMany({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { profile: true } } },
    });

    const reactions = await prisma.storyReaction.findMany({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { profile: true } } },
    });

    let nextCursor: string | undefined = undefined;
    if (views.length > limit) {
      const nextItem = views.pop();
      nextCursor = nextItem?.id;
    }

    return {
      views,
      likes,
      reactions,
      nextCursor,
    };
  }

  /**
   * Fetch archived (expired) stories for the story owner.
   * Used in the Archive section and for highlight creation.
   */
  async getArchivedStories(userId: string) {
    return prisma.story.findMany({
      where: {
        userId,
        expiresAt: { lte: new Date() },
      },
      include: {
        media: true,
        views: { select: { userId: true } },
        reactions: { select: { userId: true, emoji: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Register a story view (idempotent — silently ignores duplicate).
   */
  async addView(storyId: string, userId: string) {
    return prisma.storyView.upsert({
      where: { storyId_userId: { storyId, userId } },
      update: {},
      create: { storyId, userId },
    });
  }

  /**
   * Upsert a story reaction — one emoji per user per story.
   */
  async upsertReaction(storyId: string, userId: string, emoji: string) {
    return prisma.storyReaction.upsert({
      where: { storyId_userId: { storyId, userId } },
      update: { emoji },
      create: { storyId, userId, emoji },
    });
  }

  /**
   * Delete a story reaction.
   */
  async removeReaction(storyId: string, userId: string) {
    return prisma.storyReaction.deleteMany({
      where: { storyId, userId },
    });
  }

  /** Delete a story (owner only, soft-delete). */
  async deleteStory(storyId: string, userId: string) {
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: { media: true },
    });
    if (!story) throw new Error('Story not found.');
    if (story.userId !== userId) throw new Error('Unauthorized.');

    await prisma.story.update({
      where: { id: storyId },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        deleteReason: 'User request',
      },
    });

    return story;
  }

  // ─── Highlights ────────────────────────────────────────────────────────────

  async createHighlight(userId: string, title: string, coverUrl: string) {
    return prisma.storyHighlight.create({
      data: { userId, title, coverUrl },
      include: { stories: true },
    });
  }

  async getHighlights(userId: string) {
    return prisma.storyHighlight.findMany({
      where: { userId },
      include: {
        stories: {
          include: {
            highlight: false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addStoryToHighlight(highlightId: string, storyId: string, ownerId: string) {
    const highlight = await prisma.storyHighlight.findUnique({ where: { id: highlightId } });
    if (!highlight || highlight.userId !== ownerId) throw new Error('Unauthorized.');
    return prisma.storyHighlightItem.create({
      data: { highlightId, storyId },
    });
  }

  async removeStoryFromHighlight(highlightId: string, storyId: string, ownerId: string) {
    const highlight = await prisma.storyHighlight.findUnique({ where: { id: highlightId } });
    if (!highlight || highlight.userId !== ownerId) throw new Error('Unauthorized.');
    return prisma.storyHighlightItem.delete({
      where: { highlightId_storyId: { highlightId, storyId } },
    });
  }

  async deleteHighlight(highlightId: string, ownerId: string) {
    const highlight = await prisma.storyHighlight.findUnique({ where: { id: highlightId } });
    if (!highlight || highlight.userId !== ownerId) throw new Error('Unauthorized.');
    return prisma.storyHighlight.delete({ where: { id: highlightId } });
  }

  // ─── Close Friends ──────────────────────────────────────────────────────────

  async addCloseFriend(ownerId: string, friendId: string) {
    if (ownerId === friendId) throw new Error('Cannot add yourself to close friends.');
    return prisma.closeFriend.upsert({
      where: { ownerId_friendId: { ownerId, friendId } },
      update: {},
      create: { ownerId, friendId },
    });
  }

  async removeCloseFriend(ownerId: string, friendId: string) {
    return prisma.closeFriend.deleteMany({ where: { ownerId, friendId } });
  }

  async getCloseFriends(ownerId: string) {
    return prisma.closeFriend.findMany({
      where: { ownerId },
      include: { friend: { include: { profile: true } } },
    });
  }

  // ─── Reels / PostView ───────────────────────────────────────────────────────

  /**
   * Register a unique view on a post (reel/video).
   * Returns { alreadyViewed, viewCount }.
   */
  async registerPostView(postId: string, userId: string) {
    const existing = await prisma.postView.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) return { alreadyViewed: true };

    await prisma.postView.create({ data: { postId, userId } });
    const viewCount = await prisma.postView.count({ where: { postId } });
    return { alreadyViewed: false, viewCount };
  }

  async getReelsFeed(viewerId: string, options: { cursor?: string; limit?: number }) {
    const limit = options.limit ?? 10;
    return prisma.post.findMany({
      where: { type: 'REEL' },
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { include: { profile: true } },
        likes: true,
        _count: { select: { views: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: options.cursor ? 1 : 0,
      cursor: options.cursor ? { id: options.cursor } : undefined,
    });
  }
}

export default new StoryRepository();
