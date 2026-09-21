import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { HealthModule } from './health/health.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SanitizeResponseInterceptor } from './common/interceptors/sanitize-response.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PasswordChangeGuard } from './auth/guards/password-change.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    HealthModule,
  ],
  providers: [
    // Global guard chain, executed in this order:
    //   JWT Auth Guard -> Password Change Guard -> Role Guard -> Permission Guard.
    // Individual routes opt out of auth with @Public(), opt out of the
    // password-change block with @SkipPasswordChangeCheck(), and opt into
    // extra RBAC checks with @Roles(...) / @Permissions(...). Guards with
    // no matching metadata on a route are a no-op (see each guard).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: SanitizeResponseInterceptor },
  ],
})
export class AppModule {}
