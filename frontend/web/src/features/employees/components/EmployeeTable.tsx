import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import type { Employee, PageMeta } from '../../../types/employee';
import { EmployeeStatusBadge } from './EmployeeStatusBadge';
import { AccountStatusBadge } from './AccountStatusBadge';

interface Props {
  employees: Employee[];
  meta: PageMeta;
  loading: boolean;
  error: string | null;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newLimit: number) => void;
  onView: (id: string) => void;
  onEdit?: (id: string) => void;
  onToggleStatus?: (employee: Employee) => void;
  onResendCredentials?: (employee: Employee) => void;
  onRetry: () => void;
  canManage?: boolean;
}

export function EmployeeTable({
  employees,
  meta,
  loading,
  error,
  onPageChange,
  onRowsPerPageChange,
  onView,
  onEdit: _onEdit,
  onToggleStatus: _onToggleStatus,
  onResendCredentials: _onResendCredentials,
  onRetry,
  canManage: _canManage = true,
}: Props) {
  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', my: 2 }}>
        <Typography color="error" variant="h6" gutterBottom>
          Failed to load employees
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {error}
        </Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry}>
          Try Again
        </Button>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table sx={{ minWidth: 750 }}>
          <TableHead sx={{ backgroundColor: 'background.default' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Employee</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Department & Title</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Account</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: meta.limit > 5 ? 5 : meta.limit }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Skeleton variant="circular" width={40} height={40} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width={120} height={20} />
                        <Skeleton variant="text" width={80} height={16} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width={140} height={20} />
                    <Skeleton variant="text" width={100} height={16} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width={110} height={20} />
                    <Skeleton variant="text" width={90} height={16} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width={80} height={20} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="rounded" width={70} height={24} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="rounded" width={85} height={24} />
                  </TableCell>
                </TableRow>
              ))
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
                    <Typography variant="h6" color="text.secondary">
                      No employees found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your search criteria or add a new employee.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              (Array.isArray(employees) ? employees : []).map((emp) => {
                const initials = `${emp.firstName?.charAt(0) || ''}${emp.lastName?.charAt(0) || ''}`.toUpperCase() || 'EMP';
                const isHr = Boolean(
                  emp.role?.name?.toUpperCase().includes('HR') ||
                  emp.jobTitle?.toUpperCase().includes('HR') ||
                  (emp as any).designation?.title?.toUpperCase().includes('HR') ||
                  emp.email?.toLowerCase().includes('.hr@')
                );

                return (
                  <TableRow
                    key={emp.id}
                    hover
                    onClick={() => onView(emp.id)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease-in-out',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={emp.profilePhotoUrl ?? undefined}
                          sx={{ bgcolor: 'primary.main', width: 38, height: 38, fontSize: '0.875rem', fontWeight: 600 }}
                        >
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, color: 'text.primary' }}
                          >
                            {emp.firstName} {emp.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {emp.employeeCode}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: isHr ? 600 : 400 }}>
                        {emp.email}
                      </Typography>
                      {isHr && emp.email.includes('.hr') && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', fontSize: '0.72rem', fontWeight: 600 }}>
                          Mobile: {emp.email.replace(/\.hr([0-9]*?)@/, '$1@')}
                        </Typography>
                      )}
                      {emp.personalEmail && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.75rem' }}>
                          Personal: {emp.personalEmail}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {emp.phone}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {emp.jobTitle}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {emp.department?.name ?? '—'}
                      </Typography>
                      {emp.assignedOffices && emp.assignedOffices.length > 0 ? (
                        <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {emp.assignedOffices.map((o) => (
                            <Chip
                              key={o.id}
                              label={o.isPrimary ? `📍 ${o.name}` : o.name}
                              size="small"
                              variant={o.isPrimary ? 'filled' : 'outlined'}
                              color={o.isPrimary ? 'primary' : 'default'}
                              sx={{ fontSize: '0.68rem', height: 20, fontWeight: o.isPrimary ? 600 : 400 }}
                            />
                          ))}
                        </Box>
                      ) : emp.officeLocationName ? (
                        <Typography variant="caption" sx={{ color: 'primary.main', fontSize: '0.72rem', fontWeight: 600, display: 'block', mt: 0.25 }}>
                          📍 {emp.officeLocationName}
                        </Typography>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        <Typography variant="body2">
                          {emp.role?.name ?? '—'}
                        </Typography>
                        {isHr && (
                          <Chip
                            label="Accounts: 2"
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    <TableCell>
                      <EmployeeStatusBadge status={emp.status} />
                    </TableCell>

                    <TableCell>
                      <AccountStatusBadge
                        hasAccount={Boolean(emp.userId || emp.hasAccount)}
                        credentialsSentAt={emp.credentialsSentAt}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 20, 50]}
        component="div"
        count={meta.total}
        rowsPerPage={meta.limit}
        page={meta.page - 1}
        onPageChange={(_e, newPage) => onPageChange(newPage + 1)}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
      />
    </Paper>
  );
}
