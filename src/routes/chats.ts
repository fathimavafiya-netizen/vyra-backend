import { Router } from 'express';
import chatController from '../controllers/ChatController';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

// ─────────────────────────────────────────
// Conversations
// ─────────────────────────────────────────
router.get('/conversations', chatController.getConversations);
router.post('/direct', chatController.getOrCreateDirectChat);
router.post('/group', chatController.createGroupChat);
router.patch('/group/:id', chatController.updateGroup);

// ─────────────────────────────────────────
// Messages
// ─────────────────────────────────────────
router.get('/conversations/:id/messages', chatController.getMessages);
router.get('/conversations/:id/search', chatController.searchMessages);
router.post('/messages', chatController.sendMessage);
router.post('/messages/:id/read', chatController.markMessageRead);
router.patch('/messages/:id', chatController.editMessage);
router.delete('/messages/:id', chatController.deleteMessage);

// ─────────────────────────────────────────
// Reactions
// ─────────────────────────────────────────
router.post('/messages/:id/reactions', chatController.reactToMessage);
router.delete('/messages/:id/reactions', chatController.removeReaction);

// ─────────────────────────────────────────
// Read receipts
// ─────────────────────────────────────────
router.post('/conversations/:id/read-all', chatController.markAllRead);
router.get('/conversations/:id/unread', chatController.getUnreadCount);

// ─────────────────────────────────────────
// Presence
// ─────────────────────────────────────────
router.get('/presence/:userId', chatController.getPresence);

// ─────────────────────────────────────────
// Calls (Phase 4B)
// ─────────────────────────────────────────
router.get('/calls/history', chatController.getCallHistory);

// ─────────────────────────────────────────
// Client compatibility aliases
// ─────────────────────────────────────────
router.get('/', chatController.getConversations);
router.get('/:id', chatController.getMessages);

export default router;
