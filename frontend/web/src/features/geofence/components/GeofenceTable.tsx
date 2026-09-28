import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import EditLocationAltIcon from '@mui/icons-material/EditLocationAlt';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import type { Office } from '../types/geofence';
import { GeofenceStatusBadge, PolygonConfiguredBadge } from './GeofenceStatusBadge';

interface Props {
  offices: Office[];
  loading: boolean;
  onEditPolygon: (office: Office) => void;
  onVerifyLocation: (office: Office) => void;
}

export function GeofenceTable({ offices, loading, onEditPolygon, onVerifyLocation }: Props) {
  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={36} />
        <Typography color="text.secondary">Loading workplace offices & geofences...</Typography>
      </Paper>
    );
  }

  if (offices.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          No Offices Found
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Click "Add Office Workplace" to register an office location and establish its geofence boundaries.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Office Code</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Workplace Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Location / City</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Geofence Boundary</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {offices.map((office) => {
              const hasPolygon = Boolean(office.activePolygon && office.activePolygon.vertices?.length >= 3);
              const vertexCount = office.activePolygon?.vertices?.length ?? 0;

              return (
                <TableRow key={office.id} hover>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{office.code}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{office.name}</TableCell>
                  <TableCell>
                    {office.city ? `${office.city}${office.country ? `, ${office.country}` : ''}` : office.address ?? '—'}
                  </TableCell>
                  <TableCell>
                    <PolygonConfiguredBadge hasPolygon={hasPolygon} vertexCount={vertexCount} />
                  </TableCell>
                  <TableCell>
                    <GeofenceStatusBadge isActive={office.isActive} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<EditLocationAltIcon />}
                        onClick={() => onEditPolygon(office)}
                      >
                        Boundary
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<MyLocationIcon />}
                        onClick={() => onVerifyLocation(office)}
                        disabled={!hasPolygon}
                      >
                        Test Probe
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
