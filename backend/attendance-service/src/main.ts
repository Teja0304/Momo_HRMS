import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  const apiPrefix = configService.get('apiPrefix', { infer: true });
  const swaggerPath = configService.get('swaggerPath', { infer: true });

  // Health check is intentionally NOT under the API prefix (spec §27: "GET /health").
  app.setGlobalPrefix(apiPrefix, { exclude: ['health'] });

  app.use(helmet());

  app.enableCors({
    origin: configService.get('corsOrigins', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Attendance Service')
    .setDescription(
      'Attendance business-logic microservice for the Smart Employee Attendance & Management System',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'X-Employee-Id', in: 'header' },
      'dev-employee-id',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, swaggerDocument);

  const devAuth = configService.get('devAuth', { infer: true });
  if (devAuth.enabled) {
    Logger.warn(
      'ATTENDANCE_DEV_AUTH=true — running with UNVERIFIED development authentication. ' +
        'Never enable this in a shared or production environment.',
      'Bootstrap',
    );
  } else {
    const gatewayAuth = configService.get('gatewayAuth', { infer: true });
    if (!gatewayAuth.sharedSecret) {
      Logger.warn(
        'ATTENDANCE_DEV_AUTH=false but GATEWAY_SHARED_SECRET is not set — every request ' +
          'will be rejected with 401 until it is configured.',
        'Bootstrap',
      );
    }
  }

  const port = configService.get('port', { infer: true });
  await app.listen(port);

  Logger.log(`Attendance Service listening on port ${port} (prefix: /${apiPrefix})`, 'Bootstrap');
  Logger.log(`Swagger docs available at /${swaggerPath}`, 'Bootstrap');
  Logger.log(`Health check available at /health`, 'Bootstrap');
}

bootstrap();
