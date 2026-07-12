import postRepository, { PostType, MediaType } from '../repositories/PostRepository';
import cache from '../utils/cache';
import rankPosts from '../utils/feedRanker';
import notificationService from './NotificationService';


export class PostService {
  async createPost(data: {
    userId: string;
    type: 'POST' | 'REEL' | 'VIDEO' | 'STORY' | 'LIVE';
    caption?: string;
    mediaUrl?: string; // fallback single URL
    media?: { url: string; type?: 'IMAGE' | 'VIDEO'; duration?: number; size?: number }[];
    duration?: number;
    size?: number;
    musicTrackId?: string;
    thumbnailUrl?: string;
    originalPostId?: string;
  }) {
    // 1. Map type and media structure
    let pTypeStr = data.type.toUpperCase();
    if (pTypeStr === 'SHORT_VIDEO') pTypeStr = 'REEL';
    if (pTypeStr === 'LONG_VIDEO') pTypeStr = 'VIDEO';
    
    // Auto-classify based on duration threshold of 90s
    if (pTypeStr === 'REEL' || pTypeStr === 'VIDEO') {
      const dur = data.duration || (data.media?.[0]?.duration);
      if (dur !== undefined && dur > 0) {
        pTypeStr = dur <= 90 ? 'REEL' : 'VIDEO';
      }
    }
    const pType = pTypeStr as PostType;

    // 2. Prepare media list
    const mediaItems: { url: string; type: MediaType; duration?: number; size?: number; order: number }[] = [];
    if (data.media && data.media.length > 0) {
      data.media.forEach((item, index) => {
        const itemType = item.type 
          ? (item.type === 'VIDEO' ? MediaType.VIDEO : MediaType.IMAGE)
          : (pType === 'REEL' || pType === 'VIDEO' ? MediaType.VIDEO : MediaType.IMAGE);
        
        mediaItems.push({
          url: item.url,
          type: itemType,
          duration: item.duration || 0,
          size: item.size || 0,
          order: index
        });
      });
    } else if (data.mediaUrl) {
      const mType = (pType === 'REEL' || pType === 'VIDEO') 
        ? MediaType.VIDEO 
        : MediaType.IMAGE;
      
      mediaItems.push({
        url: data.mediaUrl,
        type: mType,
        duration: data.duration || 0,
        size: data.size || 0,
        order: 0
      });
    } else if (pType !== PostType.POST && !data.originalPostId) {
      throw new Error('No media specified for post.');
    }

    // 3. Parse hashtags from caption
    const hashtags: string[] = [];
    if (data.caption) {
      const matches = data.caption.match(/#[a-zA-Z0-9_]+/g);
      if (matches) {
        matches.forEach(m => hashtags.push(m.substring(1)));
      }
    }

    if (pType === PostType.STORY) {
      // Stories go into the Story model
      return postRepository.createStory({
        userId: data.userId,
        caption: data.caption,
        mediaUrl: mediaItems[0]?.url || '',
        mediaType: mediaItems[0]?.type || MediaType.IMAGE,
        duration: data.duration,
      });
    }

    if (pType === PostType.LIVE) {
      // Live streams go into the LiveStream model
      return prisma.liveStream.create({
        data: {
          hostId: data.userId,
          title: data.caption || 'Live stream',
          isLive: true,
          channelName: mediaItems[0]?.url || 'live_stream_mock_channel',
          viewerCount: 0,
        },
        include: {
          host: { include: { profile: true } },
        }
      }) as any;
    }

    // Standard posts go into the Post model
    const post = await postRepository.create({
      userId: data.userId,
      type: pType,
      caption: data.caption,
      media: mediaItems.length > 0 ? mediaItems : undefined,
      hashtags,
      musicTrackId: data.musicTrackId,
      duration: data.duration,
      thumbnailUrl: data.thumbnailUrl,
      originalPostId: data.originalPostId,
    });

    // Invalidate feed caches
    await cache.invalidate('feed:*');

    // Parse and notify mentions
    if (data.caption) {
      const mentionMatches = data.caption.match(/@[a-zA-Z0-9_.]+/g);
      if (mentionMatches) {
        for (const mention of mentionMatches) {
          const cleanUsername = mention.replace('@', '').trim();
          const targetUser = await prisma.profile.findFirst({
            where: { username: cleanUsername },
            include: { user: true }
          });
          if (targetUser && targetUser.userId !== data.userId) {
            await notificationService.createNotification({
              userId: targetUser.userId,
              actorId: data.userId,
              type: 'POST_MENTION',
              targetType: 'POST',
              targetId: post.id,
              referenceId: post.id
            });
          }
        }
      }
    }

    return post;
  }

  async getFeed(userId: string, options: {
    type?: string;
    search?: string;
    sort?: string;
    limit?: number;
    cursor?: string;
  }) {
    // Only cache the initial feed load (no search query, no cursor pagination)
    const isInitialLoad = !options.search && !options.cursor;
    const cacheKey = `feed:${userId}:${options.type || 'all'}:${options.sort || 'default'}`;

    if (isInitialLoad) {
      const cached = await cache.get<any[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const sort = options.sort ? options.sort.toLowerCase() : 'newest';
    let posts: any[] = [];

    // Increase the limit pool for better ranking results if this is the initial load
    const limit = options.limit ?? 10;
    const fetchLimit = isInitialLoad ? Math.max(50, limit * 2) : limit;

    if (sort === 'following') {
      posts = await postRepository.findFeed(userId, { ...options, limit: fetchLimit });
    } else {
      posts = await postRepository.getGlobalFeed({ ...options, limit: fetchLimit });
    }

    // Get list of user IDs we are following to calculate relationship scores
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);

    // Apply ranking algorithm
    const rankedPosts = rankPosts(posts, userId, followingIds);

    // Deduplicate posts so that each unique content/original post appears at most once in the feed
    const uniquePosts: any[] = [];
    const seenContentKeys = new Set<string>();

    for (const post of rankedPosts) {
      const displayPost = (post as any).originalPost || post;
      const originalId = post.originalPostId || post.id;
      const mediaUrl = (displayPost as any).mediaUrl || (displayPost.media && displayPost.media[0]?.url);
      const contentKey = mediaUrl
        ? `media:${mediaUrl}`
        : ((displayPost as any).caption ? `caption:${(displayPost as any).caption.trim()}` : `id:${originalId}`);

      if (!seenContentKeys.has(contentKey)) {
        seenContentKeys.add(contentKey);
        uniquePosts.push(post);
      }
    }

    // Slice to the actual limit requested by client
    const finalPosts = uniquePosts.slice(0, limit);

    if (isInitialLoad && finalPosts.length > 0) {
      // Cache the ranked feed for 120 seconds
      await cache.set(cacheKey, finalPosts, 120);
    }

    return finalPosts;
  }

  async getUserPosts(userId: string, limit = 50) {
    const posts = await postRepository.findByUserId(userId, limit * 2);
    
    // Deduplicate posts so that each unique content/original post appears at most once in the profile feed
    const uniquePosts: any[] = [];
    const seenContentKeys = new Set<string>();

    for (const post of posts) {
      const displayPost = (post as any).originalPost || post;
      const originalId = post.originalPostId || post.id;
      const mediaUrl = (displayPost as any).mediaUrl || (displayPost.media && displayPost.media[0]?.url);
      const contentKey = mediaUrl
        ? `media:${mediaUrl}`
        : ((displayPost as any).caption ? `caption:${(displayPost as any).caption.trim()}` : `id:${originalId}`);

      if (!seenContentKeys.has(contentKey)) {
        seenContentKeys.add(contentKey);
        uniquePosts.push(post);
      }
    }
    return uniquePosts.slice(0, limit);
  }

  async getPostById(id: string) {
    const post = await postRepository.findById(id);
    if (!post) throw new Error('Post not found');
    return post;
  }

  async deletePost(postId: string, userId: string) {
    const post = await postRepository.findById(postId);
    if (!post) throw new Error('Post not found');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    const isAdmin = user?.role === 'ADMIN';

    if (post.userId !== userId && !isAdmin) {
      throw new Error('Unauthorized to delete this post');
    }

    await postRepository.delete(postId);
    return true;
  }

  async toggleLike(postId: string, userId: string) {
    const post = await postRepository.findById(postId);
    if (!post) throw new Error('Post not found');

    const hasLiked = await postRepository.hasLiked(postId, userId);
    let result;
    if (hasLiked) {
      await postRepository.removeLike(postId, userId);
      result = { liked: false };
    } else {
      await postRepository.addLike(postId, userId);
      
      // Trigger notification if not self-like
      if (post.userId !== userId) {
        await notificationService.createNotification({
          userId: post.userId,
          actorId: userId,
          type: 'POST_LIKE',
          targetType: 'POST',
          targetId: postId,
          referenceId: postId
        });
      }
      result = { liked: true };
    }

    await cache.invalidate('feed:*');
    return result;
  }

  async addComment(postId: string, userId: string, text: string, parentId?: string) {
    const post = await postRepository.findById(postId);
    if (!post) throw new Error('Post not found');

    const comment = await postRepository.addComment(postId, userId, text, parentId);

    // Trigger notification if not self-comment
    // Trigger notification if not self-comment
    if (post.userId !== userId) {
      await notificationService.createNotification({
        userId: post.userId,
        actorId: userId,
        type: 'POST_COMMENT',
        targetType: 'POST',
        targetId: postId,
        referenceId: postId,
        message: `commented on your post: "${text.substring(0, 30)}..."`
      });
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      if (parentComment && parentComment.userId !== userId) {
        await notificationService.createNotification({
          userId: parentComment.userId,
          actorId: userId,
          type: 'COMMENT_REPLY',
          targetType: 'COMMENT',
          targetId: parentId,
          referenceId: postId
        });
      }
    }

    await cache.invalidate('feed:*');
    return comment;
  }

  async getStories(userId: string) {
    const stories = await postRepository.getActiveStories(userId);
    
    // Group stories by user for client rendering (similar to original app structure)
    const grouped = new Map<string, any>();
    
    stories.forEach(story => {
      const userKey = story.userId;
      if (!grouped.has(userKey)) {
        grouped.set(userKey, {
          user: {
            _id: story.user.id,
            name: story.user.profile!.name,
            username: story.user.profile!.username,
            profilePic: story.user.profile!.profilePic,
          },
          stories: [],
        });
      }
      
      const mediaItem = story.media[0];
      grouped.get(userKey).stories.push({
        _id: story.id,
        mediaUrl: mediaItem ? mediaItem.url : '',
        mediaType: mediaItem ? mediaItem.type.toLowerCase() : 'image',
        caption: story.caption,
        createdAt: story.createdAt,
      });
    });

    return Array.from(grouped.values());
  }

  async toggleSavePost(postId: string, userId: string) {
    const post = await postRepository.findById(postId);
    if (!post) throw new Error('Post not found');

    // Check if already saved
    const saved = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (saved) {
      await postRepository.unsavePost(userId, postId);
      return { saved: false };
    } else {
      await postRepository.savePost(userId, postId);
      return { saved: true };
    }
  }

  async getSavedPosts(userId: string) {
    const savedList = await postRepository.getSavedPosts(userId);
    return savedList.map(item => item.post);
  }

  async createCollection(userId: string, name: string) {
    const cleanedName = name.trim();
    if (!cleanedName) throw new Error('Collection name cannot be empty.');

    const exists = await prisma.savedCollection.findUnique({
      where: {
        userId_name: {
          userId,
          name: cleanedName,
        },
      },
    });

    if (exists) throw new Error('A collection with this name already exists.');

    return prisma.savedCollection.create({
      data: {
        userId,
        name: cleanedName,
      },
    });
  }

  async getCollections(userId: string) {
    return prisma.savedCollection.findMany({
      where: { userId },
      include: {
        posts: {
          include: {
            post: {
              include: {
                media: { orderBy: { order: 'asc' } },
                user: { include: { profile: true } },
              },
            },
          },
        },
      },
    });
  }

  async addPostToCollection(collectionId: string, postId: string, userId: string) {
    const collection = await prisma.savedCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) throw new Error('Collection not found.');
    if (collection.userId !== userId) throw new Error('Unauthorized to modify this collection.');

    // Verify post is already saved by user
    const saved = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!saved) {
      // Auto-save the post first if not already saved!
      await prisma.savedPost.create({
        data: { userId, postId },
      });
    }

    // Verify not already in collection
    const exists = await prisma.savedCollectionPost.findUnique({
      where: {
        collectionId_postId: {
          collectionId,
          postId,
        },
      },
    });

    if (exists) throw new Error('Post is already in this collection.');

    return prisma.savedCollectionPost.create({
      data: {
        collectionId,
        postId,
      },
    });
  }

