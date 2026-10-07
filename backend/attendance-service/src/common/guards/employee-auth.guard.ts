import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppConfig } from '../../config/configuration';
import { EmployeeAuthContext } from '../interfaces/employee-auth-context.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class EmployeeAuthGuard implements CanActivate {
  private readonly logger = new Logger(EmployeeAuthGuard.name);
  private hasWarnedDevAuth = false;

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

    const request = context.switchToHttp().getRequest<Request>();
    const devAuth = this.configService.get('devAuth', { infer: true });
    const gatewayAuth = this.configService.get('gatewayAuth', { infer: true });

    if (devAuth.enabled) {
      if (!this.hasWarnedDevAuth) {
        this.logger.warn(
          'ATTENDANCE_DEV_AUTH=true — identity headers are trusted WITHOUT verification. ' +
            'This must never be enabled outside local development.',
        );
        this.hasWarnedDevAuth = true;
      }

      const employeeId =
        (request.headers[gatewayAuth.employeeIdHeader] as string) ?? devAuth.defaultEmployeeId;
      const userId = (request.headers[gatewayAuth.userIdHeader] as string) ?? employeeId;
      const rolesHeader = request.headers[gatewayAuth.rolesHeader] as string | undefined;

      const parseRolesHeader = (header?: string, fallback: string[] = []): string[] => {
        if (!header) return fallback;
        const parsed = header
          .replace(/[\[\]"'\\]/g, '')
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean);
        return parsed.length > 0 ? parsed : fallback;
      };

      const authContext: EmployeeAuthContext = {
        employeeId,
        userId,
        roles: parseRolesHeader(rolesHeader, ['EMPLOYEE']),
        isDevAuth: true,
      };
      (request as Request & { employeeAuth: EmployeeAuthContext }).employeeAuth = authContext;
      return true;
    }
    // Production mode.
    const providedSecret = request.headers[gatewayAuth.sharedSecretHeader] as string | undefined;
    if (!gatewayAuth.sharedSecret || providedSecret !== gatewayAuth.sharedSecret) {
      throw new UnauthorizedException('Missing or invalid gateway credentials');
    }

    const employeeId = request.headers[gatewayAuth.employeeIdHeader] as string | undefined;
    const userId = request.headers[gatewayAuth.userIdHeader] as string | undefined;
    const rolesHeader = request.headers[gatewayAuth.rolesHeader] as string | undefined;

    if (!employeeId || !userId) {
      throw new UnauthorizedException('Missing authenticated identity headers');
    }

    const parseRolesHeader = (header?: string, fallback: string[] = []): string[] => {
      if (!header) return fallback;
      const parsed = header
        .replace(/[\[\]"'\\]/g, '')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      return parsed.length > 0 ? parsed : fallback;
    };

    const authContext: EmployeeAuthContext = {
      employeeId,
      userId,
      roles: parseRolesHeader(rolesHeader, []),
      isDevAuth: false,
    };
    (request as Request & { employeeAuth: EmployeeAuthContext }).employeeAuth = authContext;
    return true;
  }
}
