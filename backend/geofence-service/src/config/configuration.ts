export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  swaggerPath: string;
  corsOrigins: string[];
  database: { url: string };
  gatewayAuth: {
    sharedSecret: string;
    sharedSecretHeader: string;
    rolesHeader: string;
  };
  devAuth: boolean;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3003', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  swaggerPath: process.env.SWAGGER_PATH ?? 'api/docs',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  gatewayAuth: {
    sharedSecret: process.env.GATEWAY_SHARED_SECRET ?? '',
    sharedSecretHeader: (process.env.GATEWAY_SHARED_SECRET_HEADER ?? 'x-gateway-secret').toLowerCase(),
    rolesHeader: (process.env.GATEWAY_ROLES_HEADER ?? 'x-roles').toLowerCase(),
  },
  devAuth: (process.env.GEOFENCE_DEV_AUTH ?? 'true').toLowerCase() === 'true',
});
