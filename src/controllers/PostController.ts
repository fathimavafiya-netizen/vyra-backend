import { Response, NextFunction } from 'express';
import postService from '../services/PostService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export async function formatPostResponse(p: any, viewerId?: string): Promise<any> {
  if (!p) return null;

  let blockedUserIds: string[] = [];
  let restrictedRelations: any[] = [];

  if (viewerId) {
    const { default: prisma } = require('../config/db');
    try {
      const blocks = await prisma.blockedUser.findMany({
        where: {
          OR: [
            { blockerId: viewerId },
            { blockedId: viewerId },
          ]
        }
      });
      blockedUserIds = blocks.map((b: any) => b.blockerId === viewerId ? b.blockedId : b.blockerId);
    } catch (err) {}

    try {
      restrictedRelations = await prisma.restrictedUser.findMany({
        where: {
          restrictorId: p.userId
        }
      });
    } catch (err) {}
  }

  return {
    _id: p.id,
    user: {
      _id: p.user.id,
      name: p.user.profile?.name || p.user.username || 'user',
      profilePic: p.user.profile?.profilePic || '',
      username: p.user.profile?.username || p.user.username || '',
    },
    type: p.type === 'REEL' ? 'short_video' : p.type === 'VIDEO' ? 'long_video' : 'post',
    caption: p.caption || '',
    hashtags: p.hashtags ? p.hashtags.map((h: any) => h.hashtag?.name || '') : [],
    media: p.media ? p.media.map((m: any) => ({
      url: m.url,
      type: m.type.toLowerCase(),
      order: m.order,
    })) : [],
    mediaUrl: p.media?.[0] ? p.media[0].url : '',
    mediaType: p.media?.[0] ? p.media[0].type.toLowerCase() : 'image',
    likes: p.likes ? p.likes.filter((l: any) => !blockedUserIds.includes(l.userId)).map((l: any) => l.userId) : [],
    comments: p.comments ? p.comments.filter((c: any) => {
      if (blockedUserIds.includes(c.user.id)) return false;
      const isRestricted = restrictedRelations.some((r: any) => r.restrictorId === p.userId && r.restrictedId === c.user.id);
      if (isRestricted) {
        return viewerId === c.user.id || viewerId === p.userId;
      }
      return true;
    }).map((c: any) => ({
      _id: c.id,
      user: {
        _id: c.user.id,
        name: c.user.profile?.name || c.user.username || 'user',
        profilePic: c.user.profile?.profilePic || '',
        username: c.user.profile?.username || c.user.username || '',
      },
      text: c.text,
      createdAt: c.createdAt,
    })) : [],
    createdAt: p.createdAt,
    duration: p.duration || 0,
    thumbnailUrl: p.thumbnailUrl || '',
    musicTrackId: p.musicTrackId || null,
    originalPost: p.originalPost ? {
      _id: p.originalPost.id,
      user: {
        _id: p.originalPost.user.id,
        name: p.originalPost.user.profile?.name || p.originalPost.user.username || 'user',
        profilePic: p.originalPost.user.profile?.profilePic || '',
        username: p.originalPost.user.profile?.username || p.originalPost.user.username || '',
      },
      type: p.originalPost.type === 'REEL' ? 'short_video' : p.originalPost.type === 'VIDEO' ? 'long_video' : 'post',
      caption: p.originalPost.caption || '',
      mediaUrl: p.originalPost.media?.[0] ? p.originalPost.media[0].url : '',
      mediaType: p.originalPost.media?.[0] ? p.originalPost.media[0].type.toLowerCase() : 'image',
      media: p.originalPost.media ? p.originalPost.media.map((m: any) => ({
        url: m.url,
        type: m.type.toLowerCase(),
        order: m.order,
      })) : [],
      createdAt: p.originalPost.createdAt,
    } : null,
  };
}

export class PostController {
  async getFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const cursor = req.query.cursor as string | undefined;

      const type = req.query.type as string | undefined;
      const search = req.query.search as string | undefined;
      const sort = req.query.sort as string | undefined;

      if (type === 'live') {
        const { default: prisma } = require('../config/db');
        const streams = await prisma.liveStream.findMany({
          where: { isLive: true },
          include: { host: { include: { profile: true } } }
        });
        const formattedStreams = streams.map((s: any) => ({
          _id: s.id,
          user: {
            _id: s.host.id,
            name: s.host.profile!.name,
            profilePic: s.host.profile!.profilePic,
          },
          type: 'live',
          caption: s.title,
          mediaUrl: s.channelName,
          mediaType: 'video',
          likes: [],
          comments: [],
          createdAt: s.createdAt,
          viewerCount: s.viewerCount,
        }));
        return res.status(200).json({ success: true, posts: formattedStreams });
      }

      const posts = await postService.getFeed(userId, {
        limit,
        cursor,
        type,
        search,
        sort,
      });
      
      const formattedPosts = await Promise.all(posts.map(p => formatPostResponse(p, userId)));

      return res.status(200).json({ success: true, posts: formattedPosts });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getUserPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      if (!userId) throw new Error('User identifier not provided');

      const posts = await postService.getUserPosts(userId, limit);
      const formattedPosts = await Promise.all(posts.map(p => formatPostResponse(p, req.user?.id)));
      return res.status(200).json({ success: true, posts: formattedPosts });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const post = await postService.createPost({
        userId,
        type: req.body.type,
        caption: req.body.caption,
        mediaUrl: req.body.mediaUrl,
        media: req.body.media,
        duration: req.body.duration,
        size: req.body.size,
        musicTrackId: req.body.musicTrackId,
        thumbnailUrl: req.body.thumbnailUrl,
        originalPostId: req.body.originalPostId,
      });

