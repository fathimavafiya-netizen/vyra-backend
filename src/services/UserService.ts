import userRepository from '../repositories/UserRepository';
import cache from '../utils/cache';
import prisma from '../config/db';
import notificationService from './NotificationService';

export class UserService {
  async getProfile(userId: string) {
    const cacheKey = `user_profile:${userId}`;
    const cachedProfile = await cache.get(cacheKey);
    if (cachedProfile) {
      return cachedProfile;
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    const followersList = await prisma.follow.findMany({ where: { followingId: userId } });
    const followingList = await prisma.follow.findMany({ where: { followerId: userId } });
    const sentList = await prisma.followRequest.findMany({ where: { senderId: userId, status: 'PENDING' } });
    const receivedList = await prisma.followRequest.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: { sender: { include: { profile: true } } }
    });

    const profileData = {
      id: user.id,
      name: user.profile!.name,
      username: user.profile!.username,
      bio: user.profile!.bio,
      profilePic: user.profile!.profilePic,
      coverPic: user.profile!.coverPic,
      email: user.email,
      mobile: user.mobile,
      settings: user.settings,
      followers: followersList.map(f => f.followerId),
      following: followingList.map(f => f.followingId),
      sentRequests: sentList.map(r => r.receiverId),
      receivedRequests: receivedList.map(r => ({
        id: r.id,
        senderId: r.senderId,
        name: r.sender.profile!.name,
        username: r.sender.profile!.username,
        profilePic: r.sender.profile!.profilePic,
        createdAt: r.createdAt
      }))
    };

