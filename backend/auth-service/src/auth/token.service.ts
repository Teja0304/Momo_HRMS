import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { AppConfig } from '../config/configuration';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Access token: short-lived, minimal payload (sub + roles only —
   * never the full permission list, per spec section 7).
   */
  signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.accessSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.accessExpiration', { infer: true }),
    });
  }

  /**
   * Refresh token: a signed JWT carrying only {sub, sessionId}. The raw
   * token's SHA-256 hash is what gets persisted in
   * refresh_token_sessions — the raw value is never stored. A refresh
   * token is only honored if BOTH the signature/expiry check pass AND a
   * matching, non-revoked, non-expired session record is found.
   */
  signRefreshToken(userId: string): { token: string; sessionId: string } {
    const sessionId = randomUUID();
    const payload: RefreshTokenPayload = { sub: userId, sessionId };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.refreshExpiration', { infer: true }),
    });
    return { token, sessionId };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify<RefreshTokenPayload>(token, {
      secret: this.configService.get('jwt.refreshSecret', { infer: true }),
    });
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  getRefreshExpiryDate(): Date {
    const expiration = this.configService.get('jwt.refreshExpiration', { infer: true });
    return new Date(Date.now() + this.parseDurationMs(expiration));
  }

  /** Parses simple durations like "15m", "7d", "1h", "30s" into milliseconds. */
  private parseDurationMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      // Fall back to 7 days if misconfigured, rather than crashing.
      return 7 * 24 * 60 * 60 * 1000;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * unitMs[unit];
  }
}
