import { Router } from 'express';
import liveController from '../controllers/LiveController';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/start', liveController.start as any);
router.patch('/:id/end', liveController.end as any);
router.get('/', liveController.list as any);
router.get('/:id', liveController.getDetails as any);

export default router;
