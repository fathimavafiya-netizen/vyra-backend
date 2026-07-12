import prisma from '../config/db';

export const PostType = {
  POST: 'POST',
  REEL: 'REEL',
  VIDEO: 'VIDEO',
  STORY: 'STORY',
  LIVE: 'LIVE',
} as const;
export type PostType = typeof PostType[keyof typeof PostType];

export const MediaType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
} as const;
export type MediaType = typeof MediaType[keyof typeof MediaType];

export class PostRepository {
  async create(data: {
    userId: string;
    type: PostType;
    caption?: string;
    media?: { url: string; type: MediaType; duration?: number; size?: number; order?: number }[];
    hashtags?: string[];
    musicTrackId?: string;
    duration?: number;
    thumbnailUrl?: string;
    originalPostId?: string;
  }) {
    // 1. First find or create hashtags
    const hashtagConnections = [];
    if (data.hashtags && data.hashtags.length > 0) {
      const uniqueCleanedNames = Array.from(new Set(
        data.hashtags.map(name => name.toLowerCase().replace('#', '').trim()).filter(Boolean)
      ));
      for (const cleanedName of uniqueCleanedNames) {
        const hashtag = await prisma.hashtag.upsert({
          where: { name: cleanedName },
          update: {},
          create: { name: cleanedName },
        });
        hashtagConnections.push({ hashtagId: hashtag.id });
      }
    }

    // 2. Create post with media, hashtags, music, and duration nested
    return prisma.post.create({
      data: {
        userId: data.userId,
        type: data.type,
        caption: data.caption || '',
        musicTrackId: data.musicTrackId,
        duration: data.duration,
        thumbnailUrl: data.thumbnailUrl,
        originalPostId: data.originalPostId,
        media: data.media ? {
          create: data.media.map(m => ({
            userId: data.userId,
            url: m.url,
            type: m.type,
            order: m.order || 0,
            duration: m.duration || 0,
            size: m.size || 0,
          })),
        } : undefined,
        hashtags: {
          create: hashtagConnections,
        },
      },
      include: {
        media: true,
        user: { include: { profile: true } },
        originalPost: {
          include: {
            media: true,
            user: { include: { profile: true } },
          }
        }
      },
    });
  }

  async repost(originalPostId: string, userId: string, caption?: string) {
    const original = await this.findById(originalPostId);
    if (!original) throw new Error('Original post not found');

    return this.create({
      userId,
      type: original.type as PostType,
      caption: caption || '',
      originalPostId,
      musicTrackId: original.musicTrackId || undefined,
      duration: original.duration || undefined,
      thumbnailUrl: original.thumbnailUrl || undefined,
    });
  }

  async findFeed(userId: string, options: {
    type?: string;
    search?: string;
    sort?: string;
    limit?: number;
    cursor?: string;
  }) {
    const limit = options.limit ?? 10;

    // Get list of user IDs we are following
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    
    const followingIds = following.map(f => f.followingId);
    followingIds.push(userId); // Include own posts

    // Build Prisma query condition
    const where: any = {
      userId: { in: followingIds },
      isHidden: false,
      deletedAt: null,
    };

    // 1. Type filter
    if (options.type) {
      let pType = options.type.toUpperCase();
      if (pType === 'SHORT_VIDEO') pType = 'REEL';
      if (pType === 'LONG_VIDEO') pType = 'VIDEO';
      where.type = pType;
    } else {
      where.type = { not: 'STORY' }; // Exclude stories
    }

    // 2. Search keyword filter
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      where.OR = [
        { caption: { contains: searchLower } },
        { hashtags: { some: { hashtag: { name: { contains: searchLower } } } } },
        { user: { profile: { name: { contains: searchLower } } } },
        { user: { profile: { username: { contains: searchLower } } } },
      ];
    }

    // 3. Sorting logic
    let orderBy: any = { createdAt: 'desc' }; // default: newest
    if (options.sort) {
      const sortLower = options.sort.toLowerCase();
      if (sortLower === 'popular') {
        orderBy = { likes: { _count: 'desc' } };
      } else if (sortLower === 'trending') {
        orderBy = [
          { likes: { _count: 'desc' } },
          { createdAt: 'desc' }
        ];
      }
    }

    const cursorCondition = options.cursor ? { id: options.cursor } : undefined;

