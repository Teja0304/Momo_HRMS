import * as crypto from 'crypto';
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { AuthEnrichmentMiddleware } from './middleware/auth-enrichment.middleware';
import { RateLimiterMiddleware } from './middleware/rate-limiter.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
  ],
  controllers: [HealthController],
  providers: [AuthEnrichmentMiddleware, RateLimiterMiddleware],
})
export class AppModule implements NestModule {
  constructor(
    private readonly configService: ConfigService,
    private readonly authEnrichment: AuthEnrichmentMiddleware,
    private readonly rateLimiter: RateLimiterMiddleware,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    // 1. Rate limiting & Anti-Brute-Force check on all incoming client requests
    consumer.apply((req, res, next) => this.rateLimiter.use(req, res, next)).forRoutes('*');

    // 2. Auth & identity enrichment middleware
    consumer.apply((req, res, next) => this.authEnrichment.use(req, res, next)).forRoutes('*');

    const authTarget = this.configService.get<string>('services.auth', 'http://localhost:3001');
    const attendanceTarget = this.configService.get<string>('services.attendance', 'http://localhost:3002');
    const geofenceTarget = this.configService.get<string>('services.geofence', 'http://localhost:3003');
    const employeeTarget = this.configService.get<string>('services.employee', 'http://localhost:3004');
    const notificationTarget = this.configService.get<string>('services.notification', 'http://localhost:3005');
    const faceTarget = this.configService.get<string>('services.face', 'http://localhost:3006');
    const gatewaySecret = this.configService.get<string>('gatewaySharedSecret', 'dev-gateway-secret');

    // Proxy helper with HMAC-SHA256 request signing
    const createProxy = (target: string) =>
      createProxyMiddleware({
        target,
        changeOrigin: true,
        on: {
          proxyReq: (proxyReq, req: any) => {
            // Compute HMAC-SHA256 Gateway signature to prevent direct port spoofing
            const timestamp = Date.now().toString();
            const targetUrl = req.originalUrl || req.url || '';
            const signature = crypto
              .createHmac('sha256', gatewaySecret)
              .update(`${targetUrl}:${timestamp}:${gatewaySecret}`)
              .digest('hex');

            proxyReq.setHeader('x-gateway-timestamp', timestamp);
            proxyReq.setHeader('x-gateway-signature', signature);
            proxyReq.setHeader('x-gateway-secret', gatewaySecret);

            fixRequestBody(proxyReq, req);
          },
          error: (err, req, res: any) => {
            if (!res.headersSent) {
              res.status(503).json({
                success: false,
                statusCode: 503,
                message: `Gateway failed to connect to downstream service at ${target}`,
                error: (err as Error).message,
              });
            }
          },
        },
      });

    // 2. Route proxies
    consumer.apply(createProxy(authTarget)).forRoutes({ path: 'api/v1/auth*', method: RequestMethod.ALL });
    consumer.apply(createProxy(attendanceTarget)).forRoutes({ path: 'api/v1/attendance*', method: RequestMethod.ALL });
    consumer.apply(createProxy(geofenceTarget)).forRoutes(
      { path: 'api/v1/geofence*', method: RequestMethod.ALL },
      { path: 'api/v1/offices*', method: RequestMethod.ALL },
    );
    consumer.apply(createProxy(employeeTarget)).forRoutes(
      { path: 'api/v1/employees*', method: RequestMethod.ALL },
      { path: 'api/v1/organization*', method: RequestMethod.ALL },
      { path: 'api/v1/departments*', method: RequestMethod.ALL },
      { path: 'api/v1/roles*', method: RequestMethod.ALL },
      { path: 'api/v1/devices*', method: RequestMethod.ALL },
    );
    consumer.apply(createProxy(notificationTarget)).forRoutes(
      { path: 'api/v1/notifications*', method: RequestMethod.ALL },
    );
    consumer.apply(createProxy(faceTarget)).forRoutes(
      { path: 'api/v1/face*', method: RequestMethod.ALL },
    );
  }
}
