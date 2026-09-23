import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma CLI configuration (migrations folder + seed command).
// `dotenv/config` loads backend/employee-service/.env so DATABASE_URL is available.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
