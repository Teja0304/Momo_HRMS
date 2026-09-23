import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { FakePrismaService } from '../src/testing/fake-prisma.testutil';

describe('Attendance Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new FakePrismaService())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health -> 200 ok, no /api/v1 prefix', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('attendance-service');
  });

  it('rejects a malformed check-in body (validation pipe active)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .send({ officeId: 'OFFICE-001' }) // missing location + clientEventId
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('checks in via dev-auth default employee, then rejects a duplicate check-in', async () => {
    const body = {
      officeId: 'OFFICE-001',
      location: {
        latitude: 18.5204,
        longitude: 73.8567,
        accuracyMeters: 10,
        timestamp: '2026-09-22T09:30:00Z',
      },
      clientEventId: 'e2e-checkin-1',
    };

    const first = await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .send(body)
      .expect(201);

    expect(first.body.success).toBe(true);
    expect(first.body.data.status).toBe('WORKING');
    expect(first.body.message).toBe('Attendance checked in successfully');

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .send({ ...body, clientEventId: 'e2e-checkin-2' })
      .expect(409);

    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.error.code).toBe('ATTENDANCE_ALREADY_ACTIVE');
  });

  it('GET /api/v1/attendance/today reflects the active session', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/attendance/today').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hasActiveSession).toBe(true);
  });
});
