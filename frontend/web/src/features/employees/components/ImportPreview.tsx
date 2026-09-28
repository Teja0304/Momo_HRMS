import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import UpdateIcon from '@mui/icons-material/Update';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { ValidationSummary, ImportRowStatus } from '../../../types/employee';

interface Props {
  summary: ValidationSummary;
}

const statusConfig: Record<
  ImportRowStatus,
  { label: string; color: 'success' | 'info' | 'warning' | 'error'; icon: typeof CheckCircleIcon }
> = {
  VALID_NEW: { label: 'Valid (New)', color: 'success', icon: CheckCircleIcon },
  VALID_UPDATE: { label: 'Valid (Update)', color: 'info', icon: UpdateIcon },
  DUPLICATE: { label: 'Duplicate', color: 'warning', icon: ContentCopyIcon },
  INVALID: { label: 'Invalid', color: 'error', icon: CancelIcon },
};

export function ImportPreview({ summary }: Props) {
  return (
    <Box>
      {/* Metric Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <Card variant="outlined">
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              TOTAL ROWS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
              {summary.totalRows}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderLeft: '4px solid #16a34a' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
              NEW EMPLOYEES
            </Typography>
            <Typography variant="h5" color="success.main" sx={{ fontWeight: 700, mt: 0.5 }}>
              {summary.validNewCount}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderLeft: '4px solid #2563eb' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
              UPDATES
            </Typography>
            <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700, mt: 0.5 }}>
              {summary.validUpdateCount}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderLeft: '4px solid #d97706' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
              DUPLICATES
            </Typography>
            <Typography variant="h5" color="warning.main" sx={{ fontWeight: 700, mt: 0.5 }}>
              {summary.duplicateCount}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderLeft: '4px solid #dc2626' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
              INVALID ROWS
            </Typography>
            <Typography variant="h5" color="error.main" sx={{ fontWeight: 700, mt: 0.5 }}>
              {summary.invalidCount}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Validation Table */}
      <Paper variant="outlined">
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            File Validation Preview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review the extracted rows below. Rows marked as Invalid or Duplicate will be automatically skipped during execution.
          </Typography>
        </Box>

        <TableContainer sx={{ maxHeight: 450 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 60 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Official Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Personal Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Dept / Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Validation Messages</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.rows.map((row) => {
                const conf = statusConfig[row.status];
                const IconComponent = conf.icon;

                return (
                  <TableRow
                    key={row.rowNumber}
                    hover
                    sx={{
                      backgroundColor:
                        row.status === 'INVALID'
                          ? 'rgba(239, 68, 68, 0.04)'
                          : row.status === 'DUPLICATE'
                          ? 'rgba(245, 158, 11, 0.04)'
                          : undefined,
                    }}
                  >
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {row.data.employeeCode || '—'}
                    </TableCell>
                    <TableCell>
                      {row.data.firstName} {row.data.lastName}
                    </TableCell>
                    <TableCell>{row.data.email}</TableCell>
                    <TableCell>{row.data.personalEmail || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {row.data.department}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.data.role}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<IconComponent sx={{ fontSize: '14px !important' }} />}
                        label={conf.label}
                        color={conf.color}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <Box sx={{ color: 'error.main', fontSize: '0.75rem' }}>
                          {row.errors.map((err, i) => (
                            <div key={i}>• {err}</div>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Ready for import
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
