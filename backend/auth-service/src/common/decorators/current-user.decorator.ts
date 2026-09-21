import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}

/**
 * Extracts the authenticated user (attached to the request by JwtAuthGuard/
 * JwtStrategy) inside a controller handler, e.g.:
 *
 *   getMe(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    return data ? user?.[data] : user;
  },
);
