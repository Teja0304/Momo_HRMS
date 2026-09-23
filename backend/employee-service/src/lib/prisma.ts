import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env';

/**
 * One shared Prisma Client for the whole service.
 * DATABASE_URL (mysql://user:password@host:port/database) is split into the
 * connection options that the MySQL driver adapter expects.
 */
function createAdapter(): PrismaMariaDb {
  const url = new URL(env.DATABASE_URL);
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    connectionLimit: env.DB_POOL_SIZE,
    allowPublicKeyRetrieval: env.DB_ALLOW_PUBLIC_KEY_RETRIEVAL,
    // Store and read every DATETIME as UTC so results do not depend on the server time zone.
    timezone: 'Z',
  });
}

export const prisma = new PrismaClient({ adapter: createAdapter() });

/** Either the normal client or the client handed to you inside prisma.$transaction(...) */
export type Db = PrismaClient | Prisma.TransactionClient;
export type Tx = Prisma.TransactionClient;

/** Locks one department row until the current transaction ends (prevents races). */
export async function lockDepartment(tx: Tx, departmentId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM departments WHERE id = ${departmentId} FOR UPDATE`;
}

/** Locks one employee row until the current transaction ends. */
export async function lockEmployee(tx: Tx, employeeId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM employees WHERE id = ${employeeId} FOR UPDATE`;
}
