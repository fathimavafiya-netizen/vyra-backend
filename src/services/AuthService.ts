import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import userRepository from '../repositories/UserRepository';
import sessionRepository from '../repositories/SessionRepository';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, hashToken } from '../utils/jwt';
import logger from '../utils/logger';
import prisma from '../config/db';
import { env } from '../config/env';
import { logAuditEvent } from '../utils/audit';
import { incrementMetric } from '../utils/metrics';

export class AuthService {
  /**
   * Register a brand new user
   */
  async register(
    data: {
      name: string;
      email?: string;
      mobile?: string;
      deviceId: string;
      deviceName: string;
      platform: 'IOS' | 'ANDROID' | 'WEB';
      appVersion: string;
      ipAddress: string;
      userAgent: string;
      rememberDevice?: boolean;
      consentGiven?: boolean;
    },
    requestId?: string
  ) {
    if (!data.email && !data.mobile) {
      throw new Error('Please provide email or mobile number');
    }

    // 1. Check duplicate registrations
    if (data.email) {
      const existingUser = await userRepository.findByEmail(data.email);
      if (existingUser) throw new Error('Already registered. Please log in instead.');
    }
    if (data.mobile) {
      const existingUser = await userRepository.findByMobile(data.mobile);
      if (existingUser) throw new Error('Already registered. Please log in instead.');
    }

    // 2. Generate secure random placeholder password (passwordless flow)
    const rawPassword = Math.random().toString(36).substring(2, 12);
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 3. Unique username retry loop
    const baseUsername = data.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    let uniqueUsername = '';
    let isUnique = false;
    let retries = 0;

    while (!isUnique && retries < 15) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      uniqueUsername = `${baseUsername}_${suffix}`;
      const match = await prisma.profile.findUnique({
        where: { username: uniqueUsername },
      });
      if (!match) {
        isUnique = true;
      }
      retries++;
    }

    if (!isUnique) {
      uniqueUsername = `${baseUsername}_${Date.now().toString().slice(-6)}`;
    }

    // 4. Create User database transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email ? data.email.toLowerCase().trim() : null,
          mobile: data.mobile ? data.mobile.trim() : null,
          password: passwordHash,
          role: 'USER',
          isVerified: true,
          emailVerifiedAt: data.email ? new Date() : null,
          mobileVerifiedAt: data.mobile ? new Date() : null,
          consentGivenAt: data.consentGiven ? new Date() : null,
          privacyVersion: '1.0',
          termsVersion: '1.0',
          profile: {
            create: {
              name: data.name,
              username: uniqueUsername,
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
      return newUser;
    });

