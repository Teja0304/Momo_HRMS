import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AttendanceModule } from './attendance/attendance.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmployeeAuthGuard } from './common/guards/employee-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            ttl: configService.get('throttle.ttl', { infer: true }) * 1000,
            limit: configService.get('throttle.limit', { infer: true }),
          },
        ],
      }),
    }),
    DatabaseModule,
    AttendanceModule,
    HealthModule,
    NotificationsModule,
  ],
  providers: [
    // Resolves the calling employee's identity for every route (see
    // EmployeeAuthGuard) — this service has nothing to authorize by
    // role, only an identity to resolve, so there's no RBAC guard here.
    { provide: APP_GUARD, useClass: EmployeeAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
