/**
 * Shape of the JWT access token payload.
 * Kept minimal by design (sub + roles) — permissions are resolved
 * server-side on each request rather than embedded in the token, so
 * revoking/changing a permission takes effect immediately without
 * waiting for token expiry.
 */
export interface JwtPayload {
  sub: string; // user id
  roles: string[];
}
