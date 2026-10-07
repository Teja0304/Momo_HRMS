import { useEffect, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { DashboardLayout } from '../components/DashboardLayout';
import { EmployeeAttendanceReportView } from '../features/hr/components/EmployeeAttendanceReportView';
import { fetchEmployees } from '../services/employeeService';
import type { Employee } from '../types/employee';
import { PATHS } from '../routes/paths';

export default function HrEmployeeReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    fetchEmployees({ limit: 100 })
      .then((res) => setEmployees(Array.isArray(res.data) ? res.data : []))
      .catch((e) => console.warn('Could not load employees list for switcher:', e));
  }, []);

  if (!id) {
    navigate(PATHS.hr);
    return null;
  }

  return (
    <DashboardLayout
      title="Employee Attendance & Work Reports"
      subtitle="HR Analytics • Detailed session timestamps, daily timeline visual & approved hours"
      hideUserCard
      maxWidth="xl"
    >
      <Box sx={{ py: 1 }}>
        <EmployeeAttendanceReportView
          employeeId={id}
          allEmployees={employees}
          onSelectEmployee={(newId) => navigate(PATHS.hrEmployeeReport(newId))}
          onBack={() => navigate(PATHS.hr)}
        />
      </Box>
    </DashboardLayout>
  );
}
