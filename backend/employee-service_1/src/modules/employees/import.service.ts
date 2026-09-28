import { parse } from 'csv-parse/sync';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { authServiceClient } from '../../integrations/auth-service.client';
import { emailService } from '../email/email.service';
import { writeAudit } from '../../utils/audit';
import type { AuthUser } from '../../utils/roles';
import { ROLE_NAMES } from '../../utils/roles';

export interface ParsedCsvRow {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail?: string;
  phone: string;
  dateOfJoining: string;
  jobTitle: string;
  department: string; // code or name
  role: string; // name
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  address?: string;
}

export type ImportRowStatus = 'VALID_NEW' | 'VALID_UPDATE' | 'DUPLICATE' | 'INVALID';

export interface ValidatedImportRow {
  rowNumber: number;
  data: ParsedCsvRow;
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

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let pwd = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    const byte = bytes[i] ?? 0;
    pwd += chars[byte % chars.length];
  }
  return pwd + 'A1!';
}

function mapRoleToAuthRole(roleName: string): string {
  const upper = roleName.toUpperCase().trim();
  if (upper === ROLE_NAMES.SUPER_ADMIN) return ROLE_NAMES.SUPER_ADMIN;
  if (upper === ROLE_NAMES.HR_ADMIN) return ROLE_NAMES.HR_ADMIN;
  return ROLE_NAMES.EMPLOYEE;
}

