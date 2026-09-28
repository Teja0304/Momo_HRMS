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

    return true;
  }
}
