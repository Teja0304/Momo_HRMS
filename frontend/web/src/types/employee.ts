export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';

export type EmploymentType = 'EMPLOYEE' | 'INTERN';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export type DeviceType = 'ANDROID' | 'IOS' | 'WEB' | 'OTHER';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export interface DepartmentRef {
  id: string;
  name: string;
  code: string;
  status: string;
}

export interface RoleRef {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  employeeCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  employeeCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail?: string | null;
  phone: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  profilePhotoUrl?: string | null;
  dateOfJoining: string;
  jobTitle: string;
  department: DepartmentRef;
  role: RoleRef;
  officeLocationId?: string | null;
  officeLocationName?: string | null;
  primaryOfficeId?: string | null;
  assignedOffice?: { id: string; name: string; code?: string } | null;
  assignedOffices?: Array<{ id: string; name: string; code?: string; isPrimary?: boolean; isActive?: boolean }>;
  officeIds?: string[];
  officeLocationNames?: string[];
  assignments?: Array<{ id: string; officeId: string; isPrimary?: boolean; isActive?: boolean; office?: { id: string; name: string; code?: string } }>;
  employmentType?: EmploymentType;
  status: EmploymentStatus;
  hasAccount?: boolean;
  credentialsSentAt?: string | null;
  credentialDelivery?: {
    delivered: boolean;
    mode: 'smtp' | 'console' | 'failed';
    deliveredTo: string;
    message: string;
  };
  createdAt: string;
  updatedAt: string;
  userId?: string | null;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  deactivatedBy?: string | null;
}

export interface Device {
  id: string;
  employeeId?: string;
  deviceName: string;
  deviceType: DeviceType;
  deviceIdentifier?: string;
  status: DeviceStatus;
  registeredAt?: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
}

export interface FaceTemplateStatus {
  hasActiveReference: boolean;
  status: string | null;
}

export interface EmployeeProfileResponse {
  employee: Employee;
  devices: Device[];
  faceTemplate: FaceTemplateStatus;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface EmployeeListQuery {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  roleId?: string;
  status?: EmploymentStatus;
}

export interface CreateEmployeePayload {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string;
  personalEmail: string;
  employmentType?: EmploymentType;
  phone: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  profilePhotoUrl?: string;
  dateOfJoining: string;
  jobTitle: string;
  departmentId: string;
  roleId: string;
  officeLocationId?: string | null;
  officeLocationName?: string | null;
  primaryOfficeId?: string | null;
  officeIds?: string[];
  userId?: string;
  provisionAccount?: boolean;
}

export interface UpdateEmployeePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  personalEmail?: string | null;
  employmentType?: EmploymentType;
  phone?: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  profilePhotoUrl?: string | null;
  dateOfJoining?: string;
  jobTitle?: string;
  departmentId?: string;
  officeLocationId?: string | null;
  officeLocationName?: string | null;
  primaryOfficeId?: string | null;
  officeIds?: string[];
}

export interface ChangeEmployeeStatusPayload {
  status: EmploymentStatus;
  reason?: string;
}

export type ImportRowStatus = 'VALID_NEW' | 'VALID_UPDATE' | 'DUPLICATE' | 'INVALID';

export interface ValidatedImportRow {
  rowNumber: number;
  data: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    personalEmail?: string;
    phone: string;
    dateOfJoining: string;
    jobTitle: string;
    department: string;
    role: string;
    officeLocations?: string;
    resolvedOfficeIds?: string[];
    resolvedOfficeNames?: string[];
    dateOfBirth?: string;
    gender?: Gender;
    address?: string;
  };
  status: ImportRowStatus;
  errors: string[];
  resolvedDepartmentId?: string;
  resolvedRoleId?: string;
  existingEmployeeId?: string;
}

export interface ValidationSummary {
  totalRows: number;
  validNewCount: number;
  validUpdateCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: ValidatedImportRow[];
}

export interface ImportExecutionResult {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  results: {
    rowNumber: number;
    employeeCode: string;
    email: string;
    status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
    message?: string;
  }[];
}
