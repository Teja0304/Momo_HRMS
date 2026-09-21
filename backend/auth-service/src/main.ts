import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { validateSecrets } from './config/validate-env';

async function bootstrap() {
  // Fail fast, before touching the database or opening a port, if the
  // JWT secrets are missing/default/weak. See validate-env.ts.
  validateSecrets(process.env);

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  const apiPrefix = configService.get('apiPrefix', { infer: true });
  app.setGlobalPrefix(apiPrefix);

  app.use(helmet());

  app.enableCors({
    origin: configService.get('corsOrigins', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not defined in the DTO
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription(
      'Authentication & Authorization microservice for the Smart Employee Attendance & Management System',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, swaggerDocument);

  const port = configService.get('port', { infer: true });
  await app.listen(port);

  Logger.log(`Auth Service listening on port ${port} (prefix: /${apiPrefix})`, 'Bootstrap');
  Logger.log(`Swagger docs available at /${apiPrefix}/docs`, 'Bootstrap');
}

bootstrap();
