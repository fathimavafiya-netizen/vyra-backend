import { Response, NextFunction } from 'express';
import chatService from '../services/ChatService';
import callRepository from '../repositories/CallRepository';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class ChatController {
  // ─────────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────────

  async getConversations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const chats = await chatService.getConversations(userId);
      return res.status(200).json({ success: true, chats });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getOrCreateDirectChat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { targetUserId } = req.body;
      if (!userId) throw new Error('Unauthorized');
      if (!targetUserId) throw new Error('Target user ID is required');
      const chat = await chatService.getOrCreateDirectChat(userId, targetUserId);
      return res.status(200).json({ success: true, chat });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async createGroupChat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { name, memberIds } = req.body;
      if (!userId) throw new Error('Unauthorized');
      const chat = await chatService.createGroupChat(userId, name, memberIds);
      return res.status(201).json({ success: true, chat });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async updateGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params; // conversationId
      const { name, addMemberIds, removeMemberIds } = req.body;
      const updated = await chatService.updateGroup(id, userId, { name, addMemberIds, removeMemberIds });
      return res.status(200).json({ success: true, conversation: updated });
    } catch (e: any) {
      const status = e.message.includes('admin') ? 403 : 400;
      return res.status(status).json({ success: false, message: e.message });
    }
  }

  // ─────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────

  async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const cursor = req.query.cursor as string | undefined;
      const messages = await chatService.getMessages(id, limit, cursor);
      return res.status(200).json({ success: true, messages });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async searchMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params;
      const query = req.query.q as string;
      if (!query) throw new Error('Search query "q" parameter is required');

      const messages = await chatService.searchMessages(id, query, userId);
      return res.status(200).json({ success: true, messages });
    } catch (e: any) {
      const status = e.message.includes('Unauthorized') ? 403 : 400;
      return res.status(status).json({ success: false, message: e.message });
    }
  }

  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const message = await chatService.sendMessage(userId, {
        conversationId: req.body.conversationId,
        text: req.body.text,
        type: req.body.type,
        mediaUrl: req.body.mediaUrl,
        thumbnailUrl: req.body.thumbnailUrl,
        mediaDuration: req.body.mediaDuration ? parseFloat(req.body.mediaDuration) : undefined,
        mediaSize: req.body.mediaSize ? parseInt(req.body.mediaSize, 10) : undefined,
        replyToId: req.body.replyToId,
      });
      return res.status(201).json({ success: true, message });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async editMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params;
      const { text } = req.body;
      if (!text) throw new Error('text is required');
      const message = await chatService.editMessage(userId, id, text);
      return res.status(200).json({ success: true, message });
    } catch (e: any) {
      const status = e.message.includes('Cannot edit') ? 403 : 400;
      return res.status(status).json({ success: false, message: e.message });
    }
  }

  async deleteMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params;
      await chatService.deleteMessage(userId, id);
      return res.status(200).json({ success: true, message: 'Message deleted' });
    } catch (e: any) {
      const status = e.message.includes('Cannot delete') ? 403 : 400;
      return res.status(status).json({ success: false, message: e.message });
    }
  }

  async markMessageRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) throw new Error('Unauthorized');
      await chatService.markMessageRead(userId, id);
      return res.status(200).json({ success: true, message: 'Message marked as read' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  // ─────────────────────────────────────────
  // Reactions
  // ─────────────────────────────────────────

  async reactToMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params;
      const { emoji } = req.body;
      if (!emoji) throw new Error('emoji is required');
      const reaction = await chatService.reactToMessage(userId, id, emoji);
      return res.status(200).json({ success: true, reaction });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async removeReaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params;
      await chatService.removeReaction(userId, id);
      return res.status(200).json({ success: true, message: 'Reaction removed' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  // ─────────────────────────────────────────
  // Read all / unread count
  // ─────────────────────────────────────────

  async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params; // conversationId
      await chatService.markAllRead(userId, id);
      return res.status(200).json({ success: true, message: 'All messages marked as read' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { id } = req.params; // conversationId
      const count = await chatService.getUnreadCount(userId, id);
      return res.status(200).json({ success: true, unreadCount: count });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  // ─────────────────────────────────────────
  // Presence
  // ─────────────────────────────────────────

  async getPresence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const presence = await chatService.getPresence([userId]);
      return res.status(200).json({ success: true, presence: presence[0] ?? null });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  // ─────────────────────────────────────────
  // Call history (Phase 4B)
  // ─────────────────────────────────────────

  async getCallHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const calls = await callRepository.getCallHistory(userId);
      const formatted = calls.map(c => ({
        _id: c.id,
        type: c.type,
        status: c.status,
        direction: c.callerId === userId ? 'outgoing' : 'incoming',
        duration: c.duration,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        caller: {
          _id: c.caller.id,
          name: c.caller.profile?.name ?? '',
          profilePic: c.caller.profile?.profilePic ?? '',
        },
        callee: {
          _id: c.callee.id,
          name: c.callee.profile?.name ?? '',
          profilePic: c.callee.profile?.profilePic ?? '',
        },
      }));
      return res.status(200).json({ success: true, calls: formatted });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new ChatController();
