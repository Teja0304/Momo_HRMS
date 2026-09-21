const PLACEHOLDER_VALUES = new Set([
  '',
  'change-me-access-secret',
  'change-me-refresh-secret',
  'changeme',
  'secret',
]);

/**
 * Called once at boot (see main.ts). Throws immediately — rather than
 * starting a service that will silently issue insecure tokens — if:
 *   - either JWT secret is missing or still the .env.example placeholder
 *   - either secret is too short to resist brute-forcing
 *   - both secrets are identical (access and refresh tokens must not
 *     be forgeable with the same key)
 */
export function validateSecrets(env: NodeJS.ProcessEnv): void {
  const accessSecret = env.JWT_ACCESS_SECRET ?? '';
  const refreshSecret = env.JWT_REFRESH_SECRET ?? '';
  const nodeEnv = env.NODE_ENV ?? 'development';

  const problems: string[] = [];

  if (PLACEHOLDER_VALUES.has(accessSecret)) {
    problems.push('JWT_ACCESS_SECRET is missing or still set to the example placeholder value.');
  }
  if (PLACEHOLDER_VALUES.has(refreshSecret)) {
    problems.push('JWT_REFRESH_SECRET is missing or still set to the example placeholder value.');
  }
  if (accessSecret && accessSecret.length < 32) {
    problems.push('JWT_ACCESS_SECRET is too short (use at least 32 random characters).');
  }
  if (refreshSecret && refreshSecret.length < 32) {
    problems.push('JWT_REFRESH_SECRET is too short (use at least 32 random characters).');
  }
  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  if (problems.length === 0) {
    return;
  }

  const message = [
    'Refusing to start: insecure JWT configuration detected.',
    ...problems.map((p) => `  - ${p}`),
    '',
    'Generate strong secrets with, e.g.:',
    '  openssl rand -hex 32',
    'and set them in your environment (never commit real secrets to .env files in git).',
  ].join('\n');

  // In production this is always fatal. In development we still fail
  // fast — silently running with example secrets is exactly how they
  // end up in production by accident.
  if (nodeEnv === 'test') {
    // Allow test runs (e.g. e2e) to proceed with dummy secrets.
    return;
  }

  throw new Error(message);
}
