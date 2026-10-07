import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import TablePagination from '@mui/material/TablePagination';


export interface LiveAttendanceRow {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  location: string;
  checkInTime: string | null;
  status: 'WORKING' | 'PAUSED' | 'CHECKED_OUT' | 'ABSENT';
  workingTimeFormatted: string;
  pausedTimeFormatted: string;
  profilePhotoUrl?: string | null;
}

interface HrLiveAttendanceTableProps {
  rows: LiveAttendanceRow[];
  totalEmployees: number;
  loading?: boolean;
  onSelectEmployee?: (employeeId: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase() || 'EM';
}

function getAvatarColor(name: string): string {
  const colors = [
    '#059669', // Emerald
    '#2563eb', // Blue
    '#dc2626', // Red
    '#16a34a', // Green
    '#0891b2', // Cyan
    '#7c3aed', // Purple
    '#d97706', // Amber
    '#db2777', // Pink
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const HrLiveAttendanceTable: React.FC<HrLiveAttendanceTableProps> = ({
  rows,
  totalEmployees,
  loading = false,
  onSelectEmployee,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const paginatedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const getStatusBadge = (status: LiveAttendanceRow['status']) => {
    switch (status) {
      case 'WORKING':
        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#16a34a' }} />
            Working
          </Box>
        );
      case 'PAUSED':
        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, color: '#d97706', fontWeight: 700, fontSize: '0.82rem' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#d97706' }} />
            Paused
          </Box>
        );
      case 'CHECKED_OUT':
        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, color: '#2563eb', fontWeight: 700, fontSize: '0.82rem' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#2563eb' }} />
            Checked Out
          </Box>
        );
      case 'ABSENT':
      default:
        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, color: '#ef4444', fontWeight: 700, fontSize: '0.82rem' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ef4444' }} />
            Absent
          </Box>
        );
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        mb: 3,
        overflow: 'hidden',
      }}
    >
      {/* Table Header */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
            Live Attendance Monitor
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
            Click any employee to view their complete attendance & work reports
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>
          Showing {rows.length > 0 ? Math.min(rowsPerPage, rows.length) : 0} of {totalEmployees} employees
        </Typography>
      </Box>

      {/* Table Content */}
      <TableContainer>
        <Table sx={{ minWidth: 700 }}>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                Employee
              </TableCell>
              <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                Dept
              </TableCell>
              <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                Location
              </TableCell>
              <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                Check-In
              </TableCell>
              <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                Status
              </TableCell>
              <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                Working
              </TableCell>
              <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                Paused
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              [1, 2, 3, 4, 5].map((n) => (
                <TableRow key={n}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Skeleton variant="circular" width={36} height={36} />
                      <Box>
                        <Skeleton variant="text" width={110} height={20} />
                        <Skeleton variant="text" width={60} height={14} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Skeleton variant="text" width={80} /></TableCell>
                  <TableCell><Skeleton variant="text" width={80} /></TableCell>
                  <TableCell><Skeleton variant="text" width={50} /></TableCell>
                  <TableCell><Skeleton variant="text" width={70} /></TableCell>
                  <TableCell><Skeleton variant="text" width={60} /></TableCell>
                  <TableCell><Skeleton variant="text" width={50} /></TableCell>
                </TableRow>
              ))
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    No employees matching the current criteria.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => {
                const initials = getInitials(row.name);
                const avatarBg = getAvatarColor(row.name);

                return (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => onSelectEmployee?.(row.id)}
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td, &:last-child th': { border: 0 },
                      transition: 'background-color 0.15s ease',
                      '&:hover': {
                        bgcolor: '#f1f5f9',
                      },
                    }}
                  >
                    {/* Employee Profile */}
                    <TableCell sx={{ py: 1.8 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={row.profilePhotoUrl || undefined}
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: avatarBg,
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            color: '#ffffff',
                          }}
                        >
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                            {row.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace' }}>
                            {row.employeeCode}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Department */}
                    <TableCell sx={{ color: '#475569', fontSize: '0.875rem', fontWeight: 500 }}>
                      {row.department}
                    </TableCell>

                    {/* Location */}
                    <TableCell sx={{ color: '#475569', fontSize: '0.875rem', fontWeight: 500 }}>
                      {row.location}
                    </TableCell>

                    {/* Check-In Time */}
                    <TableCell sx={{ color: row.checkInTime ? '#0f172a' : '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>
                      {row.checkInTime || '—'}
                    </TableCell>

                    {/* Status with dot */}
                    <TableCell>
                      {getStatusBadge(row.status)}
                    </TableCell>

                    {/* Working Time */}
                    <TableCell sx={{ color: '#0f172a', fontSize: '0.875rem', fontWeight: 600 }}>
                      {row.workingTimeFormatted}
                    </TableCell>

                    {/* Paused Time */}
                    <TableCell sx={{ color: '#d97706', fontSize: '0.875rem', fontWeight: 600 }}>
                      {row.pausedTimeFormatted}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>


      {/* Pagination */}
      {!loading && rows.length > rowsPerPage && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid #f1f5f9' }}
        />
      )}
    </Card>
  );
};
