import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../../config/env';
import logger from '../../utils/logger';

export interface TokenPayload {
  sub: string;             // userId
  role?: string;            // user role (e.g. "USER" | "ADMIN" | "MODERATOR")
  sessionId: string;        // session database ID
  accessTokenVersion?: number; // token versioning tracking
  isAdminSession?: boolean;    // is this specifically an admin portal session
}

// Parse keys map from configuration JSON string
let jwtKeys: Record<string, string> = {};
try {
  jwtKeys = JSON.parse(env.JWT_KEYS_JSON);
} catch (err: any) {
  logger.error(`Failed to parse JWT_KEYS_JSON: ${err.message}. Using fallback.`);
  jwtKeys = { key1: env.JWT_SECRET };
}

export class TokenService {
  /**
   * Gets the secret key matching a specific kid
   */
  getSecretByKeyId(kid: string): string {
    return jwtKeys[kid] || jwtKeys['key1'] || env.JWT_SECRET;
  }

  /**
   * Gets the current active kid and corresponding secret key
   */
  getActiveKey(): { kid: string; secret: string } {
    const kid = env.JWT_ACTIVE_KID || 'key1';
    const secret = this.getSecretByKeyId(kid);
    return { kid, secret };
  }

  generateAccessToken(
    userId: string,
    role: string,
    sessionId: string,
    accessTokenVersion = 1,
    extraClaims: Record<string, any> = {}
  ): string {
    const { kid, secret } = this.getActiveKey();
    const options: any = {
      expiresIn: env.ACCESS_TOKEN_TTL,
      header: { kid, alg: 'HS256', typ: 'JWT' },
    };
    return jwt.sign(
      { sub: userId, role, sessionId, accessTokenVersion, ...extraClaims },
      secret,
      options
    );
  }

  generateRefreshToken(userId: string, sessionId: string): string {
    const { kid, secret } = this.getActiveKey();
    const options: any = {
      expiresIn: env.REFRESH_TOKEN_TTL,
      header: { kid, alg: 'HS256', typ: 'JWT' },
    };
    return jwt.sign(
      { sub: userId, sessionId },
      secret,
      options
    );
  }

  verifyAccessToken(token: string): TokenPayload {
    const decodedHeader = jwt.decode(token, { complete: true }) as any;
    const kid = decodedHeader?.header?.kid || 'key1';
    const secret = this.getSecretByKeyId(kid);

    const decoded = jwt.verify(token, secret) as any;
    return {
      sub: decoded.sub || decoded.userId,
      role: decoded.role,
      sessionId: decoded.sessionId,
      accessTokenVersion: decoded.accessTokenVersion,
      isAdminSession: decoded.isAdminSession,
    };
  }

  verifyRefreshToken(token: string): TokenPayload {
    const decodedHeader = jwt.decode(token, { complete: true }) as any;
    const kid = decodedHeader?.header?.kid || 'key1';
    const secret = this.getSecretByKeyId(kid);

    const decoded = jwt.verify(token, secret) as any;
    return {
      sub: decoded.sub || decoded.userId,
      role: decoded.role,
      sessionId: decoded.sessionId,
      accessTokenVersion: decoded.accessTokenVersion,
    };
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export default new TokenService();
