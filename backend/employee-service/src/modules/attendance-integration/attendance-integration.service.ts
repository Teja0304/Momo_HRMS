import { prisma } from '../../lib/prisma';
import { notFound } from '../../utils/errors';
import { isTemplateLive } from '../../utils/serializers';

/**
 * The ONLY data the attendance service is allowed to see about an employee.
 * No name, email, phone or any other personal or biometric detail.
 */
export async function getAttendanceEligibility(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');

  const [activeDevice, activeFaceTemplate] = await Promise.all([
    prisma.employeeDevice.findFirst({ where: { employeeId, status: 'ACTIVE' } }),
    prisma.faceTemplateReference.findFirst({ where: { employeeId, status: 'ACTIVE' } }),
  ]);

  const hasActiveDevice = activeDevice !== null;
  const hasActiveFaceTemplate = activeFaceTemplate !== null && isTemplateLive(activeFaceTemplate);
  const isEligible = employee.status === 'ACTIVE' && hasActiveDevice && hasActiveFaceTemplate;

  return {
    employeeId: employee.id,
    status: employee.status,
    isEligibleForAttendance: isEligible,
    hasActiveDevice,
    hasActiveFaceTemplate,
  };
}
