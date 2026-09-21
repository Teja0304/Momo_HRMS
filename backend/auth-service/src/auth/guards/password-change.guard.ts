import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_PASSWORD_CHECK_KEY } from '../../common/decorators/skip-password-change-check.decorator';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Runs right after JwtAuthGuard (see AppModule's global guard order).
 * If the authenticated user still has a temporary/first-login password,
 * every route is blocked with a clear, distinguishable error EXCEPT the
 * ones explicitly marked @SkipPasswordChangeCheck() (change-password,
 * me, logout, logout-all). The frontend should catch this specific
 * error code and redirect straight to a "set your password" screen.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isExempt = this.reflector.getAllAndOverride<boolean>(SKIP_PASSWORD_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isExempt) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    // No authenticated user on this route (e.g. a @Public() route like
    // /auth/login) — nothing to check here, JwtAuthGuard already handled it.
    if (!user) {
      return true;
    }

    if (user.mustChangePassword) {
      throw new ForbiddenException({
        message: 'Password change required before continuing',
        error: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    return true;
  }
}
