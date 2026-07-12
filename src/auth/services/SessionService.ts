import { randomUUID } from 'crypto';
import sessionRepository from '../repositories/SessionRepository';
import tokenService from './TokenService';
import prisma from '../../config/db';
import { env } from '../../config/env';
import logger from '../../utils/logger';
import auditService from './AuditService';
import metricsService from '../../monitoring/metrics.service';

export class SessionService {
  /**
   * Creates a brand new login session, evicting the oldest session if exceeding concurrent limit
   */
  async createSession(
    userId: string,
    device: {
      deviceId: string;
      deviceName: string;
      platform: string;
      appVersion: string;
      ipAddress: string;
      userAgent: string;
      rememberDevice?: boolean;
    },
    role = 'USER',
    extraClaims: Record<string, any> = {}
  ) {
    // 1. Enforce Session Limits (Max 5 concurrent devices)
    const activeSessions = await sessionRepository.findActiveByUserId(userId);

    if (activeSessions.length >= env.MAX_ACTIVE_SESSIONS) {
      const oldest = activeSessions[0];
      await sessionRepository.invalidate(oldest.id);

      await auditService.logEvent({
        userId,
        action: 'SESSION_REVOKED',
        severity: 'WARNING',
        status: 'EVICTED_MAX_SESSIONS_LIMIT_REACHED',
        ipAddress: device.ipAddress,
        deviceId: device.deviceId,
        userAgent: device.userAgent,
      });
    }

    // 2. Provision new session record within a family
    const familyId = randomUUID();
    const expiryDays = device.rememberDevice ? env.TRUSTED_DEVICE_DAYS : 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const session = await sessionRepository.create({
      userId,
      refreshTokenHash: 'PENDING_HASH',
      expiresAt,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion,
      familyId,
    });

    // 3. Generate tokens
    const accessToken = tokenService.generateAccessToken(userId, role, session.id, 1, extraClaims);
    const refreshToken = tokenService.generateRefreshToken(userId, session.id);
    const refreshTokenHash = tokenService.hashToken(refreshToken);

    // Update session hash
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }

  /**
   * Rotates access and refresh tokens, enforcing replay attack detection
   */
  async rotateSession(refreshToken: string, ipAddress: string, userAgent: string) {
    const tokenHash = tokenService.hashToken(refreshToken);
    const session = await sessionRepository.findByHash(tokenHash);

    if (!session) {
      await auditService.logEvent({
        action: 'REFRESH_ROTATED',
        severity: 'SECURITY',
        status: 'UNRECOGNIZED_REFRESH_TOKEN',
        ipAddress,
        userAgent,
      });
      throw new Error('Session invalid, please log in again');
    }

    const user = session.user;

    // 1. REPLAY ATTACK DETECTION
    if (!session.isValid || session.expiresAt < new Date()) {
      // Replay detected! Revoke the entire Token Family immediately
      await sessionRepository.invalidateFamily(session.familyId);

      await auditService.logEvent({
        userId: session.userId,
        action: 'REFRESH_ROTATED',
        severity: 'CRITICAL',
        status: 'REPLAY_ATTACK_DETECTED_FAMILY_REVOKED',
        ipAddress,
        deviceId: session.deviceId,
        userAgent,
      });
      await metricsService.incrementMetric('replay_attacks');

      throw new Error('Suspicious token activity detected. All device sessions have been revoked.');
    }

    if (!user || !user.isActive || user.deletedAt !== null || user.isBanned) {
      throw new Error('User account is invalid, banned, or deleted');
    }

    // 2. Rotate Current Session (invalidate old, create new inside same familyId)
    await sessionRepository.invalidate(session.id);

    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const newSession = await sessionRepository.create({
      userId: user.id,
      refreshTokenHash: 'PENDING_HASH',
      expiresAt: newExpiresAt,
      ipAddress,
      userAgent,
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      platform: session.platform,
      appVersion: session.appVersion,
      familyId: session.familyId,
    });

    const isAdmin = user.role === 'ADMIN' || user.role === 'MODERATOR';
    const newAccessToken = tokenService.generateAccessToken(
      user.id,
      user.role,
      newSession.id,
      1,
      isAdmin ? { isAdminSession: true } : {}
    );
    const newRefreshToken = tokenService.generateRefreshToken(user.id, newSession.id);
    const newRefreshTokenHash = tokenService.hashToken(newRefreshToken);

    await prisma.session.update({
      where: { id: newSession.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    await auditService.logEvent({
      userId: user.id,
      action: 'REFRESH_ROTATED',
      severity: 'INFO',
      status: 'ROTATION_SUCCESS',
      ipAddress,
      deviceId: session.deviceId,
      userAgent,
    });
    await metricsService.incrementMetric('refresh_rotated');

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revokes a session by refresh token (Logout)
   */
  async revokeSessionByToken(refreshToken: string, ipAddress: string, userAgent: string) {
    const tokenHash = tokenService.hashToken(refreshToken);
    const session = await sessionRepository.findByHash(tokenHash);

    if (session) {
      await sessionRepository.invalidate(session.id);
      await auditService.logEvent({
        userId: session.userId,
        action: 'LOGOUT',
        severity: 'INFO',
        status: 'SUCCESSFUL_LOGOUT',
        ipAddress,
        deviceId: session.deviceId,
        userAgent,
      });
    }
  }

  /**
   * Revokes all user sessions except current session
   */
  async revokeOtherSessions(userId: string, currentSessionId: string) {
    await sessionRepository.invalidateAllOtherSessions(userId, currentSessionId);
    return true;
  }

  /**
   * Revokes all user sessions (Logout all)
   */
  async revokeAllSessions(userId: string) {
    const active = await sessionRepository.findActiveByUserId(userId);
    const ids = active.map(s => s.id);
    if (ids.length > 0) {
      await sessionRepository.invalidateMany(ids);
    }
    return true;
  }
}

export default new SessionService();
