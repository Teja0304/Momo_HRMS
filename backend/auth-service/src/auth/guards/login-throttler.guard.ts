import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Rate limiting for login (and other sensitive auth endpoints).
 *
 * Currently backed by the in-memory ThrottlerModule storage, which is
 * perfectly safe for local development and single-instance deployments.
 * The whole service does NOT depend on Redis to run.
 *
 * To scale horizontally, swap the ThrottlerModule's storage for
 * `@nestjs/throttler`'s Redis storage (or a custom ThrottlerStorage
 * implementation backed by ioredis) in AuthModule — nothing here needs
 * to change, since this guard only defines the throttling *key*.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Throttle by IP + attempted email, so one bad actor can't lock out
    // an entire NAT/office IP, while still rate-limiting brute force
    // attempts against a single account.
    const email = (req.body?.email ?? 'unknown').toString().toLowerCase();
    return `login:${req.ip}:${email}`;
  }
}
