import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthEnrichmentMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthEnrichmentMiddleware.name);
  private readonly jwtSecret: string;
  private readonly gatewaySecret: string;

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret = this.configService.get<string>('jwtAccessSecret', 'dev-access-secret-change-in-production');
    this.gatewaySecret = this.configService.get<string>('gatewaySharedSecret', 'dev-gateway-secret');
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Always inject gateway shared secret for downstream service verification
    req.headers['x-gateway-secret'] = this.gatewaySecret;

    const authHeader = req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        if (decoded) {
          if (decoded.sub && !req.headers['x-user-id']) {
            req.headers['x-user-id'] = decoded.sub;
          }
          if (decoded.employeeId && !req.headers['x-employee-id']) {
            req.headers['x-employee-id'] = decoded.employeeId;
          }
          if (decoded.roles && !req.headers['x-roles']) {
            req.headers['x-roles'] = Array.isArray(decoded.roles) ? JSON.stringify(decoded.roles) : String(decoded.roles);
          }
          if (decoded.permissions && !req.headers['x-permissions']) {
            req.headers['x-permissions'] = Array.isArray(decoded.permissions) ? JSON.stringify(decoded.permissions) : String(decoded.permissions);
          }
        }
      } catch (err) {
        // Token might be expired or invalid - downstream services or guards will reject it
        this.logger.debug(`Could not verify JWT token in gateway: ${(err as Error).message}`);
      }
    }

    next();
  }
}
