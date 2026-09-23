import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type {
  CreateEmployeePayload,
  Department,
  Gender,
  Role,
} from '../../../types/employee';

interface Props {
  mode: 'create' | 'edit';
  initialValues?: Partial<CreateEmployeePayload>;
  departments: Department[];
  roles: Role[];
  onSubmit: (values: CreateEmployeePayload) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  serverError?: string | null;
}

export function EmployeeForm({
  mode,
  initialValues,
  departments,
  roles,
  onSubmit,
  onCancel,
  loading = false,
  serverError = null,
}: Props) {
  const [formData, setFormData] = useState<CreateEmployeePayload>({
    employeeCode: initialValues?.employeeCode ?? '',
    firstName: initialValues?.firstName ?? '',
    lastName: initialValues?.lastName ?? '',
    email: initialValues?.email ?? '',
    phone: initialValues?.phone ?? '',
    jobTitle: initialValues?.jobTitle ?? '',
    departmentId: initialValues?.departmentId ?? '',
    roleId: initialValues?.roleId ?? '',
    dateOfJoining: initialValues?.dateOfJoining ?? new Date().toISOString().slice(0, 10),
    dateOfBirth: initialValues?.dateOfBirth ?? '',
    gender: (initialValues?.gender as Gender) ?? undefined,
    address: initialValues?.address ?? '',
    profilePhotoUrl: initialValues?.profilePhotoUrl ?? '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (mode === 'create') {
      if (!formData.employeeCode.trim()) {
        nextErrors.employeeCode = 'Employee code is required';
      } else if (!/^[A-Za-z0-9-]{2,30}$/.test(formData.employeeCode.trim())) {
        nextErrors.employeeCode = 'Code must be 2-30 characters (letters, numbers, hyphens)';
      }
    }

    if (!formData.firstName.trim()) {
      nextErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      nextErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = 'Phone number is required';
    }

    if (!formData.jobTitle.trim()) {
      nextErrors.jobTitle = 'Job title / designation is required';
    }

    if (!formData.departmentId) {
      nextErrors.departmentId = 'Department is required';
    }

    if (!formData.roleId) {
      nextErrors.roleId = 'Organizational role is required';
    }

    if (!formData.dateOfJoining) {
      nextErrors.dateOfJoining = 'Date of joining is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      ...formData,
      employeeCode: formData.employeeCode.trim().toUpperCase(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      jobTitle: formData.jobTitle.trim(),
      dateOfBirth: formData.dateOfBirth || undefined,
      address: formData.address?.trim() || undefined,
      profilePhotoUrl: formData.profilePhotoUrl?.trim() || undefined,
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
      {serverError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Section 1: Employment Identifiers */}
        <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
          Employment Information
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Job title, department, role, and official employee identifiers.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2.5,
            mb: 4,
          }}
        >
          <TextField
            label="Employee Code"
            required={mode === 'create'}
            disabled={mode === 'edit' || loading}
            value={formData.employeeCode}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, employeeCode: e.target.value.toUpperCase() }))
            }
            error={Boolean(errors.employeeCode)}
            helperText={errors.employeeCode ?? (mode === 'edit' ? 'Cannot be changed' : 'e.g. EMP-001')}
            fullWidth
          />

          <TextField
            label="Job Title / Designation"
            required
            disabled={loading}
            value={formData.jobTitle}
            onChange={(e) => setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))}
            error={Boolean(errors.jobTitle)}
            helperText={errors.jobTitle ?? 'e.g. Senior Software Engineer'}
            fullWidth
          />

          <FormControl fullWidth required error={Boolean(errors.departmentId)} disabled={loading}>
            <InputLabel id="dept-select-label">Department</InputLabel>
            <Select
              labelId="dept-select-label"
              value={formData.departmentId}
              label="Department *"
              onChange={(e) => setFormData((prev) => ({ ...prev, departmentId: e.target.value }))}
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </MenuItem>
              ))}
            </Select>
            {errors.departmentId && <FormHelperText>{errors.departmentId}</FormHelperText>}
          </FormControl>

          <FormControl fullWidth required error={Boolean(errors.roleId)} disabled={loading || mode === 'edit'}>
            <InputLabel id="role-select-label">Role</InputLabel>
            <Select
              labelId="role-select-label"
              value={formData.roleId}
              label="Role *"
              onChange={(e) => setFormData((prev) => ({ ...prev, roleId: e.target.value }))}
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name} {role.description ? `— ${role.description}` : ''}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {errors.roleId ?? (mode === 'edit' ? 'Organizational role cannot be modified after creation' : undefined)}
            </FormHelperText>
          </FormControl>

          <TextField
            label="Date of Joining"
            type="date"
            required
            disabled={loading}
            value={formData.dateOfJoining}
            onChange={(e) => setFormData((prev) => ({ ...prev, dateOfJoining: e.target.value }))}
            error={Boolean(errors.dateOfJoining)}
            helperText={errors.dateOfJoining}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Section 2: Personal Information */}
        <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
          Personal Information
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Contact details and personal background.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2.5,
            mb: 4,
          }}
        >
          <TextField
            label="First Name"
            required
            disabled={loading}
            value={formData.firstName}
            onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            error={Boolean(errors.firstName)}
            helperText={errors.firstName}
            fullWidth
          />

          <TextField
            label="Last Name"
            required
            disabled={loading}
            value={formData.lastName}
            onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            error={Boolean(errors.lastName)}
            helperText={errors.lastName}
            fullWidth
          />

          <TextField
            label="Email Address"
            type="email"
            required
            disabled={loading}
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            error={Boolean(errors.email)}
            helperText={errors.email ?? 'Official email address'}
            fullWidth
          />

          <TextField
            label="Phone Number"
            required
            disabled={loading}
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            error={Boolean(errors.phone)}
            helperText={errors.phone ?? 'e.g. +91 98765 43210'}
            fullWidth
          />

          <TextField
            label="Date of Birth"
            type="date"
            disabled={loading}
            value={formData.dateOfBirth ?? ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />

          <FormControl fullWidth disabled={loading}>
            <InputLabel id="gender-select-label">Gender</InputLabel>
            <Select
              labelId="gender-select-label"
              value={formData.gender ?? ''}
              label="Gender"
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  gender: (e.target.value as Gender) || undefined,
                }))
              }
            >
              <MenuItem value="">
                <em>Prefer not to say / Unspecified</em>
              </MenuItem>
              <MenuItem value="MALE">Male</MenuItem>
              <MenuItem value="FEMALE">Female</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
              <MenuItem value="PREFER_NOT_TO_SAY">Prefer not to say</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
            <TextField
              label="Residential Address"
              multiline
              rows={2}
              disabled={loading}
              value={formData.address ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              fullWidth
            />
          </Box>

          <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
            <TextField
              label="Profile Photo URL"
              placeholder="https://example.com/avatar.jpg"
              disabled={loading}
              value={formData.profilePhotoUrl ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, profilePhotoUrl: e.target.value }))}
              helperText="Optional link to a public avatar image"
              fullWidth
            />
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onCancel}
            disabled={loading}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ minWidth: 150 }}
          >
            {loading
              ? 'Saving...'
              : mode === 'create'
              ? 'Create Employee'
              : 'Save Changes'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
}
