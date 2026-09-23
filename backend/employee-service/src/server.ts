import { createApp } from './app';
import { env, API_PREFIX } from './config/env';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

async function main() {
  // Fail fast: verify the database is reachable before we start accepting requests.
  await prisma.$queryRaw`SELECT 1`;

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Employee Service listening on http://localhost:${env.PORT}${API_PREFIX} (env: ${env.NODE_ENV})`);
    logger.info(`API docs: http://localhost:${env.PORT}/api-docs`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'Employee Service failed to start');
  process.exit(1);
});
