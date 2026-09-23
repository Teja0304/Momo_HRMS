export interface AttendancePolicyConfig {
  checkInStartTime: string; // "HH:mm"
  checkInEndTime: string; // "HH:mm"
  lateThresholdMinutes: number;
  gracePeriodMinutes: number;
  autoCheckoutEnabled: boolean;
  workingHoursPerDay: number;
  allowManualCheckoutWhilePaused: boolean;
  minLocationAccuracyMeters: number;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  swaggerPath: string;
  corsOrigins: string[];
  database: { url: string };
  devAuth: {
    enabled: boolean;
    defaultEmployeeId: string;
  };
  gatewayAuth: {
    employeeIdHeader: string;
    userIdHeader: string;
    rolesHeader: string;
    sharedSecret: string;
    sharedSecretHeader: string;
  };
  policy: AttendancePolicyConfig;
  autoCheckout: {
    cron: string;
    batchSize: number;
  };
  throttle: { ttl: number; limit: number };
  redis: { enabled: boolean; url: string };
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3002', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  swaggerPath: process.env.SWAGGER_PATH ?? 'api/docs',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  devAuth: {
    enabled: parseBoolean(process.env.ATTENDANCE_DEV_AUTH, true),
    defaultEmployeeId: process.env.DEV_DEFAULT_EMPLOYEE_ID ?? 'EMP-001',
  },
  gatewayAuth: {
    employeeIdHeader: (process.env.GATEWAY_EMPLOYEE_ID_HEADER ?? 'x-employee-id').toLowerCase(),
    userIdHeader: (process.env.GATEWAY_USER_ID_HEADER ?? 'x-user-id').toLowerCase(),
    rolesHeader: (process.env.GATEWAY_ROLES_HEADER ?? 'x-roles').toLowerCase(),
    sharedSecret: process.env.GATEWAY_SHARED_SECRET ?? '',
    sharedSecretHeader: (process.env.GATEWAY_SHARED_SECRET_HEADER ?? 'x-gateway-secret').toLowerCase(),
  },
  policy: {
    checkInStartTime: process.env.POLICY_CHECK_IN_START_TIME ?? '07:00',
    checkInEndTime: process.env.POLICY_CHECK_IN_END_TIME ?? '10:00',
    lateThresholdMinutes: parseInt(process.env.POLICY_LATE_THRESHOLD_MINUTES ?? '15', 10),
    gracePeriodMinutes: parseInt(process.env.POLICY_GRACE_PERIOD_MINUTES ?? '60', 10),
    autoCheckoutEnabled: parseBoolean(process.env.POLICY_AUTO_CHECKOUT_ENABLED, true),
    workingHoursPerDay: parseInt(process.env.POLICY_WORKING_HOURS_PER_DAY ?? '8', 10),
    allowManualCheckoutWhilePaused: parseBoolean(
      process.env.POLICY_ALLOW_MANUAL_CHECKOUT_WHILE_PAUSED,
      false,
    ),
    minLocationAccuracyMeters: parseInt(
      process.env.POLICY_MIN_LOCATION_ACCURACY_METERS ?? '50',
      10,
    ),
  },
  autoCheckout: {
    cron: process.env.AUTO_CHECKOUT_CRON ?? '*/1 * * * *',
    batchSize: parseInt(process.env.AUTO_CHECKOUT_BATCH_SIZE ?? '100', 10),
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '60', 10),
  },
  redis: {
    enabled: parseBoolean(process.env.REDIS_ENABLED, false),
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
});
