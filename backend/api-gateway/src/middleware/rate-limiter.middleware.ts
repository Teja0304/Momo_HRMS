import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  // In-memory sliding window counters
  private readonly records = new Map<string, RateLimitRecord>();

  use(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const path = req.path || req.originalUrl || '';

    let key = '';
    let maxAttempts = 100; // default rate limit per minute
    const windowMs = 60 * 1000; // 1 minute

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';

    // 1. Anti-Brute-Force for Login: Max 5 attempts / minute per IP
    if (path.includes('/auth/login') && req.method === 'POST') {
      key = `auth_login:${clientIp}`;
      maxAttempts = 5;
    }
    // 2. Anti-Iteration for Face Verify: Max 10 attempts / minute per employee (or IP)
    else if (path.includes('/face/verify') && req.method === 'POST') {
      const employeeId = req.body?.employee_id || req.headers['x-employee-id'] || clientIp;
      key = `face_verify:${employeeId}`;
      maxAttempts = 10;
    }

    if (key) {
      let record = this.records.get(key);
      if (!record || now > record.resetAt) {
        record = { count: 1, resetAt: now + windowMs };
        this.records.set(key, record);
      } else {
        record.count += 1;
      }

      const remaining = Math.max(0, maxAttempts - record.count);
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

      res.setHeader('X-RateLimit-Limit', maxAttempts);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      if (record.count > maxAttempts) {
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message:
            maxAttempts === 5
              ? 'Too many login attempts. Please wait 1 minute before trying again.'
              : 'Too many face verification attempts. Please wait 1 minute before trying again.',
          retryAfterSeconds,
        });
        return;
      }
    }

    // Periodic cleanup of expired keys (every 200 requests)
    if (this.records.size > 2000) {
      for (const [k, v] of this.records.entries()) {
        if (now > v.resetAt) {
          this.records.delete(k);
        }
      }
    }

    next();
  }
}
