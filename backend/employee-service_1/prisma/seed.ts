import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

/**
 * Safe to run more than once: every insert is an `upsert` keyed on a unique
 * field, so re-running this script updates existing rows instead of creating
 * duplicates. No production admin password is created here — admin login
 * accounts are created by backend/auth-service's own seed script.
 */

function createPrisma(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in first.');
  }
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

const DEPARTMENTS = [
  { name: 'Engineering', code: 'ENG', description: 'Product engineering and software development' },
  { name: 'Human Resources', code: 'HR', description: 'Hiring, onboarding and employee relations' },
  { name: 'Sales', code: 'SALES', description: 'Business development and client accounts' },
  { name: 'Operations', code: 'OPS', description: 'Facilities, logistics and day-to-day operations' },
];

// Names mirror the auth-service's role constants exactly (see
// backend/auth-service/src/common/constants/rbac.constants.ts) plus two
// employee-service-only job-level roles (MANAGER, EMPLOYEE is shared).
const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Full administrative access across the system' },
  { name: 'HR_ADMIN', description: 'Manages employees, departments, devices and face-template references' },
  { name: 'MANAGER', description: 'Manages a team within a department (no system administration rights)' },
  { name: 'EMPLOYEE', description: 'Standard employee with access to their own record' },
];

async function main() {
  const prisma = createPrisma();
  try {
    console.log('Seeding departments...');
    const departments: Record<string, string> = {};
    for (const dept of DEPARTMENTS) {
      const row = await prisma.department.upsert({
        where: { code: dept.code },
        update: { name: dept.name, description: dept.description },
        create: dept,
      });
      departments[dept.code] = row.id;
    }

    console.log('Seeding roles...');
    const roles: Record<string, string> = {};
    for (const role of ROLES) {
      const row = await prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description },
        create: role,
      });
      roles[role.name] = row.id;
    }

    console.log('Seeding sample employees...');
    const eng = departments.ENG!;
    const hr = departments.HR!;
    const employeeRole = roles.EMPLOYEE!;
    const hrAdminRole = roles.HR_ADMIN!;
    const managerRole = roles.MANAGER!;

    const sampleEmployees = [
      {
        employeeCode: 'EMP-0001',
        firstName: 'Asha',
        lastName: 'Kulkarni',
        email: 'asha.kulkarni@momo-hrms.example',
        phone: '+91 98765 43210',
        dateOfJoining: new Date('2023-01-15T00:00:00.000Z'),
        jobTitle: 'HR Manager',
        departmentId: hr,
        roleId: hrAdminRole,
      },
      {
        employeeCode: 'EMP-0002',
        firstName: 'Rohan',
        lastName: 'Deshmukh',
        email: 'rohan.deshmukh@momo-hrms.example',
        phone: '+91 98765 43211',
        dateOfJoining: new Date('2023-03-01T00:00:00.000Z'),
        jobTitle: 'Software Engineer',
        departmentId: eng,
        roleId: employeeRole,
      },
      {
        employeeCode: 'EMP-0003',
        firstName: 'Neha',
        lastName: 'Patil',
        email: 'neha.patil@momo-hrms.example',
        phone: '+91 98765 43212',
        dateOfJoining: new Date('2022-07-10T00:00:00.000Z'),
        jobTitle: 'Engineering Manager',
        departmentId: eng,
        roleId: managerRole,
      },
    ];

    for (const employee of sampleEmployees) {
      await prisma.employee.upsert({
        where: { employeeCode: employee.employeeCode },
        update: {},
        create: employee,
      });
    }

    console.log('Seed complete.');
    console.log({ departments: Object.keys(departments).length, roles: Object.keys(roles).length, employees: sampleEmployees.length });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
