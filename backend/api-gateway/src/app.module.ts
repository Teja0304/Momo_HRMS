import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { AuthEnrichmentMiddleware } from './middleware/auth-enrichment.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  controllers: [HealthController],
  providers: [AuthEnrichmentMiddleware],
})
export class AppModule implements NestModule {
  constructor(
    private readonly configService: ConfigService,
    private readonly authEnrichment: AuthEnrichmentMiddleware,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    // 1. Auth & identity enrichment middleware for all incoming requests
    consumer.apply((req, res, next) => this.authEnrichment.use(req, res, next)).forRoutes('*');

    const authTarget = this.configService.get<string>('services.auth', 'http://localhost:3001');
    const attendanceTarget = this.configService.get<string>('services.attendance', 'http://localhost:3002');
    const geofenceTarget = this.configService.get<string>('services.geofence', 'http://localhost:3003');
    const employeeTarget = this.configService.get<string>('services.employee', 'http://localhost:3004');
    const notificationTarget = this.configService.get<string>('services.notification', 'http://localhost:3005');

    // Proxy helper
    const createProxy = (target: string) =>
      createProxyMiddleware({
        target,
        changeOrigin: true,
        on: {
          proxyReq: fixRequestBody,
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
    );
    consumer.apply(createProxy(notificationTarget)).forRoutes(
      { path: 'api/v1/notifications*', method: RequestMethod.ALL },
    );
  }
}
