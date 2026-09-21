export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiration: string;
    refreshExpiration: string;
  };
  throttle: {
    loginTtl: number;
    loginLimit: number;
  };
  redis: {
    enabled: boolean;
    url: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessExpiration: process.env.ACCESS_TOKEN_EXPIRATION ?? '15m',
    refreshExpiration: process.env.REFRESH_TOKEN_EXPIRATION ?? '7d',
  },
  throttle: {
    loginTtl: parseInt(process.env.LOGIN_THROTTLE_TTL ?? '60', 10),
    loginLimit: parseInt(process.env.LOGIN_THROTTLE_LIMIT ?? '5', 10),
  },
  redis: {
    enabled: (process.env.REDIS_ENABLED ?? 'false').toLowerCase() === 'true',
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
});
