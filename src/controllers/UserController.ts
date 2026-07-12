import { Response, NextFunction } from 'express';
import userService from '../services/UserService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class UserController {
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id || req.user?.id;
      if (!userId) throw new Error('User identifier not provided');

      const profile = await userService.getProfile(userId);
      return res.status(200).json({ success: true, user: profile });
    } catch (e: any) {
      return res.status(404).json({ success: false, message: e.message });
    }
  }

  async getProfileByUsername(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const profile = await userService.getProfileByUsername(username);
      return res.status(200).json({ success: true, user: profile });
    } catch (e: any) {
      return res.status(404).json({ success: false, message: e.message });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const updated = await userService.updateProfile(userId, req.body);
      const fullProfile = await userService.getProfile(userId);
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        profile: updated,
        user: fullProfile,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const updated = await userService.updateSettings(userId, req.body);
      return res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        settings: updated,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async followUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const followerId = req.user?.id;
      const { id: followingId } = req.params;
      if (!followerId) throw new Error('Unauthorized');
      if (!followingId) throw new Error('Target following ID is required');

      const result = await userService.followUser(followerId, followingId);
      return res.status(200).json(result);
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async unfollowUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const followerId = req.user?.id;
      const { id: followingId } = req.params;
      if (!followerId) throw new Error('Unauthorized');
      if (!followingId) throw new Error('Target following ID is required');

      const result = await userService.unfollowUser(followerId, followingId);
      return res.status(200).json(result);
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getFollowRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const requests = await userService.getFollowRequests(userId);
      return res.status(200).json({ success: true, requests });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async acceptFollowRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const receiverId = req.user?.id;
      const { id: requestId } = req.params;
      if (!receiverId) throw new Error('Unauthorized');

      const result = await userService.acceptFollowRequest(requestId, receiverId);
      return res.status(200).json(result);
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async rejectFollowRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const receiverId = req.user?.id;
      const { id: requestId } = req.params;
      if (!receiverId) throw new Error('Unauthorized');

      const result = await userService.rejectFollowRequest(requestId, receiverId);
      return res.status(200).json(result);
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async cancelFollowRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const senderId = req.user?.id;
      const { id: receiverId } = req.params;
      if (!senderId) throw new Error('Unauthorized');

      const result = await userService.cancelFollowRequest(senderId, receiverId);
      return res.status(200).json(result);
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getFollowers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id || req.user?.id;
      if (!userId) throw new Error('User id required');

      const list = await userService.getFollowers(userId);
      return res.status(200).json({ success: true, followers: list });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getFollowing(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id || req.user?.id;
      if (!userId) throw new Error('User id required');

      const list = await userService.getFollowing(userId);
      return res.status(200).json({ success: true, following: list });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async toggleBlock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const blockerId = req.user?.id;
      const { blockedId } = req.body;
      if (!blockerId) throw new Error('Unauthorized');

      const result = await userService.toggleBlock(blockerId, blockedId);
      return res.status(200).json({
        success: true,
        message: result.blocked ? 'User blocked' : 'User unblocked',
        ...result,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async toggleMute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const muterId = req.user?.id;
      const { mutedId } = req.body;
      if (!muterId) throw new Error('Unauthorized');

      const result = await userService.toggleMute(muterId, mutedId);
      return res.status(200).json({
        success: true,
        message: result.muted ? 'User muted' : 'User unmuted',
        ...result,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async checkUsername(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const available = await userService.checkUsername(username);
      return res.status(200).json({ success: true, available });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async registerDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { deviceToken, platform, deviceName } = req.body;
      if (!userId) throw new Error('Unauthorized');
      if (!deviceToken || !platform) throw new Error('deviceToken and platform are required');

      const device = await userService.registerDevice(userId, deviceToken, platform, deviceName);
      return res.status(201).json({ success: true, device });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { password } = req.body;
      if (!userId) throw new Error('Unauthorized');
      if (!password) throw new Error('Password confirmation is required');

      const bcrypt = require('bcryptjs');
      const { default: prisma } = require('../config/db');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');
      
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Incorrect password confirmation' });
      }

      await userService.deleteAccount(userId);
      return res.status(200).json({ success: true, message: 'Account soft deleted successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async registerFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');
      const { token } = req.body;
      if (!token) throw new Error('FCM Token is required');

      const { default: prisma } = require('../config/db');
      await prisma.user.update({
        where: { id: userId },
        data: { fcmToken: token },
      });

      return res.status(200).json({ success: true, message: 'FCM token registered successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async clearFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const { default: prisma } = require('../config/db');
      await prisma.user.update({
        where: { id: userId },
        data: { fcmToken: null },
      });

      return res.status(200).json({ success: true, message: 'FCM token cleared successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { oldPassword, newPassword } = req.body;
      if (!userId) throw new Error('Unauthorized');
      if (!oldPassword || !newPassword) throw new Error('Both old and new passwords are required');

      const bcrypt = require('bcryptjs');
      const { default: prisma } = require('../config/db');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      const match = await bcrypt.compare(oldPassword, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Incorrect current password' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: passwordHash,
          passwordHash: passwordHash
        }
      });

      return res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getBlockedUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const blockerId = req.user?.id;
      if (!blockerId) throw new Error('Unauthorized');

      const users = await userService.getBlockedUsers(blockerId);
      return res.status(200).json({ success: true, users });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new UserController();