  async removePostFromCollection(collectionId: string, postId: string, userId: string) {
    const collection = await prisma.savedCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) throw new Error('Collection not found.');
    if (collection.userId !== userId) throw new Error('Unauthorized to modify this collection.');

    await prisma.savedCollectionPost.delete({
      where: {
        collectionId_postId: {
          collectionId,
          postId,
        },
      },
    });

    return true;
  }

  async deleteCollection(collectionId: string, userId: string) {
    const collection = await prisma.savedCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) throw new Error('Collection not found.');
    if (collection.userId !== userId) throw new Error('Unauthorized to delete this collection.');

    await prisma.savedCollection.delete({
      where: { id: collectionId },
    });

    return true;
  }

  async toggleRestrictUser(restrictorId: string, restrictedId: string) {
    if (restrictorId === restrictedId) throw new Error('You cannot restrict yourself.');

    const exists = await prisma.restrictedUser.findUnique({
      where: {
        restrictorId_restrictedId: {
          restrictorId,
          restrictedId,
        },
      },
    });

    if (exists) {
      await prisma.restrictedUser.delete({
        where: { id: exists.id },
      });
      return { restricted: false };
    } else {
      await prisma.restrictedUser.create({
        data: {
          restrictorId,
          restrictedId,
        },
      });
      return { restricted: true };
    }
  }

  async reportPost(postId: string, reporterId: string, reason: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) throw new Error('Post not found.');

    return prisma.report.create({
      data: {
        reporterId,
        reportedPostId: postId,
        reason,
      },
    });
  }

  async reportUser(reportedUserId: string, reporterId: string, reason: string) {
    const user = await prisma.user.findUnique({
      where: { id: reportedUserId },
    });

    if (!user) throw new Error('User not found.');

    return prisma.report.create({
      data: {
        reporterId,
        reportedUserId,
        reason,
      },
    });
  }

  async repost(originalPostId: string, userId: string, caption?: string) {
    const post = await postRepository.repost(originalPostId, userId, caption);
    await cache.invalidate('feed:*');

    // Trigger notification if not self-repost
    const original = await postRepository.findById(originalPostId);
    if (original && original.userId !== userId) {
      await notificationService.createNotification({
        userId: original.userId,
        actorId: userId,
        type: 'POST_REPOST',
        targetType: 'POST',
        targetId: originalPostId,
        referenceId: post.id
      });
    }

    return post;
  }

  async getPostLikes(postId: string, options: { cursor?: string; limit?: number }) {
    return postRepository.getPostLikes(postId, options);
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true }
    });
    if (!comment) throw new Error('Comment not found');

    if (comment.userId !== userId && comment.post.userId !== userId) {
      throw new Error('Unauthorized to delete this comment');
    }

    await postRepository.deleteComment(commentId);
    await cache.invalidate('feed:*');
    return true;
  }
}

// Prisma import helper for direct queries where needed
import prisma from '../config/db';

export default new PostService();
