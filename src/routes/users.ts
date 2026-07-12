import { Router } from 'express';
import userController from '../controllers/UserController';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

// Secure all user routes with authMiddleware
router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.get('/profile/username/:username', userController.getProfileByUsername);
router.get('/profile/:id', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/settings', userController.updateSettings);
router.put('/password', userController.changePassword);

router.get('/check-username/:username', userController.checkUsername);
router.post('/devices', userController.registerDevice);
router.delete('/account', userController.deleteAccount);

// Follow requests and follow endpoints
router.post('/:id/follow', userController.followUser);
router.delete('/:id/follow', userController.unfollowUser);

router.get('/follow-requests', userController.getFollowRequests);
router.post('/follow-requests/:id/accept', userController.acceptFollowRequest);
router.post('/follow-requests/:id/reject', userController.rejectFollowRequest);
router.post('/follow-requests/:id/cancel', userController.cancelFollowRequest);

router.get('/followers/:id?', userController.getFollowers);
router.get('/following/:id?', userController.getFollowing);

router.get('/blocked', userController.getBlockedUsers);
router.post('/block', userController.toggleBlock);
router.post('/mute', userController.toggleMute);
router.post('/fcm-token', userController.registerFcmToken);
router.delete('/fcm-token', userController.clearFcmToken);

// Restrict and Report User
import postController from '../controllers/PostController';
router.post('/:id/restrict', postController.toggleRestrictUser);
router.post('/report', postController.reportUser);

export default router;
