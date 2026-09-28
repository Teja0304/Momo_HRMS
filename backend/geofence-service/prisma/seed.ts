import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Geofence database...');

  // Default office from specification
  const office = await prisma.office.upsert({
    where: { code: 'OFFICE-001' },
    update: {},
    create: {
      id: 'd1a2b3c4-0000-0000-0000-000000000001',
      code: 'OFFICE-001',
      name: 'Pune Headquarters',
      address: 'Main IT Park, Pune',
      city: 'Pune',
      country: 'India',
      isActive: true,
      minAltitudeMeters: 500.0,
      maxAltitudeMeters: 620.0,
    },
  });

  // Check if polygon already exists
  const existingPolygon = await prisma.geofencePolygon.findFirst({
    where: { officeId: office.id, isActive: true },
  });

  if (!existingPolygon) {
    const polygon = await prisma.geofencePolygon.create({
      data: {
        officeId: office.id,
        name: 'Main Campus Polygon',
        version: 1,
        isActive: true,
        vertices: {
          create: [
            { sequence: 0, latitude: 18.5210, longitude: 73.8560 },
            { sequence: 1, latitude: 18.5210, longitude: 73.8570 },
            { sequence: 2, latitude: 18.5200, longitude: 73.8570 },
            { sequence: 3, latitude: 18.5200, longitude: 73.8560 },
          ],
        },
      },
    });
    console.log(`Seeded polygon ${polygon.id} with 4 vertices for office ${office.name}`);
  }

  console.log('Geofence seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
