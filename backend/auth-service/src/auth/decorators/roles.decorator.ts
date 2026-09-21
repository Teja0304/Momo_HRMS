import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../../common/constants/rbac.constants';

/**
 * Restricts a route to users holding at least one of the given roles.
 * Reusable by any future service that adopts the same JWT payload shape.
 *
 *   @Roles('HR_ADMIN', 'SUPER_ADMIN')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
