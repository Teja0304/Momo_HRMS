import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import type { Employee, PageMeta } from '../../../types/employee';
import { EmployeeStatusBadge } from './EmployeeStatusBadge';

interface Props {
  employees: Employee[];
  meta: PageMeta;
  loading: boolean;
  error: string | null;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newLimit: number) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleStatus: (employee: Employee) => void;
  onRetry: () => void;
}

export function EmployeeTable({
  employees,
  meta,
  loading,
  error,
  onPageChange,
  onRowsPerPageChange,
  onView,
  onEdit,
  onToggleStatus,
  onRetry,
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
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
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
                  <TableCell align="right">
                    <Skeleton variant="rounded" width={100} height={32} sx={{ ml: 'auto' }} />
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
              employees.map((emp) => {
                const initials = `${emp.firstName.charAt(0)}${emp.lastName.charAt(0)}`.toUpperCase();
                const isActive = emp.status === 'ACTIVE';

                return (
                  <TableRow
                    key={emp.id}
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
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
                            sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                            onClick={() => onView(emp.id)}
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
                      <Typography variant="body2">{emp.email}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {emp.phone}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {emp.jobTitle}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {emp.department?.name ?? '—'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {emp.role?.name ?? '—'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <EmployeeStatusBadge status={emp.status} />
                    </TableCell>

                    <TableCell align="right">
                      <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => onView(emp.id)}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit Employee">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => onEdit(emp.id)}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title={isActive ? 'Deactivate Employee' : 'Activate Employee'}>
                          <IconButton
                            size="small"
                            color={isActive ? 'error' : 'success'}
                            onClick={() => onToggleStatus(emp)}
                          >
                            {isActive ? (
                              <BlockIcon fontSize="small" />
                            ) : (
                              <CheckCircleIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
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
