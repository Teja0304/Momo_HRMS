/**
 * The Attendance Service does not own employee profiles or office
 * assignments — that belongs to the Employee Service. This interface
 * is the only way attendance logic asks "is this employee allowed to
 * work at this office?". Swap MockEmployeeProvider for a real
 * HTTP-backed implementation once the Employee Service exists.
 */
export interface EmployeeProvider {
  isAssignedToOffice(employeeId: string, officeId: string): Promise<boolean>;
}

export const EMPLOYEE_PROVIDER = Symbol('EMPLOYEE_PROVIDER');
