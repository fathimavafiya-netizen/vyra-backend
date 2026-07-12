import { Server, Socket } from 'socket.io';
import chatRepository from '../repositories/ChatRepository';
import chatService from '../services/ChatService';
import notificationService from '../services/NotificationService';
import { onlineUsers } from './state';
import { MessageStatus, NotificationType } from '../config/constants';
import logger from '../utils/logger';

export default function registerChatHandlers(io: Server, socket: Socket) {
  // Verified user id from JWT middleware — never trust client-provided sender
  const userId = (socket as any).userId as string;

  // ─────────────────────────────────────────
  // Room management
  // ─────────────────────────────────────────

  socket.on('join_room', (roomId: string) => {
    socket.join(roomId);
    logger.info(`🚪 Socket ${socket.id} joined chat room: ${roomId}`);
  });

  // ─────────────────────────────────────────
  // Send message
  // ─────────────────────────────────────────

  socket.on('send_message', async (data: {
    chatRoomId: string;
    text?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaDuration?: number;
    mediaSize?: number;
    mediaType?: string;
    type?: string;
    replyToId?: string;
  }) => {
    // Bug #2 fix: always use JWT-verified userId, ignore any client-provided senderId
    const { chatRoomId, text, mediaUrl, thumbnailUrl, mediaDuration, mediaSize, replyToId } = data;
    if (!chatRoomId) return;

    const msgType = (data.type || data.mediaType || 'TEXT').toUpperCase();

    try {
      const savedMessage = await chatService.sendMessage(userId, {
        conversationId: chatRoomId,
        text,
        type: msgType as any,
        mediaUrl,
        thumbnailUrl,
        mediaDuration,
        mediaSize,
        replyToId,
      });

      io.to(chatRoomId).emit('receive_message', savedMessage);

      // Notify other members in the conversation
      const conversations = await chatRepository.getConversations(userId);
      const conv = conversations.find(c => c.id === chatRoomId);
      if (conv) {
        for (const member of conv.members) {
          if (member.userId === userId) continue;
          await notificationService.send({
            userId: member.userId,
            type: NotificationType.NEW_MESSAGE,
            title: 'New Message',
            message: text || (mediaUrl ? '📎 Media' : 'Message'),
            referenceId: chatRoomId,
          });
        }
      }

      logger.info(`✉️ Message sent in room ${chatRoomId}: type=${msgType}`);
    } catch (error: any) {
      socket.emit('chat_error', { event: 'send_message', error: error.message });
      logger.error(`send_message socket error: ${error.message}`);
    }
  });

  // ─────────────────────────────────────────
  // Edit message
  // ─────────────────────────────────────────

  socket.on('edit_message', async (data: { messageId: string; chatRoomId: string; text: string }) => {
    const { messageId, chatRoomId, text } = data;
    if (!messageId || !chatRoomId || !text) return;

    try {
      const updated = await chatRepository.editMessage(messageId, userId, text);
      io.to(chatRoomId).emit('message_edited', {
        messageId,
        chatRoomId,
        text: updated.text,
        editedAt: updated.editedAt,
      });
    } catch (err: any) {
      socket.emit('chat_error', { event: 'edit_message', error: err.message });
    }
  });

  // ─────────────────────────────────────────
  // Delete message (soft)
  // ─────────────────────────────────────────

  socket.on('delete_message', async (data: { messageId: string; chatRoomId: string }) => {
    const { messageId, chatRoomId } = data;
    if (!messageId || !chatRoomId) return;

    try {
      await chatRepository.softDeleteMessage(messageId, userId);
      io.to(chatRoomId).emit('message_deleted', { messageId, chatRoomId });
    } catch (err: any) {
      socket.emit('chat_error', { event: 'delete_message', error: err.message });
    }
  });

  // ─────────────────────────────────────────
  // Reactions
  // ─────────────────────────────────────────

  socket.on('react_to_message', async (data: { messageId: string; chatRoomId: string; emoji: string }) => {
    const { messageId, chatRoomId, emoji } = data;
    if (!messageId || !chatRoomId || !emoji) return;

    try {
      const reaction = await chatRepository.addReaction(messageId, userId, emoji);
      io.to(chatRoomId).emit('message_reaction', {
        messageId,
        chatRoomId,
        userId,
        emoji: reaction.emoji,
      });
    } catch (err: any) {
      socket.emit('chat_error', { event: 'react_to_message', error: err.message });
    }
  });

  socket.on('remove_reaction', async (data: { messageId: string; chatRoomId: string }) => {
    const { messageId, chatRoomId } = data;
    if (!messageId || !chatRoomId) return;

    try {
      await chatRepository.removeReaction(messageId, userId);
      io.to(chatRoomId).emit('reaction_removed', { messageId, chatRoomId, userId });
    } catch (err: any) {
      socket.emit('chat_error', { event: 'remove_reaction', error: err.message });
    }
  });

  // ─────────────────────────────────────────
  // Read receipts
  // ─────────────────────────────────────────

  socket.on('mark_all_read', async (data: { chatRoomId: string }) => {
    const { chatRoomId } = data;
    if (!chatRoomId) return;

    try {
      const prisma = require('../config/db').default;
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: chatRoomId }
      });
      const otherMemberIds = members.map((m: any) => m.userId).filter((id: string) => id !== userId);

      const restrictions = await prisma.restrictedUser.findMany({
        where: {
          OR: [
            { restrictorId: userId, restrictedId: { in: otherMemberIds } },
            { restrictorId: { in: otherMemberIds }, restrictedId: userId },
          ]
        }
      });

      if (restrictions.length > 0) {
        return;
      }

      await chatRepository.markAllRead(chatRoomId, userId);
      io.to(chatRoomId).emit('all_read', { conversationId: chatRoomId, userId });
    } catch (err: any) {
      socket.emit('chat_error', { event: 'mark_all_read', error: err.message });
    }
  });

  socket.on('message_delivered', async (data: { messageId: string; chatRoomId: string }) => {
    const { messageId, chatRoomId } = data;
    if (!messageId || !chatRoomId) return;

    try {
      await chatRepository.updateMessageStatus(messageId, MessageStatus.DELIVERED);
      io.to(chatRoomId).emit('message_status', { messageId, status: MessageStatus.DELIVERED });
    } catch (err: any) {
      logger.error(`message_delivered error: ${err.message}`);
    }
  });

  socket.on('message_read', async (data: { chatRoomId: string; messageId: string }) => {
    const { chatRoomId, messageId } = data;
    if (!chatRoomId || !messageId) return;

    try {
      const prisma = require('../config/db').default;
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: chatRoomId }
      });
      const otherMemberIds = members.map((m: any) => m.userId).filter((id: string) => id !== userId);

      const restrictions = await prisma.restrictedUser.findMany({
        where: {
          OR: [
            { restrictorId: userId, restrictedId: { in: otherMemberIds } },
            { restrictorId: { in: otherMemberIds }, restrictedId: userId },
          ]
        }
      });

      if (restrictions.length > 0) {
        return;
      }

      await chatService.markMessageRead(userId, messageId);
      await chatRepository.updateMessageStatus(messageId, MessageStatus.READ);
      socket.to(chatRoomId).emit('message_status', { messageId, status: MessageStatus.READ, userId });
    } catch (err: any) {
      logger.error(`message_read socket error: ${err.message}`);
    }
  });

  // ─────────────────────────────────────────
  // Typing indicators
  // ─────────────────────────────────────────

  socket.on('typing_start', async (data: { chatRoomId: string }) => {
    const { chatRoomId } = data;
    if (!chatRoomId) return;
    try {
      const prisma = require('../config/db').default;
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: chatRoomId }
      });
      const otherMemberIds = members.map((m: any) => m.userId).filter((id: string) => id !== userId);

      const restrictions = await prisma.restrictedUser.findMany({
        where: {
          OR: [
            { restrictorId: userId, restrictedId: { in: otherMemberIds } },
            { restrictorId: { in: otherMemberIds }, restrictedId: userId },
          ]
        }
      });

      if (restrictions.length > 0) return;
      socket.to(chatRoomId).emit('user_typing', { chatRoomId, userId, isTyping: true });
    } catch (err) {}
  });

  socket.on('typing_stop', async (data: { chatRoomId: string }) => {
    const { chatRoomId } = data;
    if (!chatRoomId) return;
    try {
      const prisma = require('../config/db').default;
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: chatRoomId }
      });
      const otherMemberIds = members.map((m: any) => m.userId).filter((id: string) => id !== userId);

      const restrictions = await prisma.restrictedUser.findMany({
        where: {
          OR: [
            { restrictorId: userId, restrictedId: { in: otherMemberIds } },
            { restrictorId: { in: otherMemberIds }, restrictedId: userId },
          ]
        }
      });

      if (restrictions.length > 0) return;
      socket.to(chatRoomId).emit('user_typing', { chatRoomId, userId, isTyping: false });
    } catch (err) {}
  });
}

export { registerChatHandlers };
