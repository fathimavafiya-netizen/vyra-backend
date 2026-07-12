import { Router } from 'express';
import postController from '../controllers/PostController';
import authMiddleware from '../middleware/authMiddleware';
import validateRequest from '../middleware/validationMiddleware';
import { createPostSchema, addCommentSchema } from '../validators/post.validator';

const router = Router();

router.use(authMiddleware);

router.get('/feed', postController.getFeed);
router.get('/user/:userId', postController.getUserPosts);
router.post('/', validateRequest(createPostSchema), postController.createPost);
router.delete('/:id', postController.deletePost);

router.post('/:id/like', postController.toggleLike);
router.get('/:id/likes', postController.getPostLikes);
router.post('/:id/comment', validateRequest(addCommentSchema), postController.addComment);
router.delete('/comment/:id', postController.deleteComment);
router.post('/:id/repost', postController.repost);

router.get('/stories', postController.getStories);
router.post('/:id/save', postController.toggleSave);
router.delete('/:id/save', postController.toggleSave);
router.get('/saved', postController.getSavedPosts);

// Saved Collections Folders
router.post('/collections', postController.createCollection);
router.get('/collections', postController.getCollections);
router.post('/collections/:id/add', postController.addPostToCollection);
router.post('/collections/:id/remove', postController.removePostFromCollection);
router.delete('/collections/:id', postController.deleteCollection);

// Content Reporting
router.post('/report', postController.reportPost);

// GET trending posts
router.get('/trending', postController.getTrending as any);

// POST view tracking
router.post('/:id/view', postController.recordView as any);

// GET single post by ID (keep at bottom to prevent conflicts)
router.get('/:id', postController.getPostById);

export default router;
