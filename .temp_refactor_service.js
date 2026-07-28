const fs = require('fs');
let content = fs.readFileSync('src/services/AuthService.ts', 'utf8');

// Replace import logger
content = content.replace(
  /import logger from '\.\.\/utils\/logger';/,
  "import { createChildLogger } from '../logger/childLogger';\nimport { LogAction } from '../logger/actions';\nconst logger = createChildLogger('auth');"
);

// Add AUTH_LOGIN_FAILED for deactivated/not found
content = content.replace(
  /await logAuditEvent\(\{\s*action: 'LOGIN_FAILURE',\s*severity: 'WARNING',/g,
  "logger.warn({ action: LogAction.AUTH_LOGIN_FAILED, ip: data.ipAddress, userAgent: data.userAgent, message: 'User account not found or deactivated' });\n      await logAuditEvent({\n        action: 'LOGIN_FAILURE',\n        severity: 'WARNING',"
);

// Add AUTH_LOGIN_FAILED for banned
content = content.replace(
  /await logAuditEvent\(\{\s*userId: user\.id,\s*action: 'LOGIN_FAILURE',\s*severity: 'SECURITY',/g,
  "logger.warn({ action: LogAction.AUTH_LOGIN_FAILED, userId: user.id, ip: data.ipAddress, userAgent: data.userAgent, message: 'Banned user login blocked' });\n      await logAuditEvent({\n        userId: user.id,\n        action: 'LOGIN_FAILURE',\n        severity: 'SECURITY',"
);

// Session revoked
content = content.replace(
  /await logAuditEvent\(\{\s*userId: user\.id,\s*action: 'SESSION_REVOKED',/g,
  "logger.warn({ action: 'SESSION_REVOKED', userId: user.id, ip: data.ipAddress, userAgent: data.userAgent, message: 'Evicted max sessions limit reached' });\n      await logAuditEvent({\n        userId: user.id,\n        action: 'SESSION_REVOKED',"
);

// Replay attack
content = content.replace(
  /await logAuditEvent\(\{\s*userId: session\.userId,\s*action: 'REFRESH_ROTATED',\s*severity: 'CRITICAL',/g,
  "logger.error({ action: 'REFRESH_REPLAY_ATTACK', userId: session.userId, ip: data.ipAddress, userAgent: data.userAgent, message: 'Replay attack detected' });\n      await logAuditEvent({\n        userId: session.userId,\n        action: 'REFRESH_ROTATED',\n        severity: 'CRITICAL',"
);

// Unrecognized refresh token
content = content.replace(
  /await logAuditEvent\(\{\s*action: 'REFRESH_ROTATED',\s*severity: 'SECURITY',/g,
  "logger.warn({ action: 'REFRESH_FAILED', ip: data.ipAddress, userAgent: data.userAgent, message: 'Unrecognized refresh token submission' });\n      await logAuditEvent({\n        action: 'REFRESH_ROTATED',\n        severity: 'SECURITY',"
);

fs.writeFileSync('src/services/AuthService.ts', content);
