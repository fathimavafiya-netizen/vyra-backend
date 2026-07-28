const fs = require('fs');
let content = fs.readFileSync('src/auth/controllers/AuthController.ts', 'utf8');

content = content.replace(/logger\.error\(\`([^\`]+)\`\);/g, 'logger.error({ err: e, message: `$1` });');

content = content.replace(
  /await metricsService\.incrementMetric\('otp_generated'\);/g,
  "await metricsService.incrementMetric('otp_generated');\n      logger.info({ action: LogAction.OTP_SENT, email: cleanEmail || undefined, mobile: cleanMobile || undefined, message: 'OTP sent' });"
);

content = content.replace(
  /await metricsService\.incrementMetric\('otp_verified'\);/g,
  "await metricsService.incrementMetric('otp_verified');\n      logger.info({ action: LogAction.OTP_VERIFIED, email: cleanEmail || undefined, mobile: cleanMobile || undefined, message: 'OTP verified' });"
);

content = content.replace(
  /logger\.info\(\`Reactivated user via password login: id=\$\{user\.id\}\`\);/,
  "logger.info({ action: LogAction.AUTH_LOGIN, userId: user.id, message: 'Reactivated user via password login' });"
);

content = content.replace(
  /return res\.status\(200\)\.json\(\{\s*success: true,\s*message: 'Logged in successfully\.',/g,
  "logger.info({ action: LogAction.AUTH_LOGIN, userId: user.id, message: 'User logged in successfully' });\n      return res.status(200).json({\n        success: true,\n        message: 'Logged in successfully.',"
);

content = content.replace(
  /return res\.status\(400\)\.json\(\{ success: false, code: 'LOGIN_FAILED', message: 'Invalid credentials\.' \}\);/g,
  "logger.warn({ action: LogAction.AUTH_LOGIN_FAILED, email: cleanEmail, mobile: cleanMobile, message: 'Invalid credentials' });\n        return res.status(400).json({ success: false, code: 'LOGIN_FAILED', message: 'Invalid credentials.' });"
);

content = content.replace(
  /return res\.status\(200\)\.json\(\{\s*success: true,\s*message: 'Registration successful\. Please log in\.',/g,
  "logger.info({ action: LogAction.AUTH_REGISTER, userId: user.id, message: 'User registered successfully' });\n      return res.status(200).json({\n        success: true,\n        message: 'Registration successful. Please log in.',"
);

content = content.replace(
  /clearAuthCookies\(res\);\s*return res\.status\(200\)\.json\(\{\s*success: true,\s*message: 'Logged out successfully\.',/g,
  "clearAuthCookies(res);\n      logger.info({ action: LogAction.AUTH_LOGOUT, message: 'User logged out' });\n      return res.status(200).json({\n        success: true,\n        message: 'Logged out successfully.',"
);

content = content.replace(
  /setAuthCookies\(res, result\.accessToken, result\.refreshToken, true\);\s*return res\.status\(200\)\.json\(\{\s*success: true,\s*message: 'Tokens rotated successfully\.',/g,
  "setAuthCookies(res, result.accessToken, result.refreshToken, true);\n      logger.info({ action: LogAction.AUTH_REFRESH, userId: result.user.id, message: 'Tokens rotated successfully' });\n      return res.status(200).json({\n        success: true,\n        message: 'Tokens rotated successfully.',"
);

fs.writeFileSync('src/auth/controllers/AuthController.ts', content);
