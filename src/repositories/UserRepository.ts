import prisma from '../config/db';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        settings: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        settings: true,
      },
    });
  }

  async findByMobile(mobile: string) {
    return prisma.user.findUnique({
      where: { mobile },
      include: {
        profile: true,
        settings: true,
      },
    });
  }

  async findByUsername(username: string) {
    return prisma.profile.findUnique({
      where: { username },
      include: { user: true },
    });
  }

  async create(data: {
    email?: string;
    mobile?: string;
    passwordHash: string;
    name: string;
    username: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        mobile: data.mobile,
        password: data.passwordHash,
        profile: {
          create: {
            name: data.name,
            username: data.username,
          },
        },
        settings: {
          create: {},
        },
      },
      include: {
        profile: true,
      },
    });
  }

  async updateProfile(userId: string, data: {
    name?: string;
    bio?: string;
    profilePic?: string;
    coverPic?: string;
    username?: string;
  }) {
    return prisma.profile.update({
      where: { userId },
      data,
    });
  }

  async updateSettings(userId: string, data: {
    isPrivate?: boolean;
    darkMode?: boolean;
    likesEnabled?: boolean;
    commentsEnabled?: boolean;
    followersEnabled?: boolean;
    messagesEnabled?: boolean;
    mentionsEnabled?: boolean;
    aiEnabled?: boolean;
  }) {
    return prisma.userSettings.update({
      where: { userId },
      data,
    });
  }

  async followUser(followerId: string, followingId: string) {
    return prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });
  }

  async unfollowUser(followerId: string, followingId: string) {
    return prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
  }

  async isFollowing(followerId: string, followingId: string) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
    return !!follow;
  }

  async blockUser(blockerId: string, blockedId: string) {
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      },
    });
    return prisma.blockedUser.create({
      data: {
        blockerId,
        blockedId,
      },
    });
  }

  async unblockUser(blockerId: string, blockedId: string) {
    return prisma.blockedUser.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
  }

  async muteUser(muterId: string, mutedId: string) {
    return prisma.muteUser.create({
      data: {
        muterId,
        mutedId,
      },
    });
  }

  async unmuteUser(muterId: string, mutedId: string) {
    return prisma.muteUser.delete({
      where: {
        muterId_mutedId: {
          muterId,
          mutedId,
        },
      },
    });
  }

  async getFollowers(userId: string) {
    return prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          include: { profile: true },
        },
      },
    });
  }

  async getFollowing(userId: string) {
    return prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          include: { profile: true },
        },
      },
    });
  }
}

export default new UserRepository();
