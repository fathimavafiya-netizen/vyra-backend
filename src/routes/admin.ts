import { Router } from 'express';
import adminController from '../controllers/AdminController';
import adminStoryController from '../controllers/AdminStoryController';
import authMiddleware from '../middleware/authMiddleware';
import adminMiddleware from '../middleware/adminMiddleware';

const router = Router();

// Protect all admin routes behind login first, then Admin/Mod role checks
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard & Analytics
router.get('/dashboard', adminController.getDashboardMetrics);
router.get('/growth', adminController.getGrowthMetrics);

// User Moderation
router.get('/users', adminController.getUserList);
router.put('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/ban', adminController.banUser);
router.post('/users/:id/unban', adminController.unbanUser);

// Report Moderation
router.get('/reports', adminController.getReports);
router.post('/reports/:id/resolve', adminController.resolveReport);

// Content Moderation
router.get('/content', adminController.getContentList);
router.post('/content/:id/hide', adminController.hideContent);

// Story Moderation
router.get('/stories/reported', adminStoryController.listReportedStories.bind(adminStoryController));
router.post('/stories/:id/approve', adminStoryController.approveStory.bind(adminStoryController));
router.delete('/stories/:id', adminStoryController.deleteStory.bind(adminStoryController));

// Legacy/Compatibility alias
router.post('/posts/:id/hide', (req, res, next) => {
  // Map parameters to hideContent body
  req.body.isHidden = true;
  return adminController.hideContent(req, res, next);
});

export default router;
