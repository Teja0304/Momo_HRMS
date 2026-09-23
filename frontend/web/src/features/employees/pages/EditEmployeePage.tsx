import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { LoadingIndicator } from '../../../components/LoadingIndicator';
import { useAuth } from '../../../context/AuthContext';
import { PATHS } from '../../../routes/paths';
import { getErrorMessage } from '../../../utils/errors';
import {
  fetchActiveDepartments,
  fetchEmployeeById,
  fetchRoles,
  updateEmployee,
} from '../../../services/employeeService';
import type {
  CreateEmployeePayload,
  Department,
  Employee,
  Role,
} from '../../../types/employee';
import { EmployeeForm } from '../components/EmployeeForm';

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setNotice } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    Promise.all([fetchEmployeeById(id), fetchActiveDepartments(), fetchRoles()])
      .then(([empData, deptsData, rolesData]) => {
        if (mounted) {
          setEmployee(empData);
          setDepartments(deptsData);
          setRoles(rolesData);
        }
      })
      .catch((err) => {
        console.error('Failed to load employee for edit:', err);
        setServerError(
          getErrorMessage(err, 'Unable to load employee details or department options.')
        );
      })
      .finally(() => {
        if (mounted) setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSubmit = async (values: CreateEmployeePayload) => {
    if (!id || !employee) return;
    setSubmitting(true);
    setServerError(null);

    try {
      // Update general profile fields
      await updateEmployee(id, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        jobTitle: values.jobTitle,
        departmentId: values.departmentId,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth : null,
        gender: values.gender ?? null,
        address: values.address?.trim() ? values.address.trim() : null,
        profilePhotoUrl: values.profilePhotoUrl?.trim() ? values.profilePhotoUrl.trim() : null,
      });

      setNotice(`Employee profile for "${values.firstName} ${values.lastName}" updated successfully.`);
      navigate(PATHS.employeeDetails(id));
    } catch (err: unknown) {
      let msg = 'Failed to update employee details.';
      if (axios.isAxiosError(err)) {
        const resError = err.response?.data?.error as { code?: string; message?: string; details?: Array<{ path: string; message: string }> } | undefined;
        if (resError?.code === 'DUPLICATE_VALUE' || err.response?.status === 409) {
          msg = 'An employee with this email address already exists.';
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
      <DashboardLayout title="Edit Employee" subtitle="Loading employee details...">
        <LoadingIndicator message="Loading employee information..." />
      </DashboardLayout>
    );
  }

  if (!employee) {
    return (
      <DashboardLayout title="Edit Employee" subtitle="Error">
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(PATHS.employees)}
          >
            Back to Employee List
          </Button>
        </Box>
      </DashboardLayout>
    );
  }

  const initialValues: Partial<CreateEmployeePayload> = {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    jobTitle: employee.jobTitle,
    departmentId: employee.department?.id ?? '',
    roleId: employee.role?.id ?? '',
    dateOfJoining: employee.dateOfJoining,
    dateOfBirth: employee.dateOfBirth ?? '',
    gender: employee.gender ?? undefined,
    address: employee.address ?? '',
    profilePhotoUrl: employee.profilePhotoUrl ?? '',
  };

  return (
    <DashboardLayout
      title={`Edit: ${employee.firstName} ${employee.lastName}`}
      subtitle={`Employee Code: ${employee.employeeCode}`}
    >
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          color="inherit"
          onClick={() => navigate(PATHS.employeeDetails(employee.id))}
        >
          Back to Details
        </Button>
      </Box>

      <EmployeeForm
        mode="edit"
        initialValues={initialValues}
        departments={departments}
        roles={roles}
        onSubmit={handleSubmit}
        onCancel={() => navigate(PATHS.employeeDetails(employee.id))}
        loading={submitting}
        serverError={serverError}
      />
    </DashboardLayout>
  );
}
