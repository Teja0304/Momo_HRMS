import { SetMetadata } from '@nestjs/common';

export const SKIP_PASSWORD_CHECK_KEY = 'skipPasswordChangeCheck';

/**
 * Marks a route as reachable even when the authenticated user has
 * `mustChangePassword: true`. Used ONLY for the handful of endpoints a
 * user needs to reach before they've set a real password: changing the
 * password itself, reading their own profile, and logging out.
 */
export const SkipPasswordChangeCheck = () => SetMetadata(SKIP_PASSWORD_CHECK_KEY, true);
