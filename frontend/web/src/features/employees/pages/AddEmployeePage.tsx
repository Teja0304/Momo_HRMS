import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { LoadingIndicator } from '../../../components/LoadingIndicator';
import { useAuth } from '../../../context/AuthContext';
import { PATHS } from '../../../routes/paths';
import { getErrorMessage } from '../../../utils/errors';
import {
  createEmployee,
  fetchActiveDepartments,
  fetchRoles,
} from '../../../services/employeeService';
import type {
  CreateEmployeePayload,
  Department,
  Role,
} from '../../../types/employee';
import { EmployeeForm } from '../components/EmployeeForm';

export default function AddEmployeePage() {
  const navigate = useNavigate();
  const { setNotice } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchActiveDepartments(), fetchRoles()])
      .then(([deptsData, rolesData]) => {
        if (mounted) {
          setDepartments(deptsData);
          setRoles(rolesData);
        }
      })
      .catch((err) => {
        console.error('Failed to load form options:', err);
        setServerError(
          getErrorMessage(err, 'Unable to load departments or roles. Please check backend connectivity.')
        );
      })
      .finally(() => {
        if (mounted) setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (values: CreateEmployeePayload) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const created = await createEmployee(values);
      setNotice(`Employee "${created.firstName} ${created.lastName}" successfully created.`);
      navigate(PATHS.employeeDetails(created.id));
    } catch (err: unknown) {
      let msg = 'Failed to create employee. Please verify the information entered.';
      if (axios.isAxiosError(err)) {
        const resError = err.response?.data?.error as { code?: string; message?: string; details?: Array<{ path: string; message: string }> } | undefined;
        if (resError?.code === 'DUPLICATE_VALUE' || err.response?.status === 409) {
          msg = 'An employee with this Employee Code or Email already exists.';
        } else if (resError?.details && Array.isArray(resError.details)) {
          msg = resError.details.map((d) => `${d.path}: ${d.message}`).join(', ');
        } else if (resError?.message) {
          msg = resError.message;
        }
      }
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <DashboardLayout title="Add New Employee" subtitle="Loading setup options...">
        <LoadingIndicator message="Preparing employee creation form..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Add New Employee"
      subtitle="Register a new employee profile in the organization."
    >
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          color="inherit"
          onClick={() => navigate(PATHS.employees)}
        >
          Back to Employee List
        </Button>
      </Box>

      <EmployeeForm
        mode="create"
        departments={departments}
        roles={roles}
        onSubmit={handleSubmit}
        onCancel={() => navigate(PATHS.employees)}
        loading={submitting}
        serverError={serverError}
      />
    </DashboardLayout>
  );
}