export function generateSampleCsv(): string {
  const headers = [
    'employeeCode',
    'firstName',
    'lastName',
    'email',
    'personalEmail',
    'phone',
    'dateOfJoining',
    'jobTitle',
    'department',
    'role',
    'dateOfBirth',
    'gender',
    'address',
  ];
  const sampleRows = [
    [
      'EMP-1001',
      'Arun',
      'Sharma',
      'arun.sharma@momo-hrms.example',
      'arun.personal@example.com',
      '+91 98765 43210',
      '2024-01-15',
      'Senior Software Engineer',
      'ENG',
      'EMPLOYEE',
      '1992-05-20',
      'MALE',
      '123 MG Road, Bengaluru',
    ],
    [
      'EMP-1002',
      'Priya',
      'Nair',
      'priya.nair@momo-hrms.example',
      'priya.personal@example.com',
      '+91 98765 43211',
      '2024-02-01',
      'HR Specialist',
      'HR',
      'HR_ADMIN',
      '1995-11-12',
      'FEMALE',
      '456 Indiranagar, Bengaluru',
    ],
  ];
  return [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
}

export async function validateCsvFile(fileBuffer: Buffer): Promise<ValidationSummary> {
  let rawRecords: Record<string, string>[];
  try {
    rawRecords = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid CSV file format';
    throw new Error(`CSV parsing failed: ${message}`);
  }

  // Pre-fetch all active departments and roles for fast in-memory resolution
  const [departments, roles, existingEmployees] = await Promise.all([
    prisma.department.findMany({ where: { status: 'ACTIVE' } }),
    prisma.role.findMany(),
    prisma.employee.findMany({
      select: { id: true, employeeCode: true, email: true, userId: true },
    }),
  ]);

  const deptMap = new Map<string, string>();
  for (const d of departments) {
    deptMap.set(d.code.toUpperCase(), d.id);
    deptMap.set(d.name.toLowerCase(), d.id);
  }

  const roleMap = new Map<string, string>();
  for (const r of roles) {
    roleMap.set(r.name.toUpperCase(), r.id);
  }

  const existingCodeMap = new Map<string, { id: string; email: string; userId: string | null }>();
  const existingEmailMap = new Map<string, { id: string; employeeCode: string; userId: string | null }>();
  for (const emp of existingEmployees) {
    existingCodeMap.set(emp.employeeCode.toUpperCase(), emp);
    existingEmailMap.set(emp.email.toLowerCase(), emp);
  }

  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  const rows: ValidatedImportRow[] = [];
  let validNewCount = 0;
  let validUpdateCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rawRecords.length; i++) {
    const raw = rawRecords[i];
    if (!raw) continue;
    const rowNumber = i + 2; // 1-indexed, header is row 1
    const errors: string[] = [];

    const employeeCode = (raw.employeeCode || raw.Code || raw['Employee Code'] || '').trim().toUpperCase();
    const firstName = (raw.firstName || raw['First Name'] || '').trim();
    const lastName = (raw.lastName || raw['Last Name'] || '').trim();
    const email = (raw.email || raw.Email || '').trim().toLowerCase();
    const personalEmail = (raw.personalEmail || raw['Personal Email'] || '').trim().toLowerCase() || undefined;
    const phone = (raw.phone || raw.Phone || '').trim();
    const dateOfJoining = (raw.dateOfJoining || raw['Date of Joining'] || '').trim();
    const jobTitle = (raw.jobTitle || raw['Job Title'] || '').trim();
    const departmentInput = (raw.department || raw.Department || '').trim();
    const roleInput = (raw.role || raw.Role || '').trim();
    const dateOfBirth = (raw.dateOfBirth || raw['Date of Birth'] || '').trim() || undefined;
    const genderInput = (raw.gender || raw.Gender || '').trim().toUpperCase();
    const address = (raw.address || raw.Address || '').trim() || undefined;

    // Field-level validations
    if (!employeeCode) {
      errors.push('Employee Code is required');
    } else if (!/^[A-Z0-9-]{2,30}$/.test(employeeCode)) {
      errors.push('Employee Code must be 2-30 alphanumeric characters or hyphens');
    }

    if (!firstName) errors.push('First Name is required');
    if (!lastName) errors.push('Last Name is required');

    if (!email) {
      errors.push('Official Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Invalid official email address');
    }

    if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      errors.push('Invalid personal email address');
    }

    if (!phone) {
      errors.push('Phone number is required');
    }

    if (!dateOfJoining) {
      errors.push('Date of Joining is required');
    } else if (isNaN(Date.parse(dateOfJoining))) {
      errors.push('Date of Joining must be a valid date (YYYY-MM-DD)');
    }

    if (dateOfBirth && isNaN(Date.parse(dateOfBirth))) {
      errors.push('Date of Birth must be a valid date (YYYY-MM-DD)');
    }

    let gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | undefined;
    if (genderInput) {
      if (['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(genderInput)) {
        gender = genderInput as 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
      } else {
        errors.push('Gender must be MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY');
      }
    }

    if (!jobTitle) errors.push('Job Title is required');

    // Department lookup
    let resolvedDepartmentId: string | undefined;
    if (!departmentInput) {
      errors.push('Department is required');
    } else {
      resolvedDepartmentId = deptMap.get(departmentInput.toUpperCase()) || deptMap.get(departmentInput.toLowerCase());
      if (!resolvedDepartmentId) {
        errors.push(`Active department not found matching "${departmentInput}"`);
      }
    }

    // Role lookup
    let resolvedRoleId: string | undefined;
    if (!roleInput) {
      errors.push('Role is required');
    } else {
      resolvedRoleId = roleMap.get(roleInput.toUpperCase());
      if (!resolvedRoleId) {
        errors.push(`Role not found matching "${roleInput}"`);
      }
    }

    // In-file duplicate checks
    let isDuplicateInFile = false;
    if (employeeCode) {
      if (seenCodes.has(employeeCode)) {
        errors.push(`Duplicate Employee Code "${employeeCode}" in uploaded file`);
        isDuplicateInFile = true;
      } else {
        seenCodes.add(employeeCode);
      }
    }

    if (email) {
      if (seenEmails.has(email)) {
        errors.push(`Duplicate official email "${email}" in uploaded file`);
        isDuplicateInFile = true;
      } else {
        seenEmails.add(email);
      }
    }

    // DB matching: 1. Code match -> Update; 2. Email match -> Conflict check; 3. Neither -> New
    let status: ImportRowStatus;
    let existingEmployeeId: string | undefined;

    if (isDuplicateInFile) {
      status = 'DUPLICATE';
    } else if (errors.length === 0) {
      const matchByCode = existingCodeMap.get(employeeCode);
      const matchByEmail = existingEmailMap.get(email);

      if (matchByCode) {
        // If code exists, check if email matches or belongs to someone else
        if (matchByEmail && matchByEmail.id !== matchByCode.id) {
          errors.push(`Email "${email}" is already used by employee "${matchByEmail.employeeCode}"`);
          status = 'INVALID';
        } else {
          status = 'VALID_UPDATE';
          existingEmployeeId = matchByCode.id;
        }
      } else if (matchByEmail) {
        // Code is new, but email is already registered to another employee
        errors.push(`Email "${email}" is already assigned to employee "${matchByEmail.employeeCode}"`);
        status = 'INVALID';
      } else {
        status = 'VALID_NEW';
      }
    } else {
      status = 'INVALID';
    }

    if (status === 'VALID_NEW') validNewCount++;
    else if (status === 'VALID_UPDATE') validUpdateCount++;
    else if (status === 'DUPLICATE') duplicateCount++;
    else invalidCount++;

    const parsedRow: ParsedCsvRow = {
      employeeCode,
      firstName,
      lastName,
      email,
      personalEmail,
      phone,
      dateOfJoining,
      jobTitle,
      department: departmentInput,
      role: roleInput,
      dateOfBirth,
      gender,
      address,
    };

    rows.push({
      rowNumber,
      data: parsedRow,
      status,
      errors,
      resolvedDepartmentId,
      resolvedRoleId,
      existingEmployeeId,
    });
  }

  return {
    totalRows: rawRecords.length,
    validNewCount,
    validUpdateCount,
    duplicateCount,
    invalidCount,
    rows,
  };
}