    return prisma.post.findMany({
      where,
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { include: { profile: true } },
        likes: true,
        hashtags: { include: { hashtag: true } },
        comments: {
          include: {
            user: { include: { profile: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        originalPost: {
          include: {
            media: true,
            user: { include: { profile: true } },
          }
        }
      },
      orderBy,
      take: limit,
      skip: options.cursor ? 1 : 0,
      cursor: cursorCondition,
    });
  }

  async getGlobalFeed(options: {
    type?: string;
    search?: string;
    sort?: string;
    limit?: number;
    cursor?: string;
  }) {
    const limit = options.limit ?? 10;
    const where: any = {
      isHidden: false,
      deletedAt: null,
    };

    // 1. Type filter
    if (options.type) {
      let pType = options.type.toUpperCase();
      if (pType === 'SHORT_VIDEO') pType = 'REEL';
      if (pType === 'LONG_VIDEO') pType = 'VIDEO';
      where.type = pType;
    } else {
      where.type = { not: 'STORY' }; // Exclude stories
    }

    // 2. Search keyword filter
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      where.OR = [
        { caption: { contains: searchLower } },
        { hashtags: { some: { hashtag: { name: { contains: searchLower } } } } },
        { user: { profile: { name: { contains: searchLower } } } },
        { user: { profile: { username: { contains: searchLower } } } },
      ];
    }

    // 3. Sorting logic
    let orderBy: any = { createdAt: 'desc' }; // default: newest
    if (options.sort) {
      const sortLower = options.sort.toLowerCase();
      if (sortLower === 'popular') {
        orderBy = { likes: { _count: 'desc' } };
      } else if (sortLower === 'trending') {
        orderBy = [
          { likes: { _count: 'desc' } },
          { createdAt: 'desc' }
        ];
      }
    }

    const cursorCondition = options.cursor ? { id: options.cursor } : undefined;

    return prisma.post.findMany({
      where,
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { include: { profile: true } },
        likes: true,
        hashtags: { include: { hashtag: true } },
        comments: {
          include: {
            user: { include: { profile: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        originalPost: {
          include: {
            media: true,
            user: { include: { profile: true } },
          }
        }
      },
      orderBy,
      take: limit,
      skip: options.cursor ? 1 : 0,
      cursor: cursorCondition,
    });
  }

  async findByUserId(userId: string, limit = 50) {
    return prisma.post.findMany({
      where: {
        userId,
        isHidden: false,
        deletedAt: null,
        type: { not: 'STORY' },
      },
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { include: { profile: true } },
        likes: true,
        hashtags: { include: { hashtag: true } },
        comments: {
          include: {
            user: { include: { profile: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        originalPost: {
          include: {
            media: true,
            user: { include: { profile: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findById(id: string) {
    return prisma.post.findUnique({
      where: { id },
      include: {
        media: true,
        user: { include: { profile: true } },
        likes: true,
        hashtags: { include: { hashtag: true } },
        comments: {
          include: { user: { include: { profile: true } } },
          orderBy: { createdAt: 'asc' },
        },
        originalPost: {
          include: {
            media: true,
            user: { include: { profile: true } },
          }
        }
      },
    });
  }

  async delete(id: string) {
    return prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addLike(postId: string, userId: string) {
    return prisma.like.create({
      data: {
        postId,
        userId,
      },
    });
  }

  async removeLike(postId: string, userId: string) {
    return prisma.like.delete({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });
  }

  async hasLiked(postId: string, userId: string) {
    const like = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });
    return !!like;
  }

  async getPostLikes(postId: string, options: { cursor?: string; limit?: number }) {
    const limit = options.limit ?? 10;
    const where: any = { postId };
    const cursorCondition = options.cursor ? { id: options.cursor } : undefined;

    return prisma.like.findMany({
      where,
      include: {
        user: { include: { profile: true } }
      },
      take: limit,
      skip: options.cursor ? 1 : 0,
      cursor: cursorCondition,
      orderBy: { createdAt: 'desc' }
    });
  }

  async addComment(postId: string, userId: string, text: string, parentId?: string) {
    return prisma.comment.create({
      data: {
        postId,
        userId,
        text,
        parentId,
      },
      include: {
        user: { include: { profile: true } },
      },
    });
  }

  async deleteComment(commentId: string) {
    return prisma.comment.delete({
      where: { id: commentId }
    });
  }

  async createStory(data: {
    userId: string;
    caption?: string;
    mediaUrl: string;
    mediaType: MediaType;
    duration?: number;
    expiresInHours?: number;
  }) {
    const hours = data.expiresInHours || 24;
    return prisma.story.create({
      data: {
        userId: data.userId,
        caption: data.caption || '',
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        media: {
          create: {
            userId: data.userId,
            url: data.mediaUrl,
            type: data.mediaType,
            duration: data.duration || 0,
          },
        },
      },
      include: {
        media: true,
        user: { include: { profile: true } },
      },
    });
  }

  async getActiveStories(userId: string) {
    // Get followed users
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);
    followingIds.push(userId); // include own stories

    return prisma.story.findMany({
      where: {
        userId: { in: followingIds },
        expiresAt: { gt: new Date() },
      },
      include: {
        media: true,
        user: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async savePost(userId: string, postId: string) {
    return prisma.savedPost.create({
      data: {
        userId,
        postId,
      },
    });
  }

  async unsavePost(userId: string, postId: string) {
    return prisma.savedPost.delete({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });
  }

  async getSavedPosts(userId: string) {
    return prisma.savedPost.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            media: true,
            user: { include: { profile: true } },
            originalPost: {
              include: {
                media: true,
                user: { include: { profile: true } },
              }
            }
          },
        },
      },
    });
  }
}

export default new PostRepository();
