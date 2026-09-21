import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/rbac.constants';

/**
 * Marks a route as not requiring a valid access token.
 * Used sparingly — e.g. login, refresh, health checks.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
