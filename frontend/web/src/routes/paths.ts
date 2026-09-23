import type { AuthUser } from '../types/auth';

export const PATHS = {
  login: '/login',
  resetPassword: '/reset-password',
  employee: '/employee',
  hr: '/hr',
  admin: '/admin',
  employees: '/admin/employees',
  addEmployee: '/admin/employees/new',
  employeeDetails: (id: string) => `/admin/employees/${id}`,
  employeeDetailsPattern: '/admin/employees/:id',
  editEmployee: (id: string) => `/admin/employees/${id}/edit`,
  editEmployeePattern: '/admin/employees/:id/edit',
  unauthorized: '/unauthorized',
} as const;

/** Where a given user belongs right now (the backend decides mustChangePassword + roles). */
export function homePathForUser(user: AuthUser | null): string {
  if (!user) return PATHS.login;
  if (user.mustChangePassword) return PATHS.resetPassword;
  switch (user.appRole) {
    case 'ADMIN':
      return PATHS.admin;
    case 'HR':
      return PATHS.hr;
    case 'EMPLOYEE':
      return PATHS.employee;
    default:
      return PATHS.unauthorized;
  }
}
