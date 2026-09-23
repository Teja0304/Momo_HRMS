import { Injectable } from '@nestjs/common';
import { EmployeeProvider } from '../interfaces/employee-provider.interface';

/**
 * Development/testing stand-in for the future Employee Service.
 * Permissive by default (every employee is considered assigned to
 * every office) so the attendance flow is testable standalone before
 * the Employee Service exists. A real implementation should fail
 * CLOSED for unknown employee/office pairs, unlike this mock.
 */
@Injectable()
export class MockEmployeeProvider implements EmployeeProvider {
  private readonly deniedPairs = new Set<string>();

  /** Test helper: simulate an employee NOT being assigned to an office. */
  denyAssignment(employeeId: string, officeId: string): void {
    this.deniedPairs.add(`${employeeId}:${officeId}`);
  }

  async isAssignedToOffice(employeeId: string, officeId: string): Promise<boolean> {
    return !this.deniedPairs.has(`${employeeId}:${officeId}`);
  }
}
