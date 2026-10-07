import * as crypto from 'crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppConfig } from '../../config/configuration';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class GatewayAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const devAuth = this.configService.get('devAuth', { infer: true });
    if (devAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const gatewayAuth = this.configService.get('gatewayAuth', { infer: true });
    const providedSecret = request.headers[gatewayAuth.sharedSecretHeader] as string | undefined;

    if (!gatewayAuth.sharedSecret || providedSecret !== gatewayAuth.sharedSecret) {
      throw new UnauthorizedException('Missing or invalid gateway secret');
    }

    // Verify HMAC Gateway Request Signature to prevent internal port spoofing
    const signature = request.headers['x-gateway-signature'] as string | undefined;
    const timestamp = request.headers['x-gateway-timestamp'] as string | undefined;

    if (signature && timestamp) {
      const tsNum = parseInt(timestamp, 10);
      const now = Date.now();
      if (Math.abs(now - tsNum) > 300000) {
        throw new UnauthorizedException('Gateway request signature expired (potential replay attack)');
      }
      const targetUrl = request.originalUrl || request.url || '';
      const expectedSig = crypto
        .createHmac('sha256', gatewayAuth.sharedSecret)
        .update(`${targetUrl}:${timestamp}:${gatewayAuth.sharedSecret}`)
        .digest('hex');

      if (signature !== expectedSig) {
        throw new UnauthorizedException('Invalid HMAC gateway signature');
      }
    }

    return true;
  }
}
