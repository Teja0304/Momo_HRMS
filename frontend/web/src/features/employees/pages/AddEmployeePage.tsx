import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import PersonIcon from '@mui/icons-material/Person';
import SendIcon from '@mui/icons-material/Send';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import ComputerIcon from '@mui/icons-material/Computer';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { LoadingIndicator } from '../../../components/LoadingIndicator';
import { PATHS } from '../../../routes/paths';
import { getErrorMessage } from '../../../utils/errors';
import { COMPANY_DOMAIN, INTERN_DOMAIN } from '../../../config/env';
import {
  createEmployeeWithRetry,
  fetchActiveDepartments,
  fetchRoles,
  generateUniqueEmail,
  resendCredentials,
} from '../../../services/employeeService';
import { fetchOffices } from '../../geofence/services/geofenceService';
import type { Office } from '../../geofence/types/geofence';
import type { CreateEmployeePayload, Department, Employee, EmploymentType, Role } from '../../../types/employee';

type FormRole = 'EMPLOYEE' | 'HR' | 'ADMIN';

export default function AddEmployeePage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('EMPLOYEE');
  const [selectedRole, setSelectedRole] = useState<FormRole>('EMPLOYEE');
  const [personalEmail, setPersonalEmail] = useState('');
  const [autoSendCredentials, setAutoSendCredentials] = useState(true);

  // Dynamic Async Unique Email Resolution
  const [resolvedEmail, setResolvedEmail] = useState<string>('');
  const [resolvedHrEmail, setResolvedHrEmail] = useState<string>('');
  const [resolvedAttendanceEmail, setResolvedAttendanceEmail] = useState<string>('');
  const [resolvingEmails, setResolvingEmails] = useState(false);

  // Validation
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Post-Creation State
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);
  const [createdDualAccounts, setCreatedDualAccounts] = useState<{
    hrAccount: Employee;
    attendanceAccount: Employee;
  } | null>(null);
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchActiveDepartments(), fetchRoles(), fetchOffices()])
      .then(([deptsData, rolesData, officesData]) => {
        if (mounted) {
          setDepartments(deptsData);
          setRoles(rolesData);
          setOffices(officesData);
          if (officesData.length > 0) {
            const activeOffice = officesData.find((o) => o.isActive) || officesData[0];
            setSelectedOfficeIds([activeOffice.id]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load setup options:', err);
        setServerError(getErrorMessage(err, 'Unable to load roles, departments, or office locations.'));
      })
      .finally(() => {
        if (mounted) setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Compute live available unique emails with debounce across both employee and auth services
  useEffect(() => {
    let active = true;
    const trimmed = fullName.trim();
    if (!trimmed) {
      setResolvedEmail('');
      setResolvedHrEmail('');
      setResolvedAttendanceEmail('');
      return;
    }

    const parts = trimmed.split(/\s+/);
    const first = parts[0];
    const last = parts.slice(1).join(' ');

    setResolvingEmails(true);
    const timer = setTimeout(async () => {
      try {
        const [empEmail, hrEmail, hrAttEmail] = await Promise.all([
          generateUniqueEmail(first, last, { isHr: false, isIntern: employmentType === 'INTERN' }),
          generateUniqueEmail(first, last, { isHr: true }),
          generateUniqueEmail(first, last, { isHr: false, isIntern: false }),
        ]);
        if (active) {
          setResolvedEmail(empEmail);
          setResolvedHrEmail(hrEmail);
          setResolvedAttendanceEmail(hrAttEmail);
        }
      } catch {
        // fallback to standard formats
      } finally {
        if (active) setResolvingEmails(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fullName, employmentType]);

  // Synchronous fallback templates while async resolves
  const fallbackOfficialEmail = useMemo(() => {
    const trimmed = fullName.trim();
    const domain = employmentType === 'INTERN' ? INTERN_DOMAIN : COMPANY_DOMAIN;
    if (!trimmed) return `firstname.lastname@${domain}`;
    const parts = trimmed.split(/\s+/);
    const first = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'firstname';
    const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const base = last ? `${first}.${last}` : first;
    return `${base}@${domain}`;
  }, [fullName, employmentType]);

  const fallbackHrEmail = useMemo(() => {
    const trimmed = fullName.trim();
    if (!trimmed) return `firstname.lastname.hr@${COMPANY_DOMAIN}`;
    const parts = trimmed.split(/\s+/);
    const first = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'firstname';
    const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const base = last ? `${first}.${last}` : first;
    return `${base}.hr@${COMPANY_DOMAIN}`;
  }, [fullName]);

  const fallbackAttendanceEmail = useMemo(() => {
    const trimmed = fullName.trim();
    if (!trimmed) return `firstname.lastname@${COMPANY_DOMAIN}`;
    const parts = trimmed.split(/\s+/);
    const first = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'firstname';
    const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const base = last ? `${first}.${last}` : first;
    return `${base}@${COMPANY_DOMAIN}`;
  }, [fullName]);

  const validate = (): boolean => {
    let valid = true;
    setFullNameError(null);
    setEmailError(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFullNameError('Full Name is required');
      valid = false;
    } else {
      const parts = trimmedName.split(/\s+/);
      if (parts.length < 2) {
        setFullNameError('Please enter both first and last name (e.g. Rohit Verma)');
        valid = false;
      }
    }

    const trimmedEmail = personalEmail.trim();
    if (!trimmedEmail) {
      setEmailError('Valid personal email address is required for credential delivery');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address (e.g. employee@gmail.com)');
      valid = false;
    }

    return valid;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    try {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || 'Employee';

      const hrRole = roles.find((r) => r.name.toUpperCase().includes('HR')) || roles[0];
      const employeeRole = roles.find((r) => r.name.toUpperCase() === 'EMPLOYEE') || roles[0];
      const adminRole =
        roles.find((r) => {
          const nameUpper = r.name.toUpperCase();
          return nameUpper.includes('SUPER') || nameUpper.includes('ADMIN');
        }) || roles[0];

      // Match department: prefer HR department if HR role
      const hrDepartment =
        departments.find((d) => d.status === 'ACTIVE' && (d.code === 'HR' || d.name.toUpperCase().includes('HUMAN'))) ||
        departments.find((d) => d.status === 'ACTIVE') ||
        departments[0];

      const defaultDepartment = departments.find((d) => d.status === 'ACTIVE') || departments[0];

      if (selectedRole === 'HR') {
        // Dual-Account Creation Flow for HR
        const finalHrEmail = resolvedHrEmail || (await generateUniqueEmail(firstName, lastName, { isHr: true }));
        const finalAttendanceEmail =
          resolvedAttendanceEmail || (await generateUniqueEmail(firstName, lastName, { isHr: false, isIntern: false }));

        const code1 = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
        let code2 = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
        if (code2 === code1) {
          code2 = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const selectedOffices = offices.filter((o) => selectedOfficeIds.includes(o.id));
        const primaryOffice = selectedOffices[0];
        const assignedOfficeId = primaryOffice?.id || selectedOfficeIds[0] || undefined;
        const assignedOfficeName = selectedOffices.map((o) => (o.name ? `${o.name} (${o.code})` : o.code)).join(', ') || undefined;
        const assignedOfficeIds = selectedOffices.flatMap((o) => [o.id, o.code]).filter(Boolean) as string[];

        // Account 1: HR Functional Account (for HR Web Portal)
        const hrPayload: CreateEmployeePayload = {
          employeeCode: code1,
          firstName,
          lastName,
          email: finalHrEmail,
          personalEmail: personalEmail.trim().toLowerCase(),
          phone: '+91 90000 00000',
          dateOfJoining: new Date().toISOString().slice(0, 10),
          jobTitle: 'HR Specialist',
          departmentId: hrDepartment.id,
          roleId: hrRole.id,
          provisionAccount: autoSendCredentials,
          officeLocationId: assignedOfficeId,
          officeLocationName: assignedOfficeName,
          primaryOfficeId: assignedOfficeId,
          officeIds: assignedOfficeIds,
        };
        const createdHr = await createEmployeeWithRetry(hrPayload, { isHr: true });

        // Account 2: Employee Attendance Account (for Mobile App Attendance)
        const attendancePayload: CreateEmployeePayload = {
          employeeCode: code2,
          firstName,
          lastName,
          email: finalAttendanceEmail,
          personalEmail: personalEmail.trim().toLowerCase(),
          phone: '+91 90000 00000',
          dateOfJoining: new Date().toISOString().slice(0, 10),
          jobTitle: 'HR Specialist (Attendance)',
          departmentId: hrDepartment.id,
          roleId: employeeRole.id,
          provisionAccount: autoSendCredentials,
          officeLocationId: assignedOfficeId,
          officeLocationName: assignedOfficeName,
          primaryOfficeId: assignedOfficeId,
          officeIds: assignedOfficeIds,
        };
        const createdAttendance = await createEmployeeWithRetry(attendancePayload, { isHr: false, isIntern: false });

        setCreatedDualAccounts({
          hrAccount: createdHr,
          attendanceAccount: createdAttendance,
        });
        setCreatedEmployee(createdHr);
        setFeedback(
          autoSendCredentials
            ? `HR Dual Accounts created! Credentials dispatched to ${personalEmail.trim()}.`
            : `HR Dual Accounts created successfully.`
        );
      } else {
        // Standard Single Account Creation Flow (Employee or Admin)
        const matchedRole = selectedRole === 'ADMIN' ? adminRole : employeeRole;
        const finalEmail =
          resolvedEmail ||
          (await generateUniqueEmail(firstName, lastName, {
            isHr: false,
            isIntern: employmentType === 'INTERN',
          }));

        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const employeeCode = `EMP-${uniqueSuffix}`;
        const jobTitle =
          selectedRole === 'ADMIN'
            ? 'System Administrator'
            : employmentType === 'INTERN'
            ? 'Intern Trainee'
            : 'Associate';

        const selectedOffices = offices.filter((o) => selectedOfficeIds.includes(o.id));
        const primaryOffice = selectedOffices[0];
        const assignedOfficeId = primaryOffice?.id || selectedOfficeIds[0] || undefined;
        const assignedOfficeName = selectedOffices.map((o) => (o.name ? `${o.name} (${o.code})` : o.code)).join(', ') || undefined;
        const assignedOfficeIds = selectedOffices.flatMap((o) => [o.id, o.code]).filter(Boolean) as string[];

        const payload: CreateEmployeePayload = {
          employeeCode,
          firstName,
          lastName,
          email: finalEmail,
          personalEmail: personalEmail.trim().toLowerCase(),
          phone: '+91 90000 00000',
          dateOfJoining: new Date().toISOString().slice(0, 10),
          jobTitle,
          departmentId: defaultDepartment.id,
          roleId: matchedRole.id,
          provisionAccount: autoSendCredentials,
          officeLocationId: assignedOfficeId,
          officeLocationName: assignedOfficeName,
          primaryOfficeId: assignedOfficeId,
          officeIds: assignedOfficeIds,
        };

        const created = await createEmployeeWithRetry(payload, {
          isHr: false,
          isIntern: employmentType === 'INTERN',
        });
        setCreatedEmployee(created);
        setCreatedDualAccounts(null);
        setFeedback(
          created.credentialDelivery?.message ||
          (created.credentialDelivery?.delivered
            ? `Credentials dispatched to ${personalEmail.trim()}`
            : `Employee profile created successfully.`)
        );
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to create employee. Please try again.');
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCredentials = async () => {
    const target = createdDualAccounts?.hrAccount || createdEmployee;
    if (!target) return;
    setResending(true);
    try {
      const res = await resendCredentials(target.id);
      setFeedback(res.message || `Credentials re-sent to ${target.personalEmail || target.email}`);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to re-send credentials.');
      setServerError(msg);
    } finally {
      setResending(false);
    }
  };

  const handleCreateAnother = () => {
    setCreatedEmployee(null);
    setCreatedDualAccounts(null);
    setFullName('');
    setPersonalEmail('');
    setEmploymentType('EMPLOYEE');
    setSelectedRole('EMPLOYEE');
    setServerError(null);
    setResolvedEmail('');
    setResolvedHrEmail('');
    setResolvedAttendanceEmail('');
  };

  if (loadingInitial) {
    return (
      <DashboardLayout title="Create New Employee" subtitle="Loading setup options...">
        <LoadingIndicator message="Preparing employee creation..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Create New Employee"
      subtitle="Register an employee profile, automatically generate company credentials, and deliver them to their personal email."
    >
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          color="inherit"
          onClick={() => navigate(PATHS.employees)}
        >
          Back to Employee Directory
        </Button>
      </Box>

      {/* Post-Creation Dual Accounts Confirmation Screen for HR */}
      {createdDualAccounts ? (
        <Card variant="outlined" sx={{ maxWidth: 760, mx: 'auto', p: { xs: 2, sm: 3 }, borderColor: 'success.main', borderWidth: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 44 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  HR CREATED SUCCESSFULLY ✓
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Two separate company accounts have been created for <strong>{createdDualAccounts.hrAccount.firstName} {createdDualAccounts.hrAccount.lastName}</strong>.
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mb: 3 }}>
              {/* Account 1 Card */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'secondary.light', bgcolor: 'rgba(156, 39, 176, 0.03)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <ComputerIcon color="secondary" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.dark' }}>
                    1. HR Functional Account
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Login Email:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'secondary.main' }}>
                      {createdDualAccounts.hrAccount.email}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Employee Code:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {createdDualAccounts.hrAccount.employeeCode}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Purpose:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      HR Web Portal (Directory, Working Hours, Analytics)
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Assigned Role:</Typography>
                    <Chip label="HR_ADMIN" size="small" color="secondary" sx={{ fontWeight: 600, width: 'fit-content' }} />
                  </Box>
                </Box>
              </Paper>

              {/* Account 2 Card */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'primary.light', bgcolor: 'rgba(25, 118, 210, 0.03)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <SmartphoneIcon color="primary" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.dark' }}>
                    2. Employee Attendance Account
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Login Email:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'primary.main' }}>
                      {createdDualAccounts.attendanceAccount.email}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Employee Code:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {createdDualAccounts.attendanceAccount.employeeCode}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Purpose:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Employee Check-in / Check-out (Mobile App)
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Assigned Role:</Typography>
                    <Chip label="EMPLOYEE" size="small" color="primary" sx={{ fontWeight: 600, width: 'fit-content' }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Assigned Workplaces:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {(createdDualAccounts.attendanceAccount.assignedOffices || []).length > 0 ? (
                        createdDualAccounts.attendanceAccount.assignedOffices!.map((o) => (
                          <Chip
                            key={o.id}
                            icon={<LocationOnIcon fontSize="small" />}
                            label={`${o.name} (${o.code})${o.isPrimary ? ' • Primary' : ''}`}
                            size="small"
                            color={o.isPrimary ? 'primary' : 'default'}
                            sx={{ fontWeight: 600 }}
                          />
                        ))
                      ) : (
                        <Chip
                          icon={<LocationOnIcon fontSize="small" />}
                          label={createdDualAccounts.attendanceAccount.officeLocationName || 'Headquarters'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              Official login credentials for both accounts have been generated and dispatched to the employee's registered personal email: <strong>{createdDualAccounts.hrAccount.personalEmail}</strong>.
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                disabled={resending}
                onClick={handleResendCredentials}
              >
                {resending ? 'Sending...' : 'Resend Credentials'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleCreateAnother}
              >
                Create Another Employee
              </Button>
              <Button
                variant="contained"
                startIcon={<VisibilityIcon />}
                onClick={() => navigate(PATHS.employeeDetails(createdDualAccounts.hrAccount.id))}
              >
                View HR Profile
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : createdEmployee ? (
        /* Success Card for Standard Employee / Admin */
        <Card variant="outlined" sx={{ maxWidth: 720, mx: 'auto', p: 2, borderColor: 'success.main', borderWidth: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 44 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  User Account Created Successfully!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The employee profile has been saved and credentials have been dispatched.
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'background.default', p: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Full Name:</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {createdEmployee.firstName} {createdEmployee.lastName}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Employee Code:</Typography>
                <Chip label={createdEmployee.employeeCode} size="small" sx={{ fontWeight: 600 }} />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Employment Type:</Typography>
                <Chip
                  label={createdEmployee.employmentType || employmentType}
                  color={employmentType === 'INTERN' ? 'secondary' : 'primary'}
                  size="small"
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Role & Access:</Typography>
                <Chip
                  icon={selectedRole === 'EMPLOYEE' ? <SmartphoneIcon fontSize="small" /> : <ComputerIcon fontSize="small" />}
                  label={
                    selectedRole === 'ADMIN'
                      ? 'Admin (Web Portal)'
                      : 'Employee (Mobile App Only)'
                  }
                  color={selectedRole === 'EMPLOYEE' ? 'primary' : 'secondary'}
                  size="small"
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Official Company Email (Login ID):</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'primary.main' }}>
                  {createdEmployee.email}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Personal Email (Recipient):</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {createdEmployee.personalEmail}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Assigned Workplaces:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(createdEmployee.assignedOffices || []).length > 0 ? (
                    createdEmployee.assignedOffices!.map((o) => (
                      <Chip
                        key={o.id}
                        icon={<LocationOnIcon fontSize="small" />}
                        label={`${o.name} (${o.code})${o.isPrimary ? ' • Primary' : ''}`}
                        color={o.isPrimary ? 'primary' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    ))
                  ) : (
                    <Chip
                      icon={<LocationOnIcon fontSize="small" />}
                      label={createdEmployee.officeLocationName || 'Headquarters'}
                      color="default"
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Password Status:</Typography>
                <Chip label="Generated Temporary Password (Reset on First Login)" color="info" size="small" variant="outlined" />
              </Box>
            </Box>

            {createdEmployee.credentialDelivery?.delivered ? (
              <Alert severity="success" sx={{ mt: 3, mb: 3 }}>
                {createdEmployee.credentialDelivery.message || `An official credential email with the login ID, temporary password, and platform login link has been sent to ${createdEmployee.personalEmail}.`}
              </Alert>
            ) : (
              <Alert severity={createdEmployee.credentialDelivery?.mode === 'failed' ? 'warning' : 'info'} sx={{ mt: 3, mb: 3 }}>
                {createdEmployee.credentialDelivery?.message || `Employee profile created. Credential delivery status: ${createdEmployee.credentialDelivery?.mode || 'saved'}.`}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                disabled={resending}
                onClick={handleResendCredentials}
              >
                {resending ? 'Sending...' : 'Send Credentials Again'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleCreateAnother}
              >
                Create Another Employee
              </Button>
              <Button
                variant="contained"
                startIcon={<VisibilityIcon />}
                onClick={() => navigate(PATHS.employeeDetails(createdEmployee.id))}
              >
                View Employee Profile
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        /* Creation Form */
        <Paper variant="outlined" sx={{ maxWidth: 680, mx: 'auto', p: { xs: 3, sm: 4.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <PersonAddAlt1Icon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              New Employee Setup
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Register new staff member. Official company email and a temporary secure password will be generated automatically.
          </Typography>

          {serverError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleCreate} noValidate>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Field 1: Full Name */}
              <TextField
                required
                fullWidth
                label="Full Name"
                placeholder="e.g. Rohit Verma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={Boolean(fullNameError)}
                helperText={fullNameError ?? 'Enter first and last name'}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {/* Field 2: Person Type (EMPLOYEE vs INTERN) */}
              <FormControl fullWidth required>
                <InputLabel id="employment-type-label">Type (Employee vs Intern)</InputLabel>
                <Select
                  labelId="employment-type-label"
                  label="Type (Employee vs Intern)"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                >
                  <MenuItem value="EMPLOYEE">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip label={`@${COMPANY_DOMAIN}`} size="small" color="primary" variant="outlined" />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>Employee</Typography>
                        <Typography variant="caption" color="text.secondary">Standard company employee (generates @{COMPANY_DOMAIN})</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="INTERN">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip label={`@${INTERN_DOMAIN}`} size="small" color="secondary" variant="outlined" />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>Intern</Typography>
                        <Typography variant="caption" color="text.secondary">Internship staff member (generates @{INTERN_DOMAIN})</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {employmentType === 'EMPLOYEE'
                    ? `Official Company Email Domain: @${COMPANY_DOMAIN}`
                    : `Official Company Email Domain: @${INTERN_DOMAIN}`}
                </FormHelperText>
              </FormControl>

              {/* Field 3: Role Selection */}
              <FormControl fullWidth required>
                <InputLabel id="role-select-label">Access / Role</InputLabel>
                <Select
                  labelId="role-select-label"
                  label="Access / Role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as FormRole)}
                >
                  <MenuItem value="EMPLOYEE">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <SmartphoneIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>EMPLOYEE</Typography>
                        <Typography variant="caption" color="text.secondary">Mobile App Attendance & Profile Only</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="HR">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <SupervisorAccountIcon color="secondary" fontSize="small" />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>HR</Typography>
                        <Typography variant="caption" color="text.secondary">Web Management Portal + Mobile Attendance (Dual Accounts)</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="ADMIN">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <ComputerIcon color="error" fontSize="small" />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>ADMIN</Typography>
                        <Typography variant="caption" color="text.secondary">Full Administrative Web Portal Access (System Config)</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {selectedRole === 'HR'
                    ? '👥 HR Role: Creates TWO accounts (HR Functional Web Account + Employee Attendance Account).'
                    : selectedRole === 'EMPLOYEE'
                    ? '📱 Standard employees sign in via the Momo HRMS Mobile App.'
                    : '💻 Administrative roles have access to the Momo HRMS Web Management Portal.'}
                </FormHelperText>
              </FormControl>

              {/* Field 4: Office Location & Geofence Assignment (Multiple Locations Support) */}
              <FormControl fullWidth required disabled={submitting}>
                <InputLabel id="office-location-label">Assigned Office Locations</InputLabel>
                <Select
                  labelId="office-location-label"
                  label="Assigned Office Locations *"
                  multiple
                  value={selectedOfficeIds}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedOfficeIds(typeof value === 'string' ? value.split(',') : value);
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((id, idx) => {
                        const off = offices.find((o) => o.id === id);
                        return (
                          <Chip
                            key={id}
                            label={`${off ? off.name : id}${idx === 0 ? ' (Primary)' : ''}`}
                            size="small"
                            color={idx === 0 ? 'primary' : 'default'}
                          />
                        );
                      })}
                    </Box>
                  )}
                  startAdornment={
                    <InputAdornment position="start">
                      <LocationOnIcon color="action" />
                    </InputAdornment>
                  }
                >
                  {offices.map((office) => (
                    <MenuItem key={office.id} value={office.id}>
                      <Checkbox checked={selectedOfficeIds.indexOf(office.id) > -1} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{office.name}</Typography>
                        <Chip label={office.code} size="small" variant="outlined" />
                        {office.city && <Typography variant="caption" color="text.secondary">({office.city})</Typography>}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Select all workplaces this employee is authorized to work and record attendance at (multi-location access). The first selected office is designated as Primary.
                </FormHelperText>
              </FormControl>

              {/* Field 5: Valid Personal Email */}
              <TextField
                required
                fullWidth
                type="email"
                label="Valid Personal Email Address"
                placeholder="e.g. employee@gmail.com"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                error={Boolean(emailError)}
                helperText={emailError ?? 'Official login credentials will be dispatched to this personal email address.'}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {/* Preview Cards */}
              {selectedRole === 'HR' ? (
                /* HR ACCOUNT INFORMATION PREVIEW */
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(156, 39, 176, 0.04)',
                    borderColor: 'secondary.main',
                    borderRadius: 2,
                    borderWidth: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <SupervisorAccountIcon color="secondary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.dark' }}>
                      HR ACCOUNT INFORMATION (DUAL ACCOUNTS)
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    HR staff members receive two separate accounts for security and separation of roles:
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    {/* Account 1 */}
                    <Card variant="outlined" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <ComputerIcon color="secondary" fontSize="small" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Account 1: HR Functional Account
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        <strong>Used for:</strong> HR Web Portal
                      </Typography>
                      <Box sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: 'secondary.main' }}>
                        {resolvingEmails ? 'Checking availability...' : resolvedHrEmail || fallbackHrEmail}
                      </Box>
                      <Chip label="Role: HR Admin" size="small" color="secondary" sx={{ mt: 1, fontWeight: 600, height: 20, fontSize: '0.7rem' }} />
                    </Card>

                    {/* Account 2 */}
                    <Card variant="outlined" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <SmartphoneIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Account 2: Employee Attendance Account
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        <strong>Used for:</strong> Normal Employee Attendance
                      </Typography>
                      <Box sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: 'primary.main' }}>
                        {resolvingEmails ? 'Checking availability...' : resolvedAttendanceEmail || fallbackAttendanceEmail}
                      </Box>
                      <Chip label="Role: Employee" size="small" color="primary" sx={{ mt: 1, fontWeight: 600, height: 20, fontSize: '0.7rem' }} />
                    </Card>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    * If duplicate emails exist, available numbered suffixes (.hr1, .hr2 / 1, 2) are automatically assigned.
                  </Typography>
                </Paper>
              ) : (
                /* Standard Provisioning Preview */
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', display: 'block', mb: 1 }}>
                    Automatic Setup Preview
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <Typography variant="caption" color="text.secondary">Company Login Email:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {resolvingEmails ? 'Checking availability...' : resolvedEmail || fallbackOfficialEmail}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <Typography variant="caption" color="text.secondary">Temporary Password:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        Generated securely by Auth Service
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <Typography variant="caption" color="text.secondary">Target Platform:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {selectedRole === 'EMPLOYEE' ? 'Momo HRMS Mobile App' : 'Momo HRMS Web Portal'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <Typography variant="caption" color="text.secondary">Assigned Workplace(s):</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {selectedOfficeIds.length > 0
                          ? offices.filter((o) => selectedOfficeIds.includes(o.id)).map((o) => o.name).join(', ')
                          : 'None Selected'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={autoSendCredentials}
                    onChange={(e) => setAutoSendCredentials(e.target.checked)}
                    color="primary"
                  />
                }
                label="Automatically send credentials to personal email on creation"
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(PATHS.employees)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                >
                  {submitting ? 'Creating User...' : selectedRole === 'HR' ? 'Create HR (Dual Accounts)' : 'Create User'}
                </Button>
              </Box>
            </Box>
          </form>
        </Paper>
      )}

      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={6000}
        onClose={() => setFeedback(null)}
        message={feedback}
      />
    </DashboardLayout>
  );
}
