import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../utils/errors';

/**
 * Service-to-service protection for /internal/* endpoints.
 * The calling service (for example the attendance service) sends
 *   X-Internal-Api-Key: <INTERNAL_SERVICE_API_KEY>
 * The comparison is constant-time so the key cannot be guessed by timing.
 * Normal user JWTs are NOT accepted on these routes.
 */
const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();
const expectedDigest = sha256(env.INTERNAL_SERVICE_API_KEY);

export const requireInternalKey: RequestHandler = (req, _res, next) => {
  const provided = req.headers['x-internal-api-key'];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('SERVICE_KEY_REQUIRED', 'Missing X-Internal-Api-Key header');
  }
  if (!timingSafeEqual(sha256(provided), expectedDigest)) {
    throw forbidden('SERVICE_KEY_INVALID', 'Invalid service key');
  }
  next();
};