    await cache.set(cacheKey, profileData, 300); // 5 minutes TTL
    return profileData;
  }

  async getProfileByUsername(username: string) {
    const profile = await userRepository.findByUsername(username);
    if (!profile) throw new Error('User not found');
    return {
      id: profile.userId,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      profilePic: profile.profilePic,
      coverPic: profile.coverPic,
    };
  }

  async updateProfile(userId: string, data: {
    name?: string;
    bio?: string;
    profilePic?: string;
    coverPic?: string;
    username?: string;
  }) {
    if (data.username) {
      const isAvailable = await this.checkUsername(data.username);
      // Retrieve the current profile to check if it's the user's current username
      const profile = await prisma.profile.findUnique({ where: { userId } });
      if (!isAvailable && profile?.username !== data.username) {
        throw new Error('Username is not available or contains invalid characters.');
      }
    }
    return userRepository.updateProfile(userId, data);
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
    return userRepository.updateSettings(userId, data);
  }

  async checkUsername(username: string): Promise<boolean> {
    const regex = /^[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*$/;
    if (username.length < 3 || username.length > 20 || !regex.test(username)) {
      return false;
    }
    const exists = await prisma.profile.findFirst({
      where: {
        username: {
          equals: username
        }
      }
    });
    return !exists;
  }

  async registerDevice(userId: string, deviceToken: string, platform: string, deviceName?: string) {
    return prisma.device.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId: deviceToken,
        }
      },
      create: {
        userId,
        deviceId: deviceToken,
        platform,
        deviceName: deviceName || 'Unknown Device',
        pushToken: deviceToken,
        trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: {
        platform,
        deviceName: deviceName || 'Unknown Device',
        pushToken: deviceToken,
      }
    });
  }

  async deleteAccount(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date()
      }
    });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.device.deleteMany({ where: { userId } });
    return true;
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('You cannot follow yourself');
    }

    const targetUser = await userRepository.findById(followingId);
    if (!targetUser) throw new Error('Target user not found');

    // 1. Blocked check
    const blockedRelation = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: followerId, blockedId: followingId },
          { blockerId: followingId, blockedId: followerId }
        ]
      }
    });
    if (blockedRelation) {
      throw new Error('Cannot follow: User has blocked you or you have blocked them.');
    }

    // 2. Already following check
    const following = await userRepository.isFollowing(followerId, followingId);
    if (following) {
      return { success: true, status: 'FOLLOWING', message: 'Already following this user.' };
    }

    // 3. Already requested check
    const pendingRequest = await prisma.followRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: followerId,
          receiverId: followingId
        }
      }
    });

    if (pendingRequest) {
      if (pendingRequest.status === 'PENDING') {
        return { success: true, status: 'REQUESTED', message: 'Follow request already sent.' };
      }
      // If previous status was rejected or cancelled, we can let them send request again:
    }

    // Check privacy settings of target user
    const targetSettings = await prisma.userSettings.findUnique({
      where: { userId: followingId }
    });
    const isPrivate = targetSettings?.isPrivate || false;

    if (isPrivate) {
      // Create/upsert FollowRequest
      const request = await prisma.followRequest.upsert({
        where: {
          senderId_receiverId: {
            senderId: followerId,
            receiverId: followingId
          }
        },
        create: {
          senderId: followerId,
          receiverId: followingId,
          status: 'PENDING'
        },
        update: {
          status: 'PENDING'
        }
      });
      
      // Create notification
      await notificationService.createNotification({
        userId: followingId,
        actorId: followerId,
        type: 'FOLLOW_REQUEST',
        targetType: 'USER',
        targetId: followerId,
        referenceId: request.id
      });

      return { success: true, status: 'REQUESTED', message: 'Follow request sent.' };
    } else {
      // Public: Follow immediately
      await userRepository.followUser(followerId, followingId);
      await cache.invalidate(`feed:${followerId}:*`);

      // Create notification
      await notificationService.createNotification({
        userId: followingId,
        actorId: followerId,
        type: 'FOLLOW',
        targetType: 'USER',
        targetId: followerId,
        referenceId: followerId
      });

      return { success: true, status: 'FOLLOWING', message: 'User followed successfully.' };
    }
  }

  async unfollowUser(followerId: string, followingId: string) {
    const following = await userRepository.isFollowing(followerId, followingId);
    if (!following) {
      return { success: true, message: 'You are not following this user.' };
    }

    await userRepository.unfollowUser(followerId, followingId);
    await cache.invalidate(`feed:${followerId}:*`);
    return { success: true, message: 'Unfollowed user.' };
  }

  async getFollowRequests(userId: string) {
    const requests = await prisma.followRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        sender: {
          include: {
            profile: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return requests.map(req => ({
      id: req.id,
      senderId: req.senderId,
      name: req.sender.profile!.name,
      username: req.sender.profile!.username,
      profilePic: req.sender.profile!.profilePic,
      createdAt: req.createdAt
    }));
  }

  async acceptFollowRequest(requestId: string, receiverId: string) {
    const request = await prisma.followRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.receiverId !== receiverId || request.status !== 'PENDING') {
      throw new Error('Follow request not found or not pending.');
    }

    // Execute updates in transaction
    await prisma.$transaction([
      prisma.followRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' }
      }),
      prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: request.senderId,
            followingId: receiverId
          }
        },
        create: {
          followerId: request.senderId,
          followingId: receiverId
        },
        update: {}
      })
    ]);

    // Create notification asynchronously outside transaction
    await notificationService.createNotification({
      userId: request.senderId,
      actorId: receiverId,
      type: 'FOLLOW_ACCEPTED',
      targetType: 'USER',
      targetId: receiverId,
      referenceId: receiverId
    });

    await cache.invalidate(`feed:${request.senderId}:*`);
    return { success: true, message: 'Follow request accepted.' };
  }

  async rejectFollowRequest(requestId: string, receiverId: string) {
    const request = await prisma.followRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.receiverId !== receiverId || request.status !== 'PENDING') {
      throw new Error('Follow request not found or not pending.');
    }

    await prisma.followRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    });

    return { success: true, message: 'Follow request rejected.' };
  }

  async cancelFollowRequest(senderId: string, receiverId: string) {
    const request = await prisma.followRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId
        }
      }
    });

    if (!request || request.status !== 'PENDING') {
      throw new Error('Pending follow request not found.');
    }

    await prisma.followRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED' }
    });

    return { success: true, message: 'Follow request cancelled.' };
  }

  async getFollowers(userId: string) {
    const follows = await userRepository.getFollowers(userId);
    return follows.map(f => ({
      id: f.follower.id,
      name: f.follower.profile!.name,
      username: f.follower.profile!.username,
      profilePic: f.follower.profile!.profilePic,
    }));
  }

  async getFollowing(userId: string) {
    const follows = await userRepository.getFollowing(userId);
    return follows.map(f => ({
      id: f.following.id,
      name: f.following.profile!.name,
      username: f.following.profile!.username,
      profilePic: f.following.profile!.profilePic,
    }));
  }

  async toggleBlock(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new Error('You cannot block yourself');

    const blockers = await userRepository.getFollowers(blockedId); // check if there is relationship if needed
    // Simple toggle check
    const isBlocked = await prisma?.blockedUser.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } }
    });

    if (isBlocked) {
      await userRepository.unblockUser(blockerId, blockedId);
      return { blocked: false };
    } else {
      await userRepository.blockUser(blockerId, blockedId);
      // Automatically unfollow if blocking
      try {
        await userRepository.unfollowUser(blockerId, blockedId);
      } catch (e) {}
      try {
        await userRepository.unfollowUser(blockedId, blockerId);
      } catch (e) {}
      return { blocked: true };
    }
  }

  async toggleMute(muterId: string, mutedId: string) {
    if (muterId === mutedId) throw new Error('You cannot mute yourself');
    
    const isMuted = await prisma?.muteUser.findUnique({
      where: { muterId_mutedId: { muterId, mutedId } }
    });

    if (isMuted) {
      await userRepository.unmuteUser(muterId, mutedId);
      return { muted: false };
    } else {
      await userRepository.muteUser(muterId, mutedId);
      return { muted: true };
    }
  }

  async getBlockedUsers(blockerId: string) {
    const list = await prisma.blockedUser.findMany({
      where: { blockerId },
      include: {
        blocked: {
          include: {
            profile: true
          }
        }
      }
    });

    return list.map(item => ({
      id: item.blockedId,
      name: item.blocked.profile?.name || 'User',
      username: item.blocked.profile?.username || 'user',
      profilePic: item.blocked.profile?.profilePic || ''
    }));
  }
}

export default new UserService();
