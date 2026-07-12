import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import adminRepository from '../repositories/AdminRepository';
import cache from '../utils/cache';

export class AdminController {
  /**
   * Get main dashboard metrics (with 30-second Redis caching)
   */
  async getDashboardMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const cacheKey = 'admin:dashboard';
      const cachedData = await cache.get<any>(cacheKey);
      if (cachedData) {
        return res.status(200).json({ success: true, metrics: cachedData });
      }

      const [stats, activeUsers24h] = await Promise.all([
        adminRepository.getDashboardStats(),
        adminRepository.getActiveUsers(24),
      ]);

      const metrics = {
        ...stats,
        activeUsers24h,
        system: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
          uptimeSeconds: Math.round(process.uptime()),
        },
      };

      // Cache for 30 seconds
      await cache.set(cacheKey, metrics, 30);

      return res.status(200).json({ success: true, metrics });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * Get growth metrics for charts
   */
  async getGrowthMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const metrics = await adminRepository.getGrowthMetrics(days);
      return res.status(200).json({ success: true, metrics });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  /**
   * Get paginated user list
   */
  async getUserList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string) ?? '';
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminRepository.getUserList(q, page, limit);
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      if (!role) throw new Error('Role is required');

      const user = await adminRepository.updateUserRole(id, role);
      // Invalidate dashboard stats cache
      await cache.del('admin:dashboard');

      return res.status(200).json({ success: true, user });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  /**
   * Ban user
   */
  async banUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.id;

      if (!adminId) throw new Error('Unauthorized');
      if (!reason) throw new Error('Ban reason is required');

      await adminRepository.banUser(id, reason, adminId);
      // Invalidate dashboard stats cache
      await cache.del('admin:dashboard');

      return res.status(200).json({ success: true, message: 'User banned and all active sessions terminated' });
    } catch (e: any) {
      const status = e.message.includes('Policy') ? 403 : 400;
      return res.status(status).json({ success: false, message: e.message });
    }
  }

  /**
   * Unban user
   */
  async unbanUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await adminRepository.unbanUser(id);
      await cache.del('admin:dashboard');

      return res.status(200).json({ success: true, message: 'User unbanned successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  /**
   * Get reports queue
   */
  async getReports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = (req.query.status as string) ?? undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminRepository.getReports(status, page, limit);
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  /**
   * Resolve / dismiss report
   */
  async resolveReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { action, note } = req.body;
      const adminId = req.user?.id;

      if (!adminId) throw new Error('Unauthorized');
      if (!action || (action !== 'RESOLVED' && action !== 'DISMISSED')) {
        throw new Error('Action must be either "RESOLVED" or "DISMISSED"');
      }
      if (!note) throw new Error('Admin note is required');

      const report = await adminRepository.resolveReport(id, action, note, adminId);
      await cache.del('admin:dashboard');

      return res.status(200).json({ success: true, report });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  /**
   * Get list of content for moderation
   */
  async getContentList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as string) ?? 'all';
      const isHiddenStr = req.query.isHidden as string | undefined;
      const isHidden = isHiddenStr === 'true' ? true : isHiddenStr === 'false' ? false : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminRepository.getContentList(type, isHidden, page, limit);
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  /**
   * Soft-hide a post or reel from user feeds
   */
  async hideContent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isHidden } = req.body;
      const isHiddenBool = isHidden !== false; // defaults to true if not specified

      const post = await adminRepository.hideContent(id, isHiddenBool);
      // Invalidate feeds and stats caches
      await cache.del('admin:dashboard');
      await cache.invalidate('feed:*');

      return res.status(200).json({
        success: true,
        post,
        message: isHiddenBool ? 'Content hidden from feeds' : 'Content restored to feeds',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new AdminController();
