export default () => ({
  port: parseInt(process.env.PORT, 10) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
  gatewaySharedSecret: process.env.GATEWAY_SHARED_SECRET || 'dev-gateway-secret',
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    attendance: process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3002',
    geofence: process.env.GEOFENCE_SERVICE_URL || 'http://localhost:3003',
    employee: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3004',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  },
});