      return res.status(201).json({
        success: true,
        message: `${req.body.type} created successfully`,
        post,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) throw new Error('Unauthorized');

      await postService.deletePost(id, userId);
      return res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async toggleLike(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // postId
      if (!userId) throw new Error('Unauthorized');

      const result = await postService.toggleLike(id, userId);
      return res.status(200).json({
        success: true,
        message: result.liked ? 'Liked post' : 'Unliked post',
        ...result,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async addComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // postId
      const { text, parentId } = req.body;
      if (!userId) throw new Error('Unauthorized');

      const comment = await postService.addComment(id, userId, text, parentId);
      
      return res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        comment: {
          _id: comment.id,
          user: {
            _id: comment.user.id,
            name: comment.user.profile!.name,
            profilePic: comment.user.profile!.profilePic,
          },
          text: comment.text,
          createdAt: comment.createdAt,
        },
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getStories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const storyGroups = await postService.getStories(userId);
      return res.status(200).json({ success: true, stories: storyGroups });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async toggleSave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // postId
      if (!userId) throw new Error('Unauthorized');

      const result = await postService.toggleSavePost(id, userId);
      return res.status(200).json({
        success: true,
        message: result.saved ? 'Post saved' : 'Post unsaved',
        ...result,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getSavedPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const posts = await postService.getSavedPosts(userId);
      const formattedPosts = await Promise.all(posts.map(p => formatPostResponse(p, userId)));
      return res.status(200).json({ success: true, posts: formattedPosts });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async createCollection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { name } = req.body;
      if (!userId) throw new Error('Unauthorized');

      const collection = await postService.createCollection(userId, name);
      return res.status(201).json({ success: true, collection });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getCollections(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const collections = await postService.getCollections(userId);
      return res.status(200).json({ success: true, collections });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async addPostToCollection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // collectionId
      const { postId } = req.body;
      if (!userId) throw new Error('Unauthorized');

      const collectionPost = await postService.addPostToCollection(id, postId, userId);
      return res.status(200).json({ success: true, collectionPost });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async removePostFromCollection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // collectionId
      const { postId } = req.body;
      if (!userId) throw new Error('Unauthorized');

      await postService.removePostFromCollection(id, postId, userId);
      return res.status(200).json({ success: true, message: 'Post removed from collection.' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async deleteCollection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // collectionId
      if (!userId) throw new Error('Unauthorized');

      await postService.deleteCollection(id, userId);
      return res.status(200).json({ success: true, message: 'Collection deleted.' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async toggleRestrictUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // restrictedId
      if (!userId) throw new Error('Unauthorized');

      const result = await postService.toggleRestrictUser(userId, id);
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async reportPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { postId, reason } = req.body;
      if (!userId) throw new Error('Unauthorized');

      const report = await postService.reportPost(postId, userId, reason);
      return res.status(201).json({ success: true, report });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async reportUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { reportedUserId, reason } = req.body;
      if (!userId) throw new Error('Unauthorized');

      const report = await postService.reportUser(reportedUserId, userId, reason);
      return res.status(201).json({ success: true, report });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async repost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // originalPostId
      const { caption } = req.body;
      if (!userId) throw new Error('Unauthorized');

      const post = await postService.repost(id, userId, caption);
      return res.status(201).json({ success: true, post });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getPostLikes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // postId
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const cursor = req.query.cursor as string | undefined;

      const likes = await postService.getPostLikes(id, { cursor, limit });
      const formattedLikes = likes.map((l: any) => ({
        id: l.id,
        userId: l.user.id,
        name: l.user.profile!.name,
        username: l.user.profile!.username,
        profilePic: l.user.profile!.profilePic,
      }));
      return res.status(200).json({ success: true, likes: formattedLikes });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getPostById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await postService.getPostById(id);
      return res.status(200).json({ success: true, post: await formatPostResponse(post, req.user?.id) });
    } catch (e: any) {
      return res.status(404).json({ success: false, message: e.message });
    }
  }

  async deleteComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // commentId
      if (!userId) throw new Error('Unauthorized');

      await postService.deleteComment(id, userId);
      return res.status(200).json({ success: true, message: 'Comment deleted successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async recordView(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params; // postId
      if (!userId) throw new Error('Unauthorized');

      const { default: prisma } = require('../config/db');
      
      // Check if post already viewed by this user
      const existing = await prisma.postView.findUnique({
        where: {
          postId_userId: {
            postId: id,
            userId,
          },
        },
      });

      if (!existing) {
        await prisma.postView.create({
          data: {
            postId: id,
            userId,
          },
        });
      }

      return res.status(200).json({ success: true, message: 'View recorded successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getTrending(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const { default: prisma } = require('../config/db');

      const posts = await prisma.post.findMany({
        where: { isHidden: false, deletedAt: null },
        include: {
          user: { include: { profile: true } },
          media: true,
          likes: true,
          comments: { include: { user: { include: { profile: true } } } },
          views: true,
        },
        take: limit,
      });

      const trendingPosts = posts
        .map((p: any) => {
          const score = p.views.length + p.likes.length * 2 + p.comments.length * 5;
          return { post: formatPostResponse(p), score };
        })
        .sort((a: any, b: any) => b.score - a.score)
        .map((x: any) => x.post);

      return res.status(200).json({ success: true, posts: trendingPosts });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new PostController();
