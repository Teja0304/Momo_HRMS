import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppConfig } from '../../config/configuration';
import { EmployeeAuthContext } from '../interfaces/employee-auth-context.interface';

/**
 * Resolves WHO is calling, for every route (this is not an RBAC guard —
 * the Attendance Service does not own roles/permissions; it only reads
 * whatever the Auth Service already decided and the Gateway forwards).
 *
 * Two modes, controlled by ATTENDANCE_DEV_AUTH:
 *
 *  - DEV MODE (ATTENDANCE_DEV_AUTH=true): trusts X-Employee-Id /
 *    X-User-Id / X-Roles headers verbatim, with no verification, falling
 *    back to a configured default employee id if headers are omitted.
 *    Logs a loud warning on every request so it's impossible to miss
 *    that dev auth is active. NEVER enable this in a deployed environment.
 *
 *  - PRODUCTION MODE (ATTENDANCE_DEV_AUTH=false): requires the same
 *    identity headers, but ALSO requires a shared secret header that
 *    only the API Gateway should know, so a caller can't simply forge
 *    "X-Employee-Id: someone-else" by talking to this service directly.
 *    This is a stopgap until the Gateway does mTLS/service-auth; treat
 *    GATEWAY_SHARED_SECRET as a real secret, not a placeholder, in any
 *    shared environment.
 */
@Injectable()
export class EmployeeAuthGuard implements CanActivate {
  private readonly logger = new Logger(EmployeeAuthGuard.name);
  private hasWarnedDevAuth = false;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
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

      const authContext: EmployeeAuthContext = {
        employeeId,
        userId,
        roles: rolesHeader ? rolesHeader.split(',').map((r) => r.trim()) : ['EMPLOYEE'],
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

    const authContext: EmployeeAuthContext = {
      employeeId,
      userId,
      roles: rolesHeader ? rolesHeader.split(',').map((r) => r.trim()) : [],
      isDevAuth: false,
    };
    (request as Request & { employeeAuth: EmployeeAuthContext }).employeeAuth = authContext;
    return true;
  }
}
