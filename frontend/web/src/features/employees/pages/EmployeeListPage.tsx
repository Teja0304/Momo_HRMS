import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { PATHS } from '../../../routes/paths';
import {
  changeEmployeeStatus,
  fetchActiveDepartments,
  fetchEmployees,
  fetchRoles,
} from '../../../services/employeeService';
import type {
  Department,
  Employee,
  EmployeeListQuery,
  EmploymentStatus,
  PageMeta,
  Role,
} from '../../../types/employee';
import { EmployeeFilters } from '../components/EmployeeFilters';
import { EmployeeTable } from '../components/EmployeeTable';

export default function EmployeeListPage() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter dropdown data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Filter state
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');

  // Status toggle modal
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load dropdown options once
  useEffect(() => {
    let mounted = true;
    Promise.all([fetchActiveDepartments(), fetchRoles()])
      .then(([deptsData, rolesData]) => {
        if (mounted) {
          setDepartments(deptsData);
          setRoles(rolesData);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load filter options:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch employees
  const loadEmployees = useCallback(
    async (pageToLoad = meta.page, limitToLoad = meta.limit) => {
      setLoading(true);
      setError(null);
      try {
        const query: EmployeeListQuery = {
          page: pageToLoad,
          limit: limitToLoad,
          search: search || undefined,
          departmentId: departmentId || undefined,
          roleId: roleId || undefined,
          status: (status as EmploymentStatus) || undefined,
        };
        const res = await fetchEmployees(query);
        setEmployees(res.data);
        setMeta(res.meta);
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.error?.message
            ? err.response.data.error.message
            : 'Unable to load employees. Please try again.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [meta.page, meta.limit, search, departmentId, roleId, status],
  );

  useEffect(() => {
    let active = true;
    const fetchFiltered = async () => {
      setLoading(true);
      setError(null);
      try {
        const query: EmployeeListQuery = {
          page: 1,
          limit: meta.limit,
          search: search || undefined,
          departmentId: departmentId || undefined,
          roleId: roleId || undefined,
          status: (status as EmploymentStatus) || undefined,
        };
        const res = await fetchEmployees(query);
        if (active) {
          setEmployees(res.data);
          setMeta(res.meta);
        }
      } catch (err: unknown) {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.error?.message
              ? err.response.data.error.message
              : 'Unable to load employees. Please try again.';
          setError(msg);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchFiltered();

    return () => {
      active = false;
    };
  }, [search, departmentId, roleId, status, meta.limit]);

  const handleResetFilters = () => {
    setSearch('');
    setDepartmentId('');
    setRoleId('');
    setStatus('');
  };

  const handleStatusToggleSubmit = async () => {
    if (!statusTarget) return;

    const nextStatus = statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setStatusSubmitting(true);
    try {
      await changeEmployeeStatus(statusTarget.id, {
        status: nextStatus,
        reason: statusReason.trim() || undefined,
      });
      setFeedback(
        `Employee "${statusTarget.firstName} ${statusTarget.lastName}" marked as ${nextStatus.toLowerCase()}.`,
      );
      setStatusTarget(null);
      setStatusReason('');
      await loadEmployees(meta.page, meta.limit);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to update employee status.';
      setError(msg);
    } finally {
      setStatusSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Employee Management"
      subtitle="View, search, filter, and manage employee profiles and employment status."
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          color="inherit"
          onClick={() => navigate(PATHS.admin)}
        >
          Back to Dashboard
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(PATHS.addEmployee)}
        >
          Add Employee
        </Button>
      </Box>

      <EmployeeFilters
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        roleId={roleId}
        onRoleChange={setRoleId}
        status={status}
        onStatusChange={setStatus}
        departments={departments}
        roles={roles}
        onReset={handleResetFilters}
        loading={loading}
      />

      <EmployeeTable
        employees={employees}
        meta={meta}
        loading={loading}
        error={error}
        onPageChange={(page) => loadEmployees(page, meta.limit)}
        onRowsPerPageChange={(limit) => {
          setMeta((prev) => ({ ...prev, limit, page: 1 }));
          loadEmployees(1, limit);
        }}
        onView={(id) => navigate(PATHS.employeeDetails(id))}
        onEdit={(id) => navigate(PATHS.editEmployee(id))}
        onToggleStatus={(emp) => {
          setStatusTarget(emp);
          setStatusReason('');
        }}
        onRetry={() => loadEmployees(meta.page, meta.limit)}
      />

      {/* Confirmation Dialog for Status Change */}
      <Dialog
        open={Boolean(statusTarget)}
        onClose={() => !statusSubmitting && setStatusTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {statusTarget?.status === 'ACTIVE' ? 'Deactivate Employee' : 'Activate Employee'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {statusTarget?.status === 'ACTIVE'
              ? `Are you sure you want to deactivate ${statusTarget?.firstName} ${statusTarget?.lastName} (${statusTarget?.employeeCode})? Deactivated employees will be blocked from attendance and system actions.`
              : `Are you sure you want to reactivate ${statusTarget?.firstName} ${statusTarget?.lastName} (${statusTarget?.employeeCode})? This will restore their active status in the organization.`}
          </DialogContentText>

          {statusTarget?.status === 'ACTIVE' && (
            <TextField
              label="Deactivation Reason (Optional)"
              multiline
              rows={2}
              fullWidth
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Resigned, sabbatical, contract ended..."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setStatusTarget(null)}
            color="inherit"
            disabled={statusSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStatusToggleSubmit}
            color={statusTarget?.status === 'ACTIVE' ? 'error' : 'success'}
            variant="contained"
            disabled={statusSubmitting}
          >
            {statusSubmitting
              ? 'Updating...'
              : statusTarget?.status === 'ACTIVE'
              ? 'Confirm Deactivation'
              : 'Confirm Activation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
      >
        <Alert severity="success" onClose={() => setFeedback(null)} variant="filled">
          {feedback}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
