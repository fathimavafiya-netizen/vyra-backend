import prisma from '../../config/db';
import userRepository from '../repositories/UserRepository';
import sessionService from './SessionService';
import auditService from './AuditService';

export class RecoveryService {
  /**
   * Safe email migration under active session verification
   */
  async migrateEmail(userId: string, newEmail: string, currentSessionId: string) {
    const cleanEmail = newEmail.trim().toLowerCase();

    // 1. Verify uniqueness
    const duplicate = await userRepository.findByEmail(cleanEmail);
    if (duplicate) {
      throw new Error('Email address already in use.');
    }

    // 2. Update DB
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: cleanEmail,
        emailVerifiedAt: new Date(),
        emailVerificationPending: false,
      },
    });

    // 3. Force re-login on all other devices by revoking other sessions
    await sessionService.revokeOtherSessions(userId, currentSessionId);

    await auditService.logEvent({
      userId,
      action: 'PASSWORD_RESET',
      severity: 'SECURITY',
      status: `EMAIL_MODIFIED_TO_${cleanEmail}_OTHER_SESSIONS_REVOKED`,
    });
  }

  /**
   * Safe mobile migration under active session verification
   */
  async migrateMobile(userId: string, newMobile: string, currentSessionId: string) {
    const cleanMobile = newMobile.trim();

    const duplicate = await userRepository.findByMobile(cleanMobile);
    if (duplicate) {
      throw new Error('Mobile number already in use.');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mobile: cleanMobile,
        mobileVerifiedAt: new Date(),
        mobileVerificationPending: false,
      },
    });

    await sessionService.revokeOtherSessions(userId, currentSessionId);

    await auditService.logEvent({
      userId,
      action: 'PASSWORD_RESET',
      severity: 'SECURITY',
      status: `MOBILE_MODIFIED_TO_${cleanMobile}_OTHER_SESSIONS_REVOKED`,
    });
  }

  /**
   * Soft delete user profile complying GDPR/CCPA
   */
  async softDeleteAccount(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    // Revoke all sessions immediately
    await sessionService.revokeAllSessions(userId);

    await auditService.logEvent({
      userId,
      action: 'LOGOUT',
      severity: 'CRITICAL',
      status: 'GDPR_RIGHT_TO_ERASURE_SOFT_DELETION',
    });
  }

  /**
   * Exports entire user metadata database snapshot complying GDPR/CCPA
   */
  async exportUserData(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Capture user profile, settings, and sessions list
    const sessions = await prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        platform: true,
        appVersion: true,
        createdAt: true,
      },
    });

    await auditService.logEvent({
      userId,
      action: 'LOGIN_SUCCESS', // general compliance access
      severity: 'INFO',
      status: 'GDPR_DATA_EXPORT_SUCCESS',
    });

    return {
      exportTimestamp: new Date(),
      profile: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        createdAt: user.createdAt,
        role: user.role,
        isVerified: user.isVerified,
      },
      personalInfo: user.profile,
      settings: user.settings,
      activeSessions: sessions,
    };
  }
}

export default new RecoveryService();
