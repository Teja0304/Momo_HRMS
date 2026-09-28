import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { createOffice } from '../services/geofenceService';

export default function AddOfficePage() {
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('India');
  const [minAltitude, setMinAltitude] = useState('');
  const [maxAltitude, setMaxAltitude] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Office code and name are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createOffice({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        minAltitudeMeters: minAltitude ? parseFloat(minAltitude) : undefined,
        maxAltitudeMeters: maxAltitude ? parseFloat(maxAltitude) : undefined,
        isActive,
      });

      // Proceed to boundary polygon configuration
      navigate(`/geofences/${created.id}/edit`);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to create office workplace. Verify that the office code is unique.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Add Workplace Office"
      subtitle="Register a company workplace location before setting its boundary polygon."
    >
      <Box sx={{ mb: 3 }}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/geofences')}
        >
          Back to Offices
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ maxWidth: 720 }}>
        <CardContent sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Office Code"
                  placeholder="e.g. OFFICE-PUN-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Office Name"
                  placeholder="e.g. Pune Tech Park HQ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  fullWidth
                />
              </Stack>

              <TextField
                label="Street Address"
                placeholder="e.g. Survey No. 120, Tech Zone"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                fullWidth
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="City"
                  placeholder="e.g. Pune"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Country"
                  placeholder="e.g. India"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Min Altitude (Meters, Optional)"
                  type="number"
                  placeholder="e.g. 550"
                  value={minAltitude}
                  onChange={(e) => setMinAltitude(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Max Altitude (Meters, Optional)"
                  type="number"
                  placeholder="e.g. 620"
                  value={maxAltitude}
                  onChange={(e) => setMaxAltitude(e.target.value)}
                  fullWidth
                />
              </Stack>

              <FormControlLabel
                control={<Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
                label="Office is Active for Attendance Check-Ins"
              />

              <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  disabled={submitting}
                >
                  {submitting ? 'Creating Office...' : 'Create Office & Define Boundary'}
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => navigate('/geofences')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
