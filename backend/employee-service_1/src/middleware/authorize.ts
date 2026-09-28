import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../utils/errors';

/**
 * Role-based access control (RBAC).
 * Example: router.post('/', authenticate, requireRoles('HR_ADMIN', 'SUPER_ADMIN'), handler)
 * Passes when the logged-in user has AT LEAST ONE of the listed roles.
 */
export const requireRoles =
  (...allowed: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      throw unauthorized('UNAUTHENTICATED', 'Authentication required');
    }
    if (!req.user.roles.some((role) => allowed.includes(role))) {
      throw forbidden('FORBIDDEN', 'You do not have permission to perform this action');
    }
    next();
  };
