# Sociall Backend Logging Conventions

This document outlines the standard logging conventions for the Sociall backend. We use `pino` for structured JSON logging.

## 1. Log Levels
We use standard Pino log levels:
- **trace**: Extremely detailed information, useful only during deep debugging.
- **debug**: Diagnostic information useful for developers (e.g., payloads, state changes).
- **info**: General operational entries (e.g., request completed, user logged in).
- **warn**: Something unexpected happened, but the application recovered (e.g., rate limit hit).
- **error**: An operation failed, but the application keeps running (e.g., database query failed).
- **fatal**: The application cannot recover and must exit.

## 2. Standard Action Names
Always use predefined action names from `src/logger/actions.ts`. This makes searching and filtering logs much easier.
Examples:
- `AUTH_LOGIN`
- `AUTH_LOGIN_FAILED`
- `AUTH_LOGOUT`
- `AUTH_REGISTER`
- `AUTH_REFRESH`
- `OTP_SENT`
- `OTP_VERIFIED`
- `PASSWORD_RESET_REQUEST`
- `PASSWORD_RESET_SUCCESS`
- `DRAFT_CREATE`
- `POST_CREATE`
- `QUEUE_PROCESS`

## 3. Required Fields
Every business event log entry should include:
- `requestId`: For request correlation (automatically injected by `loggerMiddleware` for HTTP requests, but pass it explicitly if possible).
- `module`: The subsystem emitting the log (e.g., `auth`, `drafts`). Set automatically by using `createChildLogger(moduleName)`.
- `action`: The standard action name.
- `userId`: The ID of the user performing the action (if applicable).
- `message`: A human-readable description of the event.

Example:
```json
{
  "level": 30,
  "time": 1718873641000,
  "requestId": "a1b2c3d4",
  "module": "auth",
  "action": "AUTH_LOGIN",
  "userId": "user-123",
  "ip": "127.0.0.1",
  "userAgent": "Mozilla/5.0",
  "message": "User logged in successfully"
}
```

## 4. Guidelines
- **Child Loggers**: Always instantiate a child logger for your module using `const logger = createChildLogger('moduleName');` rather than importing the base logger directly.
- **Errors vs Business Events**: Use `logger.error` when an exception is caught that prevents a business action from completing. Include the `err` object so Pino can serialize the stack trace. Use `logger.info` for successful business events.
