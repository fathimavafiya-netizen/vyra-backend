import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import storyController from '../controllers/StoryController';

const router = Router();

router.use(authMiddleware);

// Reels vertical feed
router.get('/feed', storyController.getReelsFeed.bind(storyController));

// Register unique view on a reel/video post
router.post('/:id/view', storyController.registerPostView.bind(storyController));

export default router;
