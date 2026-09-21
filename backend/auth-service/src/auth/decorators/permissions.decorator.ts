import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../../common/constants/rbac.constants';

/**
 * Restricts a route to users holding ALL of the given fine-grained
 * permissions (resolved server-side from the user's role(s), not read
 * directly from the JWT).
 *
 *   @Permissions('employee.create')
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
