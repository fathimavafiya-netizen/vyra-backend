import { Request, Response, NextFunction } from 'express';
import tokenService from '../services/TokenService';
import sessionRepository from '../repositories/SessionRepository';
import userRepository from '../repositories/UserRepository';
import logger from '../../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    mobile: string | null;
    name: string;
    username: string;
    profilePic: string;
    role: string;
    isAdminSession?: boolean;
  };
  sessionId?: string;
  familyId?: string;
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ success: false, code: 'TOKEN_REQUIRED', message: 'Authorization token required' });
  }

  try {
    // 1. Verify Access Token signature and expiration
    const payload = tokenService.verifyAccessToken(token);
    const userId = payload.sub;

    // 2. Verify Session validity
    if (payload.sessionId) {
      const session = await sessionRepository.findById(payload.sessionId);

      if (!session || !session.isValid || session.expiresAt < new Date()) {
        return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Session has expired or been terminated' });
      }

      // 3. Token Versioning: check if JWT version matches current session version
      if (
        payload.accessTokenVersion !== undefined &&
        payload.accessTokenVersion !== session.accessTokenVersion
      ) {
        return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'Access token version has been revoked' });
      }

      // Update session last active timestamp
      await sessionRepository.updateLastActive(session.id);
      req.sessionId = session.id;
      req.familyId = session.familyId;
    }

    // 4. Verify User status
    const dbUser = await userRepository.findById(userId);

    if (!dbUser || !dbUser.profile || dbUser.deletedAt !== null) {
      return res.status(401).json({ success: false, code: 'USER_INVALID', message: 'User account is invalid or deleted' });
    }

    if (!dbUser.isActive) {
      return res.status(403).json({ success: false, code: 'ACCOUNT_DEACTIVATED', message: 'Account is deactivated' });
    }

    if (dbUser.isBanned) {
      return res.status(403).json({
        success: false,
        code: 'USER_BANNED',
        message: `Account is banned${dbUser.bannedReason ? `: ${dbUser.bannedReason}` : ''}`,
      });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      mobile: dbUser.mobile,
      name: dbUser.profile.name,
      username: dbUser.profile.username,
      profilePic: dbUser.profile.profilePic,
      role: dbUser.role,
      isAdminSession: payload.isAdminSession || false,
    };

    return next();
  } catch (error: any) {
    logger.debug(`JWT validation error: ${error.message}`);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token Expired' });
    }
    return res.status(403).json({ success: false, code: 'TOKEN_FORBIDDEN', message: 'Forbidden' });
  }
};

export default authMiddleware;
