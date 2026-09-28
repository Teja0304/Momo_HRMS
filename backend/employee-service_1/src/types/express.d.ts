import type { AuthUser } from '../utils/roles';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware after the JWT has been verified. */
      user?: AuthUser;
    }
  }
}

export {};
