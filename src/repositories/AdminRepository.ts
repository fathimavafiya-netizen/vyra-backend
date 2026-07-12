import prisma from '../config/db';
import { UserRole } from '../config/constants';

export class AdminRepository {
  /**
   * Get main dashboard stats (totals for users, posts, reports, calls)
   */
  async getDashboardStats() {
    const [totalUsers, totalPosts, totalReports, totalCalls] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.report.count(),
      prisma.call.count(),
    ]);

    return {
      totalUsers,
      totalPosts,
      totalReports,
      totalCalls,
    };
  }

  /**
   * Get count of distinct active users in the last N hours
   * Active user is someone who viewed a post or read a message in that window.
   */
  async getActiveUsers(hours = 24): Promise<number> {
    const timeLimit = new Date(Date.now() - hours * 3600 * 1000);

    const [views, reads] = await Promise.all([
      prisma.postView.findMany({
        where: { viewedAt: { gte: timeLimit } },
        select: { userId: true },
      }),
      prisma.messageRead.findMany({
        where: { readAt: { gte: timeLimit } },
        select: { userId: true },
      }),
    ]);

    const activeSet = new Set<string>();
    views.forEach(v => activeSet.add(v.userId));
    reads.forEach(r => activeSet.add(r.userId));

    return activeSet.size;
  }

  /**
   * Get growth statistics for time-series charts (daily users and posts)
   */
  async getGrowthMetrics(days = 30) {
    const dateLimit = new Date(Date.now() - days * 24 * 3600 * 1000);

    const [users, posts] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: dateLimit } },
        select: { createdAt: true },
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: dateLimit } },
        select: { createdAt: true },
      }),
    ]);

    // Group in memory by ISO date key YYYY-MM-DD
    const dailyStats = new Map<string, { newUsers: number; newPosts: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      dailyStats.set(dateStr, { newUsers: 0, newPosts: 0 });
    }

    users.forEach(u => {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (dailyStats.has(key)) {
        dailyStats.get(key)!.newUsers++;
      }
    });

    posts.forEach(p => {
      const key = p.createdAt.toISOString().slice(0, 10);
      if (dailyStats.has(key)) {
        dailyStats.get(key)!.newPosts++;
      }
    });

    return Array.from(dailyStats.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Paginated, searchable user list for role promotion/ban management
   */
  async getUserList(query = '', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const searchLower = query.toLowerCase();

    const where = query
      ? {
          OR: [
            { email: { contains: searchLower } },
            { profile: { name: { contains: searchLower } } },
            { profile: { username: { contains: searchLower } } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { profile: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  /**
   * Update a user's role (promote/demote)
   */
  async updateUserRole(userId: string, role: string) {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error('User not found');

    return prisma.user.update({
      where: { id: userId },
      data: { role },
      include: { profile: true },
    });
  }

  /**
   * Ban a user and invalidate all their sessions
   * Policy check: Cannot ban an ADMIN user.
   */
  async banUser(userId: string, reason: string, adminId: string) {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error('User not found');

    if (target.role === UserRole.ADMIN) {
      throw new Error('Policy violation: Admins cannot be banned');
    }

    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isBanned: true, bannedReason: reason },
      }),
      prisma.session.deleteMany({
        where: { userId },
      }),
    ]);
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, bannedReason: null },
    });
  }

  /**
   * Fetch paginated report queue
   */
  async getReports(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { include: { profile: true } },
          reportedUser: { include: { profile: true } },
          reportedPost: { include: { media: true, user: { include: { profile: true } } } },
          resolvedBy: { include: { profile: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.report.count({ where }),
    ]);

    return { reports, total, page, limit };
  }

  /**
   * Resolve a moderation report with status and optional admin note
   */
  async resolveReport(reportId: string, action: 'RESOLVED' | 'DISMISSED', note: string, adminId: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    return prisma.report.update({
      where: { id: reportId },
      data: {
        status: action,
        resolvedById: adminId,
        resolvedAt: new Date(),
        adminNote: note,
      },
      include: {
        reporter: { include: { profile: true } },
        resolvedBy: { include: { profile: true } },
      },
    });
  }

  /**
   * Get flagged content for moderation (posts with reports or all hidden posts)
   */
  async getContentList(type = 'all', isHidden?: boolean, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (type !== 'all') {
      where.type = type.toUpperCase();
    }
    if (typeof isHidden === 'boolean') {
      where.isHidden = isHidden;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          media: true,
          user: { include: { profile: true } },
          reports: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    return { posts, total, page, limit };
  }

  /**
   * Soft-hide a post or reel from feeds
   */
  async hideContent(contentId: string, isHidden = true) {
    const post = await prisma.post.findUnique({ where: { id: contentId } });
    if (!post) throw new Error('Content not found');

    return prisma.post.update({
      where: { id: contentId },
      data: { isHidden },
      include: { media: true, user: { include: { profile: true } } },
    });
  }
}

export default new AdminRepository();
