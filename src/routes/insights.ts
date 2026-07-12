import { Router } from 'express';
import insightsController from '../controllers/InsightsController';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/overview', insightsController.getOverview as any);
router.get('/followers', insightsController.getFollowersGrowth as any);
router.get('/top-posts', insightsController.getTopPosts as any);

export default router;
