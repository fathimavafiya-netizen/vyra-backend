import prisma from '../config/db';
import { MessageStatus, MemberRole } from '../config/constants';

export const MessageType = {
  TEXT:  'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  VOICE: 'VOICE',
} as const;
export type MessageType = typeof MessageType[keyof typeof MessageType];

export class ChatRepository {
  // ─────────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────────

  async getConversations(userId: string) {
    return prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: { user: { include: { profile: true } } },
        },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findDirectConversation(user1Id: string, user2Id: string) {
    const chats = await prisma.conversation.findMany({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: user1Id } } },
          { members: { some: { userId: user2Id } } },
        ],
      },
      include: {
        members: { include: { user: { include: { profile: true } } } },
      },
    });
    return chats.find(c => c.members.length === 2) || null;
  }

  async createDirectConversation(user1Id: string, user2Id: string) {
    return prisma.conversation.create({
      data: {
        isGroup: false,
        members: {
          create: [
            { userId: user1Id, role: MemberRole.MEMBER },
            { userId: user2Id, role: MemberRole.MEMBER },
          ],
        },
      },
      include: {
        members: { include: { user: { include: { profile: true } } } },
      },
    });
  }

  async createGroupConversation(name: string, adminId: string, memberIds: string[]) {
    return prisma.conversation.create({
      data: {
        name,
        isGroup: true,
        members: {
          create: [
            { userId: adminId, role: MemberRole.ADMIN },
            ...memberIds.map(id => ({ userId: id, role: MemberRole.MEMBER })),
          ],
        },
      },
      include: {
        members: { include: { user: { include: { profile: true } } } },
      },
    });
  }

  /**
   * Update group: rename, add or remove members.
   * Only the group ADMIN may perform these operations.
   */
  async updateGroup(
    conversationId: string,
    adminId: string,
    data: { name?: string; addMemberIds?: string[]; removeMemberIds?: string[] },
  ) {
    // Verify caller is admin
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: adminId } },
    });
    if (!membership || membership.role !== MemberRole.ADMIN) {
      throw new Error('Only an admin can update the group');
    }

    return prisma.$transaction(async tx => {
      // Rename
      if (data.name) {
        await tx.conversation.update({ where: { id: conversationId }, data: { name: data.name } });
      }

      // Add members (ignore duplicates)
      if (data.addMemberIds && data.addMemberIds.length > 0) {
        for (const userId of data.addMemberIds) {
          await tx.conversationMember.upsert({
            where: { conversationId_userId: { conversationId, userId } },
            update: {},
            create: { conversationId, userId, role: MemberRole.MEMBER },
          });
        }
      }

      // Remove members (cannot remove admin)
      if (data.removeMemberIds && data.removeMemberIds.length > 0) {
        await tx.conversationMember.deleteMany({
          where: {
            conversationId,
            userId: { in: data.removeMemberIds },
            role: { not: MemberRole.ADMIN },
          },
        });
      }

      return tx.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: { include: { user: { include: { profile: true } } } },
        },
      });
    });
  }

  // ─────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────

  async getMessages(conversationId: string, limit = 50, cursor?: string) {
    return prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { include: { profile: true } },
        reads: true,
        reactions: { include: { user: { include: { profile: true } } } },
        replyTo: {
          include: { sender: { include: { profile: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async searchMessages(conversationId: string, query: string, userId: string) {
    // 1. Confirm membership
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) {
      throw new Error('Unauthorized: You are not a member of this conversation');
    }

    // 2. Search term case-insensitively
    return prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        text: {
          contains: query,
        },
      },
      include: {
        sender: { include: { profile: true } },
        reads: true,
        reactions: { include: { user: { include: { profile: true } } } },
        replyTo: {
          include: { sender: { include: { profile: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMessage(data: {
    conversationId: string;
    senderId: string;
    text?: string;
    type?: MessageType;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaDuration?: number;
    mediaSize?: number;
    replyToId?: string;
  }) {
    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        text: data.text || '',
        type: data.type || MessageType.TEXT,
        status: MessageStatus.SENT,
        mediaUrl: data.mediaUrl,
        thumbnailUrl: data.thumbnailUrl,
        mediaDuration: data.mediaDuration,
        mediaSize: data.mediaSize,
        replyToId: data.replyToId,
      },
      include: {
        sender: { include: { profile: true } },
        reads: true,
        reactions: true,
        replyTo: { include: { sender: { include: { profile: true } } } },
      },
    });

    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async editMessage(messageId: string, senderId: string, text: string) {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== senderId) throw new Error('Cannot edit another user\'s message');
    if (msg.isDeleted) throw new Error('Cannot edit a deleted message');

    return prisma.message.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
      include: {
        sender: { include: { profile: true } },
        reads: true,
        reactions: true,
      },
    });
  }

  async softDeleteMessage(messageId: string, senderId: string) {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== senderId) throw new Error('Cannot delete another user\'s message');

    return prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, text: '' },
    });
  }

  // ─────────────────────────────────────────
  // Reactions
  // ─────────────────────────────────────────

  async addReaction(messageId: string, userId: string, emoji: string) {
    return prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { emoji },
      create: { messageId, userId, emoji },
    });
  }

  async removeReaction(messageId: string, userId: string) {
    await prisma.messageReaction.deleteMany({ where: { messageId, userId } });
  }

  // ─────────────────────────────────────────
  // Read Status
  // ─────────────────────────────────────────

  async markAsRead(messageId: string, userId: string) {
    return prisma.messageRead.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: {},
      create: { messageId, userId },
    });
  }

  async updateMessageStatus(messageId: string, status: string) {
    return prisma.message.update({
      where: { id: messageId },
      data: { status },
    });
  }

  async markAllRead(conversationId: string, userId: string) {
    // Find the last message in the conversation
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastMessage) return;

    // Update member's lastReadMessageId
    await prisma.conversationMember.updateMany({
      where: { conversationId, userId },
      data: { lastReadMessageId: lastMessage.id },
    });

    // Mark all messages as READ where we were not the sender
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
      },
      data: { status: MessageStatus.READ },
    });
  }

  async getUnreadCount(conversationId: string, userId: string) {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!member || !member.lastReadMessageId) {
      // Count all messages not sent by this user
      return prisma.message.count({
        where: { conversationId, senderId: { not: userId }, isDeleted: false },
      });
    }

    const lastRead = await prisma.message.findUnique({
      where: { id: member.lastReadMessageId },
    });

    if (!lastRead) {
      return prisma.message.count({
        where: { conversationId, senderId: { not: userId }, isDeleted: false },
      });
    }

    return prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        isDeleted: false,
        createdAt: { gt: lastRead.createdAt },
      },
    });
  }

  // ─────────────────────────────────────────
  // Presence
  // ─────────────────────────────────────────

  async updateLastSeen(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } });
  }

  async getPresence(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, lastSeen: true },
    });
  }
}

export default new ChatRepository();
