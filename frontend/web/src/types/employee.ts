export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';

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
  phone: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  profilePhotoUrl?: string | null;
  dateOfJoining: string;
  jobTitle: string;
  department: DepartmentRef;
  role: RoleRef;
  status: EmploymentStatus;
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
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  profilePhotoUrl?: string;
  dateOfJoining: string;
  jobTitle: string;
  departmentId: string;
  roleId: string;
  userId?: string;
}

export interface UpdateEmployeePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  profilePhotoUrl?: string | null;
  jobTitle?: string;
  departmentId?: string;
}

export interface ChangeEmployeeStatusPayload {
  status: EmploymentStatus;
  reason?: string;
}
