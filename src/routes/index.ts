import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import postRoutes from './posts';
import storyRoutes from './stories';
import reelRoutes from './reels';
import chatRoutes from './chats';
import searchRoutes from './search';
import aiRoutes from './ai';
import uploadRoutes from './upload';
import notificationRoutes from './notifications';
import adminRoutes from './admin';
import liveRoutes from './live';
import insightsRoutes from './insights';

const router = Router();

// Mount all versioned route modules under /api/v1
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/stories', storyRoutes);
router.use('/reels', reelRoutes);
router.use('/chat', chatRoutes);
router.use('/chats', chatRoutes);
router.use('/search', searchRoutes);
router.use('/ai', aiRoutes);
router.use('/upload', uploadRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/live', liveRoutes);
router.use('/insights', insightsRoutes);

export default router;
