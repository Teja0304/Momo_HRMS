const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.$queryRawUnsafe(
    'SELECT id, employee_id, office_id, status, check_in_at, check_out_at, total_working_seconds, created_at FROM attendance_service.attendance_sessions ORDER BY created_at DESC LIMIT 15'
  );
  console.log('RECENT 15 SESSIONS IN ATTENDANCE_SERVICE:');
  console.log(sessions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
