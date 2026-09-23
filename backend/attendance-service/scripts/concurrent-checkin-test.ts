/**
 * Manual concurrency test — NOT part of the Jest suite.
 *
 * The unit/e2e tests use an in-memory fake Prisma (see
 * src/testing/fake-prisma.testutil.ts) that runs everything sequentially
 * in-process, so it cannot exercise real database row-locking. This
 * script instead fires genuinely simultaneous HTTP requests at a REAL
 * running instance backed by a REAL MySQL database, to prove the
 * SELECT ... FOR UPDATE lock in AttendanceService.checkIn actually
 * serializes concurrent check-ins for the same employee.
 *
 * Usage:
 *   1. Start the service against a real database:
 *        docker compose up -d mysql
 *        npx prisma migrate deploy
 *        npm run start:dev
 *   2. In another terminal:
 *        npx ts-node scripts/concurrent-checkin-test.ts
 *
 * Expected output: exactly one 201 (created) and the rest 409
 * (ATTENDANCE_ALREADY_ACTIVE) or 200 (idempotent replay, if clientEventIds
 * happened to collide — they don't here, each request gets a fresh one).
 */
import { randomUUID } from 'crypto';

const BASE_URL = process.env.ATTENDANCE_BASE_URL ?? 'http://localhost:3002/api/v1';
const EMPLOYEE_ID = process.env.CONCURRENCY_TEST_EMPLOYEE_ID ?? 'CONCURRENCY-TEST-EMP';
const CONCURRENT_REQUESTS = 10;

async function fireCheckIn(): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE_URL}/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Employee-Id': EMPLOYEE_ID, // relies on ATTENDANCE_DEV_AUTH=true
    },
    body: JSON.stringify({
      officeId: 'OFFICE-001',
      location: {
        latitude: 18.5204,
        longitude: 73.8567,
        accuracyMeters: 10,
        timestamp: new Date().toISOString(),
      },
      clientEventId: randomUUID(),
    }),
  });

  const body = await response.json().catch(() => undefined);
  return { status: response.status, body };
}

async function main() {
  console.log(
    `Firing ${CONCURRENT_REQUESTS} simultaneous check-in requests for employeeId=${EMPLOYEE_ID}...`,
  );

  const results = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, () => fireCheckIn()),
  );

  const created = results.filter((r) => r.status === 201);
  const rejected = results.filter((r) => r.status === 409);
  const other = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\nResults: ${created.length} created, ${rejected.length} rejected, ${other.length} other`);

  if (created.length === 1 && rejected.length === CONCURRENT_REQUESTS - 1 && other.length === 0) {
    console.log('PASS: exactly one check-in succeeded; the lock correctly serialized the rest.');
  } else {
    console.error('FAIL: expected exactly 1 success and the rest rejected. Raw results:');
    console.error(JSON.stringify(results, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exitCode = 1;
});
