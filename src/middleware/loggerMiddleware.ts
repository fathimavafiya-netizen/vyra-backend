import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface CustomRequest extends Request {
  id?: string;
  startTime?: number;
}

export const loggerMiddleware = (req: CustomRequest, res: Response, next: NextFunction) => {
  const reqId = Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
  req.id = reqId;
  req.startTime = Date.now();

  logger.info({
    msg: `Incoming Request: ${req.method} ${req.originalUrl}`,
    requestId: reqId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    logger.info({
      msg: `Request Completed: ${req.method} ${req.originalUrl} - Status ${res.statusCode}`,
      requestId: reqId,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
};

export default loggerMiddleware;
