import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import type { Department, EmploymentStatus, Role } from '../../../types/employee';

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  departmentId: string;
  onDepartmentChange: (val: string) => void;
  roleId: string;
  onRoleChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  departments: Department[];
  roles: Role[];
  onReset: () => void;
  loading?: boolean;
}

const STATUS_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
];

export function EmployeeFilters({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  roleId,
  onRoleChange,
  status,
  onStatusChange,
  departments,
  roles,
  onReset,
  loading = false,
}: Props) {
  const hasActiveFilters = Boolean(search || departmentId || roleId || status);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            md: '2fr 1.5fr 1.5fr 1.5fr auto',
          },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          size="small"
          placeholder="Search by name, code, email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={loading}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <FormControl size="small" fullWidth>
          <InputLabel id="filter-dept-label">Department</InputLabel>
          <Select
            labelId="filter-dept-label"
            value={departmentId}
            label="Department"
            onChange={(e) => onDepartmentChange(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="">
              <em>All Departments</em>
            </MenuItem>
            {departments.map((dept) => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel id="filter-role-label">Role</InputLabel>
          <Select
            labelId="filter-role-label"
            value={roleId}
            label="Role"
            onChange={(e) => onRoleChange(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="">
              <em>All Roles</em>
            </MenuItem>
            {roles.map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel id="filter-status-label">Status</InputLabel>
          <Select
            labelId="filter-status-label"
            value={status}
            label="Status"
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="">
              <em>All Statuses</em>
            </MenuItem>
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<ClearIcon />}
            onClick={onReset}
            disabled={!hasActiveFilters || loading}
            sx={{ whiteSpace: 'nowrap', minHeight: 40 }}
          >
            Clear
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
