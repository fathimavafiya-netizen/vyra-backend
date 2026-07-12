import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class InsightsController {
  async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      // Follower count
      const followerCount = await prisma.follow.count({
        where: { followingId: userId },
      });

      // Reach & impressions mock based on views and likes
      const posts = await prisma.post.findMany({
        where: { userId },
        include: {
          views: true,
          likes: true,
          comments: true,
        },
      });

      const totalViews = posts.reduce((sum, p) => sum + p.views.length, 0);
      const totalLikes = posts.reduce((sum, p) => sum + p.likes.length, 0);
      const totalComments = posts.reduce((sum, p) => sum + p.comments.length, 0);

      // Organic calculation: reach is views + 1.5 * likes, impressions is views * 1.8
      const reach = Math.max(10, totalViews + Math.round(totalLikes * 1.5));
      const impressions = Math.max(15, Math.round(totalViews * 1.8) + totalLikes);

      return res.status(200).json({
        success: true,
        data: {
          followerCount,
          totalPosts: posts.length,
          reach,
          impressions,
          totalLikes,
          totalComments,
        },
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getFollowersGrowth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      // Fetch follows grouped by date in the last 30 days
      const follows = await prisma.follow.findMany({
        where: {
          followingId: userId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Group by date
      const growthData: { date: string; count: number }[] = [];
      const countsMap: { [key: string]: number } = {};

      follows.forEach((f) => {
        const dateStr = f.createdAt.toISOString().split('T')[0];
        countsMap[dateStr] = (countsMap[dateStr] || 0) + 1;
      });

      // Fill in all 30 days with cumulative growth
      let cumulative = await prisma.follow.count({
        where: {
          followingId: userId,
          createdAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      });

      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        cumulative += countsMap[dateStr] || 0;
        growthData.push({ date: dateStr, count: cumulative });
      }

      return res.status(200).json({
        success: true,
        data: growthData,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getTopPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const posts = await prisma.post.findMany({
        where: { userId },
        include: {
          likes: true,
          comments: true,
          views: true,
          media: true,
        },
      });

      // Map to include engagement score and sort
      const mapped = posts.map((p) => {
        const likesCount = p.likes.length;
        const commentsCount = p.comments.length;
        const viewsCount = p.views.length;
        const engagement = likesCount * 2 + commentsCount * 5 + viewsCount;

        return {
          id: p.id,
          caption: p.caption,
          type: p.type,
          mediaUrl: p.media?.[0]?.url || p.thumbnailUrl || '',
          likesCount,
          commentsCount,
          viewsCount,
          engagement,
          createdAt: p.createdAt,
        };
      });

      mapped.sort((a, b) => b.engagement - a.engagement);

      return res.status(200).json({
        success: true,
        data: mapped.slice(0, 5), // Top 5 posts
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new InsightsController();
