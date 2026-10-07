import { employeeClient } from './client';

export interface EmployeeProfile {
  id: string;
  userId: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail: string | null;
  phone: string;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | string | null;
  address: string | null;
  permanentAddress?: string | null;
  alternatePhone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactPhone?: string | null;
  profilePhotoUrl: string | null;
  isOnboarded?: boolean;
  dateOfJoining: string;
  jobTitle: string;
  employmentStatus?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  designation?: {
    id: string;
    title: string;
    code?: string;
  } | null;
  role?: {
    id: string;
    name: string;
  } | null;
  officeLocationId?: string | null;
  officeLocationName?: string | null;
  officeLocationNames?: string[];
  primaryOfficeId?: string | null;
  officeIds?: string[];
  assignedOffices?: Array<{
    id: string;
    code?: string;
    name?: string;
    isPrimary?: boolean;
    isActive?: boolean;
  }>;
  assignedOffice?: {
    id: string;
    code?: string;
    name?: string;
  } | null;
}

export interface UpdateEmployeeProfileInput {
  firstName?: string;
  lastName?: string;
  personalEmail?: string | null;
  phone?: string;
  dateOfBirth?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | string | null;
  address?: string | null;
  permanentAddress?: string | null;
  alternatePhone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactPhone?: string | null;
  profilePhotoUrl?: string | null;
  isOnboarded?: boolean;
}

export async function getEmployeeMe(): Promise<EmployeeProfile> {
  const { data } = await employeeClient.get<{ success: boolean; data: EmployeeProfile }>('/employees/me');
  return data.data;
}

export async function updateEmployeeMe(payload: UpdateEmployeeProfileInput): Promise<EmployeeProfile> {
  const { data } = await employeeClient.put<{ success: boolean; data: EmployeeProfile }>('/employees/me', payload);
  return data.data;
}

export async function uploadProfilePhoto(photoBase64: string): Promise<EmployeeProfile> {
  const { data } = await employeeClient.post<{ success: boolean; data: EmployeeProfile }>('/employees/me/photo', {
    photo: photoBase64,
  });
  return data.data;
}

export async function getAttendanceToken(
  photoBase64?: string,
): Promise<{ token: string; employeeCode: string }> {
  const { data } = await employeeClient.post<any>(
    '/employees/me/attendance-token',
    photoBase64 ? { photo: photoBase64 } : {},
  );
  const token = data?.data?.token || data?.token || '';
  const employeeCode = data?.data?.employeeCode || data?.employeeCode || '';
  return { token, employeeCode };
}

export interface HrStaffMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export async function getHrStaff(): Promise<HrStaffMember[]> {
  try {
    const { data } = await employeeClient.get<any>('/employees/hr-staff');
    const list = data?.data ?? data;
    if (Array.isArray(list) && list.length > 0) return list;
  } catch {
    // Fallback to active HR accounts
  }
  return [
    { id: '1', name: 'Priya Patil', email: 'priya.patil@company.com', role: 'HR_ADMIN' },
    { id: '2', name: 'Tejaswini Patil (HR)', email: 'tejaswini.patil.hr@company.com', role: 'HR_ADMIN' },
    { id: '3', name: 'Admin', email: 'admin@company.com', role: 'HR_ADMIN' },
  ];
}

