import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { UserRole } from '../config/constants';

/**
 * Middleware to restrict endpoints to Admins and Moderators only.
 * Assumes authMiddleware has run beforehand (populating req.user).
 */
export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized: User context missing' });
  }

  const hasAccess = (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) && user.isAdminSession === true;

  if (!hasAccess) {
    return res.status(403).json({ success: false, message: 'Forbidden: Separate administrative login session required' });
  }

  return next();
};

export default adminMiddleware;
