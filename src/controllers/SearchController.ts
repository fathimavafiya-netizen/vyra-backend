import { Response, NextFunction } from 'express';
import searchService from '../services/SearchService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class SearchController {
  async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const query = (req.query.q as string) || (req.query.query as string) || '';
      const type = (req.query.type as string) || 'all';
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const results = await searchService.search(userId, { query, type, page, limit });
      return res.status(200).json({ success: true, ...results });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getRecent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const recent = await searchService.getRecent(userId);
      return res.status(200).json({ success: true, recent });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getTrending(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const trending = await searchService.getTrending();
      return res.status(200).json({ success: true, trending });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getSuggestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = (req.query.q as string) || (req.query.query as string) || '';
      if (!query) {
        return res.status(200).json({ success: true, suggestions: [] });
      }

      const suggestions = await searchService.getSuggestions(query);
      return res.status(200).json({ success: true, suggestions });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new SearchController();
