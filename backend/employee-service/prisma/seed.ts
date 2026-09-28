import { PrismaClient, EmploymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Employee database...');

  // 1. Departments
  const engDept = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: {},
    create: {
      code: 'ENG',
      name: 'Engineering',
      description: 'Software development & IT operations',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: {
      code: 'HR',
      name: 'Human Resources',
      description: 'People operations & talent management',
    },
  });

  // 2. Designations
  const swe = await prisma.designation.upsert({
    where: { code: 'SWE' },
    update: {},
    create: {
      code: 'SWE',
      title: 'Software Engineer',
      departmentId: engDept.id,
    },
  });

  const hrManager = await prisma.designation.upsert({
    where: { code: 'HR_MGR' },
    update: {},
    create: {
      code: 'HR_MGR',
      title: 'HR Manager',
      departmentId: hrDept.id,
    },
  });

  // 3. Default Employee (matching dev default EMP-001)
  const defaultEmp = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-001' },
    update: {},
    create: {
      id: 'e1a2b3c4-0000-0000-0000-000000000001',
      employeeCode: 'EMP-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@company.com',
      phone: '+91 9876543210',
      departmentId: engDept.id,
      designationId: swe.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
  });

  // 4. Default Office Assignment to OFFICE-001
  const existingAssignment = await prisma.employeeOfficeAssignment.findFirst({
    where: {
      employeeId: defaultEmp.id,
      officeId: 'OFFICE-001',
      isActive: true,
    },
  });

  if (!existingAssignment) {
    await prisma.employeeOfficeAssignment.create({
      data: {
        employeeId: defaultEmp.id,
        officeId: 'OFFICE-001',
        isPrimary: true,
        isActive: true,
      },
    });
    console.log(`Assigned employee ${defaultEmp.employeeCode} to OFFICE-001`);
  }

  console.log('Employee database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
