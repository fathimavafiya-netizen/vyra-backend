import { Router } from 'express';
import { getNotificationPreferences, updateNotificationPreferences } from '../controllers/SettingsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/notifications', authMiddleware, getNotificationPreferences);
router.put('/notifications', authMiddleware, updateNotificationPreferences);

export default router;
