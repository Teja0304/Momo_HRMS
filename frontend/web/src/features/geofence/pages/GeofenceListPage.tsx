import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { PATHS } from '../../../routes/paths';
import { fetchOffices } from '../services/geofenceService';
import type { Office } from '../types/geofence';
import { GeofenceTable } from '../components/GeofenceTable';
import { LocationVerifyTester } from '../components/LocationVerifyTester';

export default function GeofenceListPage() {
  const navigate = useNavigate();

  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Probe tester state
  const [testTarget, setTestTarget] = useState<Office | null>(null);

  useEffect(() => {
    let active = true;
    fetchOffices()
      .then((data) => {
        if (active) {
          setOffices(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Unable to load workplace offices and geofences.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardLayout
      title="Geofences & Office Boundaries"
      subtitle="Establish workplace office locations and manage geofence polygon perimeters."
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          color="inherit"
          onClick={() => navigate(PATHS.admin)}
        >
          Back to Admin Dashboard
        </Button>
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddLocationAltIcon />}
            onClick={() => navigate('/geofences/new')}
          >
            Add Office Workplace
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <GeofenceTable
        offices={offices}
        loading={loading}
        onEditPolygon={(office) => navigate(`/geofences/${office.id}/edit`)}
        onVerifyLocation={(office) => setTestTarget(office)}
      />

      {/* Location Verification Tester Modal */}
      <LocationVerifyTester
        open={Boolean(testTarget)}
        office={testTarget}
        onClose={() => setTestTarget(null)}
      />
    </DashboardLayout>
  );
}
