import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import storyController from '../controllers/StoryController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ─── Stories ──────────────────────────────────────────────────────────────────
router.get('/feed', storyController.getFeedStories.bind(storyController));
router.get('/archive', storyController.getArchive.bind(storyController));
router.post('/', storyController.createStory.bind(storyController));
router.delete('/:id', storyController.deleteStory.bind(storyController));

// ─── Drafts ───────────────────────────────────────────────────────────────────
router.post('/drafts', storyController.saveDraft.bind(storyController));
router.get('/drafts', storyController.getDrafts.bind(storyController));

// ─── Views & Reactions ────────────────────────────────────────────────────────
router.post('/:id/view', storyController.viewStory.bind(storyController));
router.post('/:id/react', storyController.reactToStory.bind(storyController));
router.delete('/:id/react', storyController.removeReaction.bind(storyController));
router.post('/:id/like', storyController.likeStory.bind(storyController));
router.delete('/:id/like', storyController.unlikeStory.bind(storyController));
router.get('/:id/interactions', storyController.getStoryInteractions.bind(storyController));
router.get('/:id/analytics', storyController.getAnalytics.bind(storyController));
router.post('/:id/interaction', storyController.logInteraction.bind(storyController));
router.post('/:id/report', storyController.reportStory.bind(storyController));

// ─── Highlights ───────────────────────────────────────────────────────────────
router.post('/highlights', storyController.createHighlight.bind(storyController));
router.get('/highlights/:userId', storyController.getHighlights.bind(storyController));
router.post('/highlights/:highlightId/stories', storyController.addStoryToHighlight.bind(storyController));
router.delete('/highlights/:highlightId/stories/:storyId', storyController.removeStoryFromHighlight.bind(storyController));
router.delete('/highlights/:id', storyController.deleteHighlight.bind(storyController));

// ─── Close Friends ────────────────────────────────────────────────────────────
router.get('/close-friends', storyController.getCloseFriends.bind(storyController));
router.post('/close-friends', storyController.addCloseFriend.bind(storyController));
router.delete('/close-friends/:friendId', storyController.removeCloseFriend.bind(storyController));

export default router;
