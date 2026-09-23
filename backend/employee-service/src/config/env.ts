import 'dotenv/config';
import { z } from 'zod';

/**
 * All environment variables are read and validated here, once, at start-up.
 * If something is missing or unsafe the service prints a clear message and
 * refuses to start (instead of failing later with a confusing error).
 */

const PLACEHOLDER = /^(change-?me|changeme|secret|password|example)/i;

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const strongSecret = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters long`)
    .refine((value) => !PLACEHOLDER.test(value), `${name} is still the example placeholder`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8081'),

  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .refine((value) => value.startsWith('mysql://'), 'DATABASE_URL must start with mysql://'),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  // MySQL 8 uses caching_sha2_password. Without TLS the driver needs this flag
  // to fetch the server's public key. Set to false if you connect over TLS.
  DB_ALLOW_PUBLIC_KEY_RETRIEVAL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // Must be the SAME value as JWT_ACCESS_SECRET in backend/auth-service/.env
  JWT_ACCESS_SECRET: strongSecret('JWT_ACCESS_SECRET'),

  // Shared secret for service-to-service calls (attendance service -> /internal/*)
  INTERNAL_SERVICE_API_KEY: strongSecret('INTERNAL_SERVICE_API_KEY'),

  // Optional. Example: http://localhost:3001/api/v1
  // When set, the service (a) checks that a linked login account really exists and
  // (b) pushes role changes to the auth-service so login roles stay in sync.
  AUTH_SERVICE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  AUTH_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
    console.error(
      ['', 'Employee Service cannot start: invalid environment configuration.', ...lines, '', 'Fix your .env file (see .env.example) and try again.', ''].join('\n'),
    );
    process.exit(1);
  }
  const data = result.data;
  return {
    ...data,
    isProduction: data.NODE_ENV === 'production',
    corsOrigins: data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export const env = loadEnv();
export const API_PREFIX = '/api/v1';
