import { api } from '../api/client';
import { EMPLOYEE_API_URL } from '../config/env';
import type {
  ChangeEmployeeStatusPayload,
  CreateEmployeePayload,
  Department,
  Employee,
  EmployeeListQuery,
  EmployeeProfileResponse,
  PaginatedResponse,
  Role,
  UpdateEmployeePayload,
} from '../types/employee';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Lists employees with server-side pagination, search and filtering.
 * GET /api/v1/employees?page=1&limit=20&search=...&departmentId=...&roleId=...&status=...
 */
export async function fetchEmployees(query: EmployeeListQuery = {}): Promise<PaginatedResponse<Employee>> {
  const params: Record<string, string | number> = {};
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = query.limit;
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.departmentId) params.departmentId = query.departmentId;
  if (query.roleId) params.roleId = query.roleId;
  if (query.status) params.status = query.status;

  const response = await api.get<ApiResponse<Employee[]>>(`${EMPLOYEE_API_URL}/employees`, { params });
  return {
    data: response.data.data,
    meta: response.data.meta ?? {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      total: response.data.data.length,
      totalPages: 1,
    },
  };
}

/**
 * Retrieves basic employee details.
 * GET /api/v1/employees/:id
 */
export async function fetchEmployeeById(id: string): Promise<Employee> {
  const response = await api.get<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees/${id}`);
  return response.data.data;
}

/**
 * Retrieves comprehensive employee profile including devices and face-template reference.
 * GET /api/v1/employees/:id/profile
 */
export async function fetchEmployeeProfile(id: string): Promise<EmployeeProfileResponse> {
  const response = await api.get<ApiResponse<EmployeeProfileResponse>>(`${EMPLOYEE_API_URL}/employees/${id}/profile`);
  return response.data.data;
}

/**
 * Creates a new employee record.
 * POST /api/v1/employees
 */
export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const response = await api.post<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees`, payload);
  return response.data.data;
}

/**
 * Updates an employee's personal and job details.
 * PUT /api/v1/employees/:id
 */
export async function updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<Employee> {
  const response = await api.put<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees/${id}`, payload);
  return response.data.data;
}

/**
 * Updates an employee's organizational role.
 * PATCH /api/v1/employees/:id/role
 */
export async function updateEmployeeRole(id: string, roleId: string): Promise<Employee> {
  const response = await api.patch<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees/${id}/role`, { roleId });
  return response.data.data;
}

/**
 * Activates or deactivates an employee (changes employment status).
 * PATCH /api/v1/employees/:id/status
 */
export async function changeEmployeeStatus(
  id: string,
  payload: ChangeEmployeeStatusPayload,
): Promise<Employee> {
  const response = await api.patch<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees/${id}/status`, payload);
  return response.data.data;
}

/**
 * Retrieves all active departments for dropdown selection.
 * GET /api/v1/departments?limit=100&status=ACTIVE
 */
export async function fetchActiveDepartments(): Promise<Department[]> {
  const response = await api.get<ApiResponse<Department[]>>(`${EMPLOYEE_API_URL}/departments`, {
    params: { limit: 100, status: 'ACTIVE' },
  });
  return response.data.data;
}

/**
 * Retrieves all organization roles for dropdown selection.
 * GET /api/v1/roles
 */
export async function fetchRoles(): Promise<Role[]> {
  const response = await api.get<ApiResponse<Role[]>>(`${EMPLOYEE_API_URL}/roles`);
  return response.data.data;
}
