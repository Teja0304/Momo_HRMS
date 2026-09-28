import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';
import type { AuthUser } from '../utils/roles';

/**
 * The auth-service signs access tokens with { sub: <user id>, roles: string[] }
 * using HS256 and JWT_ACCESS_SECRET (see auth-service/src/auth/token.service.ts).
 * We verify the signature and expiry with the SAME secret. We never trust a role
 * that comes from a request body, only the one inside the verified token.
 */
const payloadSchema = z.object({
  sub: z.string().min(1),
  roles: z.array(z.string()),
});

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('UNAUTHENTICATED', 'Missing or malformed Authorization header. Use: Authorization: Bearer <accessToken>');
  }
  const token = header.slice('Bearer '.length).trim();

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('TOKEN_EXPIRED', 'Access token has expired. Log in again or refresh the token.');
    }
    throw unauthorized('INVALID_TOKEN', 'Access token is invalid.');
  }

  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) {
    throw unauthorized('INVALID_TOKEN', 'Access token payload is not recognised.');
  }

  req.user = { id: parsed.data.sub, roles: parsed.data.roles, accessToken: token };
  next();
};

/** Use inside controllers to get the logged-in user in a type-safe way. */
export function getActor(req: Request): AuthUser {
  if (!req.user) {
    throw unauthorized('UNAUTHENTICATED', 'Authentication required');
  }
  return req.user;
}
