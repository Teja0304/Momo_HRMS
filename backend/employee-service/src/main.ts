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
    .setTitle('Employee Service')
    .setDescription(
      'Employee profiles, departments, designations, and office assignment microservice for the Smart Employee Attendance & Management System',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-gateway-secret', in: 'header' }, 'gateway-secret')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, swaggerDocument);

  const port = configService.get('port', { infer: true });
  await app.listen(port);

  Logger.log(`Employee Service listening on port ${port} (prefix: /${apiPrefix})`, 'Bootstrap');
  Logger.log(`Swagger docs available at /${swaggerPath}`, 'Bootstrap');
  Logger.log(`Health check available at /health`, 'Bootstrap');
}

bootstrap();
