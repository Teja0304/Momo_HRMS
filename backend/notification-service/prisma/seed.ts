import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding notification-service database...');

  await prisma.notification.deleteMany({});

  await prisma.notification.createMany({
    data: [
      {
        id: 'NOTIF-001',
        recipientId: 'EMP-001',
        recipientType: 'EMPLOYEE',
        type: 'SYSTEM_ALERT',
        title: 'Welcome to Momo HRMS',
        body: 'Your geofence attendance account is active. Your assigned office is Pune HQ.',
        metadata: { officeId: 'OFFICE-001' },
        isRead: false,
      },
      {
        id: 'NOTIF-002',
        recipientId: 'EMP-001',
        recipientType: 'EMPLOYEE',
        type: 'CHECKIN_CONFIRMATION',
        title: 'Check-in Verified',
        body: 'Morning session recorded successfully within Pune HQ polygon.',
        metadata: { officeId: 'OFFICE-001', sessionNumber: 1 },
        isRead: true,
        readAt: new Date(),
      },
    ],
  });

  console.log('Notification seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
