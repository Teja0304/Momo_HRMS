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
    dateOfBirth?: string;
    gender?: string;
    address?: string;
    officeLocations?: string;
    resolvedOfficeIds?: string[];
    resolvedOfficeNames?: string[];
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
