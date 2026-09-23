import pino from 'pino';
import { env } from '../config/env';

/**
 * Application logger. Authorization headers, cookies and the internal API key
 * are always redacted. Request bodies are never logged by this service.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-internal-api-key"]',
      'headers.authorization',
      '*.password',
      '*.token',
      '*.accessToken',
    ],
    censor: '[REDACTED]',
  },
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } : undefined,
});
