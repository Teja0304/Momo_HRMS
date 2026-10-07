import { api } from '../api/client';
import { EMPLOYEE_API_URL, COMPANY_DOMAIN, INTERN_DOMAIN } from '../config/env';
import type {
  ChangeEmployeeStatusPayload,
  CreateEmployeePayload,
  Department,
  Device,
  DeviceStatus,
  DeviceType,
  Employee,
  EmployeeListQuery,
  EmployeeProfileResponse,
  PageMeta,
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

  const response = await api.get<any>(`${EMPLOYEE_API_URL}/employees`, { params });
  
  // Backend returns { success: true, data: { items: [...], total, page, limit, totalPages } }
  const raw = response.data?.data ?? response.data;
  let items: Employee[] = [];
  let meta: PageMeta = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    total: 0,
    totalPages: 1,
  };

  if (Array.isArray(raw)) {
    items = raw;
    meta.total = raw.length;
    meta.totalPages = Math.ceil(raw.length / meta.limit) || 1;
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
    items = raw.items;
    meta = {
      page: Number(raw.page) || meta.page,
      limit: Number(raw.limit) || meta.limit,
      total: Number(raw.total) ?? items.length,
      totalPages: Number(raw.totalPages) || Math.ceil((Number(raw.total) || items.length) / meta.limit) || 1,
    };
  }

  if (response.data?.meta) {
    meta = { ...meta, ...response.data.meta };
  }

  return {
    data: items,
    meta,
  };
}

import axios from 'axios';

/**
 * Checks whether an official company email is already taken by querying both the employee directory
 * and the auth-service user accounts.
 */
