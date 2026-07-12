import { Router } from 'express';
import notificationController from '../controllers/NotificationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/unread-count', notificationController.unreadCount);
router.get('/', notificationController.list);
router.patch('/read-all', notificationController.readAll);
router.patch('/:id/read', notificationController.read);
router.delete('/:id', notificationController.delete);

export default router;