export async function executeImport(
  fileBuffer: Buffer,
  provisionAccounts: boolean,
  actor: AuthUser,
): Promise<ImportExecutionResult> {
  const summary = await validateCsvFile(fileBuffer);
  const results: ImportExecutionResult['results'] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of summary.rows) {
    if (row.status === 'INVALID' || row.status === 'DUPLICATE') {
      skipped++;
      results.push({
        rowNumber: row.rowNumber,
        employeeCode: row.data.employeeCode,
        email: row.data.email,
        status: 'SKIPPED',
        message: row.errors.join('; '),
      });
      continue;
    }

    try {
      if (row.status === 'VALID_NEW') {
        let createdAuthUserId: string | undefined;
        let tempPassword: string | undefined;

        let generatedUsername: string | undefined;
        let targetAuthRole: string = ROLE_NAMES.EMPLOYEE;

        // Provision auth account if requested and authServiceClient is active
        if (provisionAccounts && authServiceClient.isEnabled) {
          tempPassword = generateTemporaryPassword();
          targetAuthRole = mapRoleToAuthRole(row.data.role);

          try {
            const rawUsername = row.data.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_');
            generatedUsername = rawUsername.length >= 3 ? rawUsername : `emp_${rawUsername}`;

            const authUser = await authServiceClient.createUser(
              {
                email: row.data.email,
                username: generatedUsername,
                fullName: `${row.data.firstName} ${row.data.lastName}`,
                password: tempPassword,
                roles: [targetAuthRole],
              },
              actor.accessToken,
            );
            createdAuthUserId = authUser.id;
          } catch (authErr: unknown) {
            const authMsg = authErr instanceof Error ? authErr.message : 'Auth account provisioning failed';
            logger.warn({ err: authErr, email: row.data.email }, 'Auth provisioning failed during bulk import.');
            // Proceed without account link, or report error
          }
        }

        const employee = await prisma.employee.create({
          data: {
            employeeCode: row.data.employeeCode,
            firstName: row.data.firstName,
            lastName: row.data.lastName,
            email: row.data.email,
            personalEmail: row.data.personalEmail,
            phone: row.data.phone,
            dateOfJoining: new Date(row.data.dateOfJoining),
            dateOfBirth: row.data.dateOfBirth ? new Date(row.data.dateOfBirth) : undefined,
            gender: row.data.gender,
            address: row.data.address,
            jobTitle: row.data.jobTitle,
            departmentId: row.resolvedDepartmentId!,
            roleId: row.resolvedRoleId!,
            userId: createdAuthUserId,
            credentialsSentAt: createdAuthUserId && tempPassword ? new Date() : undefined,
          },
        });

        await writeAudit(prisma, {
          actorUserId: actor.id,
          action: 'EMPLOYEE_IMPORTED',
          entityType: 'EMPLOYEE',
          entityId: employee.id,
          metadata: { employeeCode: employee.employeeCode, mode: 'CREATE' },
        });

        // Dispatch credentials email if account created
        if (createdAuthUserId && tempPassword) {
          try {
            await emailService.sendCredentialEmail({
              toEmail: row.data.personalEmail || row.data.email,
              employeeName: `${row.data.firstName} ${row.data.lastName}`,
              officialEmail: row.data.email,
              username: generatedUsername || row.data.email,
              temporaryPassword: tempPassword,
              roleName: targetAuthRole,
            });
          } catch (mailErr) {
            logger.error({ mailErr, email: row.data.email }, 'Failed to dispatch email after import creation.');
          }
        }

        created++;
        results.push({
          rowNumber: row.rowNumber,
          employeeCode: row.data.employeeCode,
          email: row.data.email,
          status: 'CREATED',
        });
      } else if (row.status === 'VALID_UPDATE' && row.existingEmployeeId) {
        await prisma.employee.update({
          where: { id: row.existingEmployeeId },
          data: {
            firstName: row.data.firstName,
            lastName: row.data.lastName,
            personalEmail: row.data.personalEmail,
            phone: row.data.phone,
            dateOfJoining: new Date(row.data.dateOfJoining),
            dateOfBirth: row.data.dateOfBirth ? new Date(row.data.dateOfBirth) : undefined,
            gender: row.data.gender,
            address: row.data.address,
            jobTitle: row.data.jobTitle,
            departmentId: row.resolvedDepartmentId!,
            roleId: row.resolvedRoleId!,
          },
        });

        await writeAudit(prisma, {
          actorUserId: actor.id,
          action: 'EMPLOYEE_IMPORTED',
          entityType: 'EMPLOYEE',
          entityId: row.existingEmployeeId,
          metadata: { employeeCode: row.data.employeeCode, mode: 'UPDATE' },
        });

        updated++;
        results.push({
          rowNumber: row.rowNumber,
          employeeCode: row.data.employeeCode,
          email: row.data.email,
          status: 'UPDATED',
        });
      }
    } catch (err: unknown) {
      failed++;
      const message = err instanceof Error ? err.message : 'Database error';
      results.push({
        rowNumber: row.rowNumber,
        employeeCode: row.data.employeeCode,
        email: row.data.email,
        status: 'FAILED',
        message,
      });
    }
  }

  return {
    totalRows: summary.totalRows,
    created,
    updated,
    skipped,
    failed,
    results,
  };
}
