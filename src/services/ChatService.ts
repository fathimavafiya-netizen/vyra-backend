import chatRepository, { MessageType } from '../repositories/ChatRepository';
import userRepository from '../repositories/UserRepository';
import { onlineUsers } from '../socket/state';
import { MemberRole } from '../config/constants';

function formatMessage(m: any) {
  return {
    _id: m.id,
    chatRoomId: m.conversationId,
    sender: {
      _id: m.sender.id,
      name: m.sender.profile?.name ?? '',
      profilePic: m.sender.profile?.profilePic ?? '',
    },
    text: m.isDeleted ? null : m.text,
    isDeleted: m.isDeleted,
    editedAt: m.editedAt ?? null,
    status: m.status,
    mediaUrl: m.mediaUrl,
    thumbnailUrl: m.thumbnailUrl,
    mediaType: m.type.toLowerCase(),
    mediaDuration: m.mediaDuration,
    mediaSize: m.mediaSize,
    replyTo: m.replyTo
      ? {
          _id: m.replyTo.id,
          text: m.replyTo.isDeleted ? null : m.replyTo.text,
          sender: {
            _id: m.replyTo.sender.id,
            name: m.replyTo.sender.profile?.name ?? '',
          },
        }
      : null,
    reactions: (m.reactions ?? []).map((r: any) => ({
      userId: r.userId,
      name: r.user?.profile?.name ?? '',
      emoji: r.emoji,
    })),
    readBy: (m.reads ?? []).map((r: any) => r.userId),
    createdAt: m.createdAt,
  };
}

export class ChatService {
  async getConversations(userId: string) {
    const list = await chatRepository.getConversations(userId);

    return list.map(c => {
      const otherMember = c.isGroup
        ? null
        : c.members.find(m => m.userId !== userId);

      const lastMsg = c.messages[0] || null;

      return {
        chatRoomId: c.id,
        name: c.isGroup ? c.name : (otherMember?.user.profile?.name ?? 'Vyra User'),
        isGroup: c.isGroup,
        memberCount: c.members.length,
        partner: otherMember
          ? {
              _id: otherMember.user.id,
              name: otherMember.user.profile!.name,
              profilePic: otherMember.user.profile!.profilePic,
              bio: otherMember.user.profile!.bio,
              isOnline: onlineUsers.has(otherMember.userId),
              lastSeen: (otherMember.user as any).lastSeen ?? null,
            }
          : {
              _id: 'deleted',
              name: 'Vyra User',
              profilePic:
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
              bio: '',
              isOnline: false,
              lastSeen: null,
            },
        latestMessage: lastMsg
          ? {
              _id: lastMsg.id,
              chatRoomId: c.id,
              sender: { _id: lastMsg.senderId },
              text: lastMsg.isDeleted ? null : (lastMsg.text || ''),
              isDeleted: lastMsg.isDeleted,
              status: lastMsg.status,
              mediaType: lastMsg.type.toLowerCase() as any,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : {
              _id: 'default',
              chatRoomId: c.id,
              sender: { _id: '' },
              text: 'No messages yet.',
              isDeleted: false,
              status: 'SENT',
              mediaType: 'text',
              createdAt: c.createdAt.toISOString(),
            },
      };
    });
  }

  async getOrCreateDirectChat(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new Error('You cannot chat with yourself');

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) throw new Error('Target user not found');

    let chat = await chatRepository.findDirectConversation(userId, targetUserId);
    if (!chat) {
      chat = await chatRepository.createDirectConversation(userId, targetUserId);
    }

    const otherMember = chat.members.find(m => m.userId !== userId);

    return {
      _id: chat.id,
      name: otherMember?.user.profile?.name ?? 'Vyra User',
      profilePic:
        otherMember?.user.profile?.profilePic ??
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      isGroup: chat.isGroup,
    };
  }

  async createGroupChat(userId: string, name: string, memberIds: string[]) {
    if (!name) throw new Error('Group name is required');
    if (!memberIds || memberIds.length === 0) throw new Error('At least one group member is required');

    const chat = await chatRepository.createGroupConversation(name, userId, memberIds);

    return {
      _id: chat.id,
      name: chat.name,
      profilePic:
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80',
      isGroup: chat.isGroup,
      memberCount: chat.members.length,
    };
  }

  async updateGroup(
    conversationId: string,
    adminId: string,
    data: { name?: string; addMemberIds?: string[]; removeMemberIds?: string[] },
  ) {
    return chatRepository.updateGroup(conversationId, adminId, data);
  }

  async getMessages(conversationId: string, limit = 50, cursor?: string) {
    const list = await chatRepository.getMessages(conversationId, limit, cursor);
    return list.map(formatMessage).reverse();
  }

  async searchMessages(conversationId: string, query: string, userId: string) {
    const list = await chatRepository.searchMessages(conversationId, query, userId);
    return list.map(formatMessage);
  }

  async sendMessage(
    userId: string,
    data: {
      conversationId: string;
      text?: string;
      type?: string;
      mediaUrl?: string;
      thumbnailUrl?: string;
      mediaDuration?: number;
      mediaSize?: number;
      replyToId?: string;
    },
  ) {
    const mType = (data.type || 'TEXT') as MessageType;
    const message = await chatRepository.createMessage({
      conversationId: data.conversationId,
      senderId: userId,
      text: data.text,
      type: mType,
      mediaUrl: data.mediaUrl,
      thumbnailUrl: data.thumbnailUrl,
      mediaDuration: data.mediaDuration,
      mediaSize: data.mediaSize,
      replyToId: data.replyToId,
    });

    return formatMessage(message);
  }

  async editMessage(userId: string, messageId: string, text: string) {
    const updated = await chatRepository.editMessage(messageId, userId, text);
    return formatMessage(updated);
  }

  async deleteMessage(userId: string, messageId: string) {
    await chatRepository.softDeleteMessage(messageId, userId);
    return true;
  }

  async reactToMessage(userId: string, messageId: string, emoji: string) {
    return chatRepository.addReaction(messageId, userId, emoji);
  }

  async removeReaction(userId: string, messageId: string) {
    await chatRepository.removeReaction(messageId, userId);
    return true;
  }

  async markMessageRead(userId: string, messageId: string) {
    await chatRepository.markAsRead(messageId, userId);
    return true;
  }

  async markAllRead(userId: string, conversationId: string) {
    await chatRepository.markAllRead(conversationId, userId);
    return true;
  }

  async getUnreadCount(userId: string, conversationId: string) {
    return chatRepository.getUnreadCount(conversationId, userId);
  }

  async getPresence(userIds: string[]) {
    const records = await chatRepository.getPresence(userIds);
    return records.map(r => ({
      userId: r.id,
      status: onlineUsers.has(r.id) ? 'online' : 'offline',
      lastSeen: r.lastSeen ? r.lastSeen.toISOString() : null,
    }));
  }
}

export default new ChatService();