export async function checkEmailAvailability(email: string): Promise<boolean> {
  const target = email.trim().toLowerCase();
  try {
    // 1. Check in employee-service
    const empRes = await fetchEmployees({ search: target });
    const existsInEmp = empRes.data.some((e) => e.email.toLowerCase() === target);
    if (existsInEmp) return false;

    // 2. Check in auth-service
    try {
      const authRes = await api.get<Array<{ email: string; username?: string }>>('/auth/users', {
        params: { search: target },
      });
      if (Array.isArray(authRes.data)) {
        const existsInAuth = authRes.data.some((u) => u.email.toLowerCase() === target);
        if (existsInAuth) return false;
      }
    } catch {
      // If auth-service query fails or is unauthenticated, continue with employee-service result
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Generates an available unique official email based on firstName and lastName.
 * For HR: name.surname.hr@domain, then name.surname.hr1@domain, name.surname.hr2@domain...
 * For normal Employee: name.surname@domain, then name.surname1@domain, name.surname2@domain...
 * For Intern: name.surname@domain, then name.surname1@domain... with intern domain.
 */
export async function generateUniqueEmail(
  firstName: string,
  lastName: string,
  options: { isHr?: boolean; isIntern?: boolean } = {}
): Promise<string> {
  const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'firstname';
  const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const baseName = l ? `${f}.${l}` : f;
  const domain = options.isIntern ? INTERN_DOMAIN : COMPANY_DOMAIN;

  let candidate: string = '';
  let counter = 0;

  while (counter <= 50) {
    if (options.isHr) {
      const suffix = counter === 0 ? '' : String(counter);
      candidate = `${baseName}.hr${suffix}@${domain}`;
    } else {
      const suffix = counter === 0 ? '' : String(counter);
      candidate = `${baseName}${suffix}@${domain}`;
    }

    const available = await checkEmailAvailability(candidate);
    if (available) {
      return candidate;
    }
    counter++;
  }

  return candidate;
}

/**
 * Creates an employee with automated conflict resolution.
 * If the auth-service or employee-service returns a 409 duplicate collision (e.g. AUTH_USER_CONFLICT
 * or EMPLOYEE_DUPLICATE), it automatically advances the numbered suffix according to the naming rule
 * (name.surname1, name.surname2... or name.surname.hr1, name.surname.hr2...) and retries.
 */
export async function createEmployeeWithRetry(
  payload: CreateEmployeePayload,
  options: { isHr?: boolean; isIntern?: boolean } = {},
  maxRetries = 10
): Promise<Employee> {
  let attempt = 0;
  let currentPayload = { ...payload };

  const f = payload.firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'firstname';
  const l = payload.lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const baseName = l ? `${f}.${l}` : f;
  const domain = options.isIntern ? INTERN_DOMAIN : COMPANY_DOMAIN;

  // Extract initial counter if email already has a number
  let currentCounter = 0;
  if (currentPayload.email) {
    const match = currentPayload.email.match(/(?:hr)?(\d+)@/);
    if (match && match[1]) {
      currentCounter = parseInt(match[1], 10);
    }
  }

  while (attempt < maxRetries) {
    try {
      return await createEmployee(currentPayload);
    } catch (err: unknown) {
      const isConflict =
        axios.isAxiosError(err) &&
        (err.response?.status === 409 ||
          err.response?.data?.error?.code === 'AUTH_USER_CONFLICT' ||
          err.response?.data?.error?.code === 'EMPLOYEE_DUPLICATE' ||
          err.response?.data?.error?.code === 'DUPLICATE_VALUE' ||
          (typeof err.response?.data?.error?.message === 'string' &&
            err.response.data.error.message.includes('already exists')));

      if (!isConflict || attempt === maxRetries - 1) {
        throw err;
      }

      attempt++;
      currentCounter++;
      const nextEmail = options.isHr
        ? `${baseName}.hr${currentCounter}@${domain}`
        : `${baseName}${currentCounter}@${domain}`;

      const nextCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

      currentPayload = {
        ...currentPayload,
        email: nextEmail,
        employeeCode: nextCode,
      };
    }
  }

  return await createEmployee(currentPayload);
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
 * Retrieves employee record linked to an Auth User UUID.
 * GET /api/v1/employees/by-user/:userId
 */
export async function fetchEmployeeByUserId(userId: string): Promise<Employee | null> {
  try {
    const response = await api.get<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees/by-user/${userId}`);
    return response.data?.data || null;
  } catch {
    return null;
  }
}

/**
 * Creates a new employee record.
 * POST /api/v1/employees
 * Strips any extra frontend-only keys so that backend z.strictObject validation succeeds.
 */
export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const cleanPayload: Record<string, unknown> = {
    employeeCode: payload.employeeCode.trim().toUpperCase(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email?.trim().toLowerCase(),
    phone: payload.phone.trim(),
    dateOfJoining: payload.dateOfJoining,
    jobTitle: payload.jobTitle.trim(),
    departmentId: payload.departmentId,
    roleId: payload.roleId,
  };

  if (payload.personalEmail?.trim()) {
    cleanPayload.personalEmail = payload.personalEmail.trim().toLowerCase();
  }
  if (payload.dateOfBirth) {
    cleanPayload.dateOfBirth = payload.dateOfBirth;
  }
  if (payload.gender) {
    cleanPayload.gender = payload.gender;
  }
  if (payload.address?.trim()) {
    cleanPayload.address = payload.address.trim();
  }
  if (payload.profilePhotoUrl?.trim()) {
    cleanPayload.profilePhotoUrl = payload.profilePhotoUrl.trim();
  }
  if (payload.userId) {
    cleanPayload.userId = payload.userId;
  }
  if (typeof payload.provisionAccount === 'boolean') {
    cleanPayload.provisionAccount = payload.provisionAccount;
  }
  if (payload.officeLocationId?.trim()) {
    cleanPayload.officeLocationId = payload.officeLocationId.trim();
    cleanPayload.primaryOfficeId = payload.officeLocationId.trim();
  }
  if (payload.officeLocationName?.trim()) {
    cleanPayload.officeLocationName = payload.officeLocationName.trim();
  }
  if (payload.primaryOfficeId?.trim()) {
    cleanPayload.primaryOfficeId = payload.primaryOfficeId.trim();
  }
  if (Array.isArray(payload.officeIds) && payload.officeIds.length > 0) {
    cleanPayload.officeIds = payload.officeIds;
  }

  const response = await api.post<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees`, cleanPayload);
  return response.data.data;
}

/**
 * Updates an employee's personal and job details.
 * PUT /api/v1/employees/:id
 * Strips any extra frontend-only keys so that backend z.strictObject validation succeeds.
 */
export async function updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<Employee> {
  const cleanPayload: Record<string, unknown> = {};

  if (payload.firstName !== undefined) cleanPayload.firstName = payload.firstName.trim();
  if (payload.lastName !== undefined) cleanPayload.lastName = payload.lastName.trim();
  if (payload.email !== undefined) cleanPayload.email = payload.email.trim().toLowerCase();
  if (payload.personalEmail !== undefined) {
    cleanPayload.personalEmail = payload.personalEmail ? payload.personalEmail.trim().toLowerCase() : null;
  }
  if (payload.phone !== undefined) cleanPayload.phone = payload.phone.trim();
  if (payload.dateOfBirth !== undefined) cleanPayload.dateOfBirth = payload.dateOfBirth;
  if (payload.gender !== undefined) cleanPayload.gender = payload.gender;
  if (payload.address !== undefined) cleanPayload.address = payload.address ? payload.address.trim() : null;
  if (payload.profilePhotoUrl !== undefined) {
    cleanPayload.profilePhotoUrl = payload.profilePhotoUrl ? payload.profilePhotoUrl.trim() : null;
  }
  if (payload.jobTitle !== undefined) cleanPayload.jobTitle = payload.jobTitle.trim();
  if (payload.departmentId !== undefined) cleanPayload.departmentId = payload.departmentId;
  if (payload.dateOfJoining !== undefined) cleanPayload.dateOfJoining = payload.dateOfJoining;
  if (payload.officeLocationId !== undefined) {
    cleanPayload.officeLocationId = payload.officeLocationId ? payload.officeLocationId.trim() : '';
  }
  if (payload.officeLocationName !== undefined) {
    cleanPayload.officeLocationName = payload.officeLocationName ? payload.officeLocationName.trim() : '';
  }
  if (payload.primaryOfficeId !== undefined) {
    cleanPayload.primaryOfficeId = payload.primaryOfficeId ? payload.primaryOfficeId.trim() : '';
  }
  if (Array.isArray(payload.officeIds)) {
    cleanPayload.officeIds = payload.officeIds;
  }

  const response = await api.put<ApiResponse<Employee>>(`${EMPLOYEE_API_URL}/employees/${id}`, cleanPayload);
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
  const response = await api.get<any>(`${EMPLOYEE_API_URL}/departments`, {
    params: { limit: 100, status: 'ACTIVE' },
  });
  const raw = response.data?.data ?? response.data;
  return Array.isArray(raw) ? raw : (raw?.items || []);
}

/**
 * Retrieves all organization roles for dropdown selection.
 * GET /api/v1/roles
 */
export async function fetchRoles(): Promise<Role[]> {
  const response = await api.get<any>(`${EMPLOYEE_API_URL}/roles`);
  const raw = response.data?.data ?? response.data;
  return Array.isArray(raw) ? raw : (raw?.items || []);
}

/**
 * Registers an authorized hardware device for an employee.
 * POST /api/v1/employees/:id/devices
 */
export async function registerEmployeeDevice(
  employeeId: string,
  payload: { deviceName: string; deviceType: DeviceType; deviceIdentifier: string },
): Promise<Device> {
  const response = await api.post<ApiResponse<Device>>(
    `${EMPLOYEE_API_URL}/employees/${employeeId}/devices`,
    payload,
  );
  return response.data.data;
}

/**
 * Updates a registered device's status (ACTIVE, INACTIVE, REVOKED).
 * PATCH /api/v1/devices/:id/status
 */
export async function changeDeviceStatus(
  deviceId: string,
  status: DeviceStatus,
): Promise<Device> {
  const response = await api.patch<ApiResponse<Device>>(
    `${EMPLOYEE_API_URL}/devices/${deviceId}/status`,
    { status },
  );
  return response.data.data;
}

/**
 * Resends temporary credentials or resets password and notifies employee.
 * POST /api/v1/employees/:id/resend-credentials
 * Synchronizes the generated temporary password to auth-service so that login works immediately.
 */
export async function resendCredentials(
  id: string,
): Promise<{ success: boolean; message: string; deliveredTo?: string }> {
  const response = await api.post<ApiResponse<{ success: boolean; message: string; deliveredTo?: string; temporaryPassword?: string }>>(
    `${EMPLOYEE_API_URL}/employees/${id}/resend-credentials`,
  );
  const data = response.data.data;

  // Synchronize the newly generated temporary password to auth-service!
  if (data?.temporaryPassword) {
    try {
      const emp = await fetchEmployeeById(id);
      let userId = emp.userId;
      if (!userId) {
        // Query auth-service by email to locate user
        const usersRes = await api.get<Array<{ id: string; email: string }>>('/auth/users', {
          params: { search: emp.email },
        });
        const users = Array.isArray(usersRes.data) ? usersRes.data : [];
        const match = users.find((u) => u.email.toLowerCase() === emp.email.toLowerCase());
        userId = match?.id;
      }

      if (userId) {
        await api.post(`/auth/users/${userId}/reset-password`, {
          temporaryPassword: data.temporaryPassword,
        });
      } else {
        // If user didn't exist in auth-service yet, provision them now with this password
        const username = emp.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_');
        const role = emp.role?.name === 'HR_ADMIN' || emp.email.includes('.hr@') ? 'HR_ADMIN' : 'EMPLOYEE';
        await api.post('/auth/users', {
          username,
          email: emp.email,
          fullName: `${emp.firstName} ${emp.lastName}`.trim(),
          password: data.temporaryPassword,
          roles: [role],
          mustChangePassword: true,
        });
      }
    } catch (syncErr) {
      console.warn('Could not sync temporary password to auth-service:', syncErr);
    }
  }

  return data;
}

/**
 * Downloads a sample CSV import template.
 * GET /api/v1/employees/import/template
 */
export async function downloadImportTemplate(): Promise<Blob> {
  const response = await api.get(`${EMPLOYEE_API_URL}/employees/import/template`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Validates a CSV file for employee bulk import without persisting changes.
 * POST /api/v1/employees/import/validate
 */
export async function validateImportFile(file: File): Promise<import('../types/employee').ValidationSummary> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<import('../types/employee').ValidationSummary>>(
    `${EMPLOYEE_API_URL}/employees/import/validate`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.data;
}

/**
 * Executes employee bulk import.
 * POST /api/v1/employees/import
 */
export async function executeImportFile(
  file: File,
  provisionAccounts: boolean = true,
): Promise<import('../types/employee').ImportExecutionResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('provisionAccounts', String(provisionAccounts));
  const response = await api.post<ApiResponse<import('../types/employee').ImportExecutionResult>>(
    `${EMPLOYEE_API_URL}/employees/import`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.data;
}