    return {
      success: true,
      message: "Registration successful. Please log in.",
      user: {
        id: user.id,
        name: user.profile!.name,
        username: user.profile!.username,
        email: user.email,
        mobile: user.mobile,
        profilePic: user.profile!.profilePic,
        coverPic: user.profile!.coverPic,
        bio: user.profile!.bio,
        role: user.role,
        isVerified: user.isVerified,
        mfaEnabled: user.mfaEnabled,
      }
    };
  }

  /**
   * Log in an existing user
   */
  async login(
    data: {
      email?: string;
      mobile?: string;
      deviceId: string;
      deviceName: string;
      platform: 'IOS' | 'ANDROID' | 'WEB';
      appVersion: string;
      ipAddress: string;
      userAgent: string;
      rememberDevice?: boolean;
    },
    requestId?: string
  ) {
    if (!data.email && !data.mobile) {
      throw new Error('Please provide email or mobile number');
    }

    let user = null;
    if (data.email) {
      user = await userRepository.findByEmail(data.email.toLowerCase().trim());
    } else if (data.mobile) {
      user = await userRepository.findByMobile(data.mobile.trim());
    }

    if (!user || !user.isActive || user.deletedAt !== null) {
      await logAuditEvent({
        action: 'LOGIN_FAILURE',
        severity: 'WARNING',
        status: 'USER_NOT_FOUND_OR_DEACTIVATED',
        ipAddress: data.ipAddress,
        deviceId: data.deviceId,
        userAgent: data.userAgent,
      });
      await incrementMetric('login_failure');
      throw new Error('User account not found or deactivated');
    }

    if (user.isBanned) {
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_FAILURE',
        severity: 'SECURITY',
        status: 'BANNED_USER_LOGIN_BLOCKED',
        ipAddress: data.ipAddress,
        deviceId: data.deviceId,
        userAgent: data.userAgent,
      });
      await incrementMetric('login_failure');
      throw new Error(`Account is banned: ${user.bannedReason || 'Terms violation'}`);
    }

    // 1. Enforce Session Limits
    const activeSessions = await prisma.session.findMany({
      where: { userId: user.id, isValid: true },
      orderBy: { lastActive: 'asc' },
    });

    if (activeSessions.length >= env.MAX_ACTIVE_SESSIONS) {
      const oldest = activeSessions[0];
      await prisma.session.update({
        where: { id: oldest.id },
        data: { isValid: false },
      });
      await logAuditEvent({
        userId: user.id,
        action: 'SESSION_REVOKED',
        severity: 'WARNING',
        status: `EVICTED_MAX_SESSIONS_LIMIT_REACHED`,
        ipAddress: data.ipAddress,
        deviceId: data.deviceId,
        userAgent: data.userAgent,
      });
    }

    // 2. Generate family and session
    const familyId = randomUUID();
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'PENDING_HASH',
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        platform: data.platform,
        appVersion: data.appVersion,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        familyId,
        expiresAt: new Date(Date.now() + (data.rememberDevice ? env.TRUSTED_DEVICE_DAYS : 7) * 24 * 60 * 60 * 1000),
      },
    });

    const isAdmin = user.role === 'ADMIN' || user.role === 'MODERATOR';
    const accessToken = generateAccessToken(user.id, user.role, session.id, 1, isAdmin ? { isAdminSession: true } : {});
    const refreshToken = generateRefreshToken(user.id, session.id);
    const refreshTokenHash = hashToken(refreshToken);

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      severity: 'INFO',
      status: 'OTP_LOGIN_VERIFIED',
      ipAddress: data.ipAddress,
      deviceId: data.deviceId,
      userAgent: data.userAgent,
    });
    await incrementMetric('login_success');

    const followersList = await prisma.follow.findMany({ where: { followingId: user.id } });
    const followingList = await prisma.follow.findMany({ where: { followerId: user.id } });
    const sentList = await prisma.followRequest.findMany({ where: { senderId: user.id, status: 'PENDING' } });

    return {
      user: {
        id: user.id,
        name: user.profile!.name,
        username: user.profile!.username,
        email: user.email,
        mobile: user.mobile,
        profilePic: user.profile!.profilePic,
        coverPic: user.profile!.coverPic,
        bio: user.profile!.bio,
        role: user.role,
        isVerified: user.isVerified,
        mfaEnabled: user.mfaEnabled,
        followers: followersList.map((f: any) => f.followerId),
        following: followingList.map((f: any) => f.followingId),
        sentRequests: sentList.map((r: any) => r.receiverId),
        isAdminSession: isAdmin,
      },
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }

  /**
   * Refresh Token Family & Replay Detection
   */
  async refreshToken(data: {
    refreshToken: string;
    ipAddress: string;
    userAgent: string;
  }) {
    const tokenHash = hashToken(data.refreshToken);

    // Find the session (includes invalidated ones to check replay attack)
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) {
      await logAuditEvent({
        action: 'REFRESH_ROTATED',
        severity: 'SECURITY',
        status: 'UNRECOGNIZED_REFRESH_TOKEN_SUBMISSION',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
      throw new Error('Session invalid, please log in again');
    }

    const user = session.user;

    // REPLAY ATTACK DETECTION
    if (!session.isValid || session.expiresAt < new Date()) {
      // Invalidate ALL sessions sharing the same token familyId
      await prisma.session.updateMany({
        where: { familyId: session.familyId, isValid: true },
        data: { isValid: false },
      });

      await logAuditEvent({
        userId: session.userId,
        action: 'REFRESH_ROTATED',
        severity: 'CRITICAL',
        status: 'REPLAY_ATTACK_DETECTED_FAMILY_REVOKED',
        ipAddress: data.ipAddress,
        deviceId: session.deviceId,
        userAgent: data.userAgent,
      });
      await incrementMetric('replay_attacks');
      throw new Error('Suspicious token activity detected. All device sessions have been revoked.');
    }

    if (!user || !user.isActive || user.deletedAt !== null || user.isBanned) {
      throw new Error('User account is invalid, banned, or deleted');
    }

    // Invalidate current session (RTR rotation)
    await prisma.session.update({
      where: { id: session.id },
      data: { isValid: false },
    });

    // Create rotated session within the SAME Token Family (familyId preserved)
    const newSession = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'PENDING_HASH',
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        platform: session.platform,
        appVersion: session.appVersion,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        familyId: session.familyId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const isAdmin = user.role === 'ADMIN' || user.role === 'MODERATOR';
    const newAccessToken = generateAccessToken(user.id, user.role, newSession.id, 1, isAdmin ? { isAdminSession: true } : {});
    const newRefreshToken = generateRefreshToken(user.id, newSession.id);
    const newRefreshTokenHash = hashToken(newRefreshToken);

    await prisma.session.update({
      where: { id: newSession.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    await logAuditEvent({
      userId: user.id,
      action: 'REFRESH_ROTATED',
      severity: 'INFO',
      status: 'ROTATION_SUCCESS',
      ipAddress: data.ipAddress,
      deviceId: session.deviceId,
      userAgent: data.userAgent,
    });
    await incrementMetric('refresh_rotated');

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Log out current session
   */
  async logout(refreshToken: string, ipAddress: string, userAgent: string) {
    try {
      const tokenHash = hashToken(refreshToken);
      const session = await prisma.session.findUnique({
        where: { refreshTokenHash: tokenHash },
      });

      if (session) {
        await prisma.session.update({
          where: { id: session.id },
          data: { isValid: false },
        });

        await logAuditEvent({
          userId: session.userId,
          action: 'LOGOUT',
          severity: 'INFO',
          status: 'SUCCESSFUL_LOGOUT',
          ipAddress,
          deviceId: session.deviceId,
          userAgent,
        });
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Log out all sessions except current
   */
  async logoutOtherDevices(userId: string, currentSessionId: string) {
    await prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        isValid: true,
      },
      data: { isValid: false },
    });
    return true;
  }

  /**
   * Separate admin portal login
   */
  async adminLogin(
    data: {
      emailOrUsername: string;
      password?: string;
      deviceId: string;
      deviceName: string;
      platform: 'IOS' | 'ANDROID' | 'WEB';
      appVersion: string;
      ipAddress: string;
      userAgent: string;
      rememberDevice?: boolean;
    }
  ) {
    const identifier = data.emailOrUsername.toLowerCase().trim();
    
    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { profile: { username: identifier } }
        ],
        isActive: true,
        deletedAt: null
      },
      include: {
        profile: true
      }
    });

    if (!user) {
      throw new Error('Invalid administrative credentials');
    }

    // Verify role
    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      throw new Error('Access denied: Administrative privileges required');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(data.password || '', user.password);
    if (!passwordMatch) {
      throw new Error('Invalid administrative credentials');
    }

    // Create session (same session limit flow)
    const activeSessions = await prisma.session.findMany({
      where: { userId: user.id, isValid: true },
      orderBy: { lastActive: 'asc' },
    });

    if (activeSessions.length >= env.MAX_ACTIVE_SESSIONS) {
      const oldest = activeSessions[0];
      await prisma.session.update({
        where: { id: oldest.id },
        data: { isValid: false },
      });
    }

    const familyId = randomUUID();
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'PENDING_HASH',
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        platform: data.platform,
        appVersion: data.appVersion,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        familyId,
        expiresAt: new Date(Date.now() + (data.rememberDevice ? env.TRUSTED_DEVICE_DAYS : 7) * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = generateAccessToken(user.id, user.role, session.id, 1, { isAdminSession: true });
    const refreshToken = generateRefreshToken(user.id, session.id);
    const refreshTokenHash = hashToken(refreshToken);

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      severity: 'SECURITY',
      status: 'ADMIN_SESSION_STARTED',
      ipAddress: data.ipAddress,
      deviceId: data.deviceId,
      userAgent: data.userAgent,
    });

    return {
      user: {
        id: user.id,
        name: user.profile!.name,
        username: user.profile!.username,
        email: user.email,
        profilePic: user.profile!.profilePic,
        role: user.role,
        isAdminSession: true
      },
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }
}

export default new AuthService();
