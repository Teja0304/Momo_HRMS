import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import type { Office, VerifyLocationResponse } from '../types/geofence';
import { verifyLocation } from '../services/geofenceService';
import { getCurrentCoordinates } from '../../attendance/services/attendanceService';
import { PolygonPreviewSvg } from './PolygonPreviewSvg';

interface Props {
  open: boolean;
  office: Office | null;
  onClose: () => void;
}

export function LocationVerifyTester({ open, office, onClose }: Props) {
  const [latitude, setLatitude] = useState<string>('18.5204');
  const [longitude, setLongitude] = useState<string>('73.8567');
  const [altitude, setAltitude] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyLocationResponse | null>(null);

  const handleUseCurrentLocation = async () => {
    setGeoLoading(true);
    setError(null);
    try {
      const coords = await getCurrentCoordinates();
      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));
      if (coords.altitudeMeters !== undefined) {
        setAltitude(String(coords.altitudeMeters));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not read GPS location.';
      setError(msg);
    } finally {
      setGeoLoading(false);
    }
  };

  const handleRunVerify = async () => {
    if (!office) return;
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    const altNum = altitude ? parseFloat(altitude) : undefined;

    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Please provide valid decimal numbers for latitude and longitude.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await verifyLocation({
        officeId: office.id,
        latitude: latNum,
        longitude: lngNum,
        altitudeMeters: altNum,
      });
      setResult(res);
    } catch {
      setError('Verification request failed. Please verify that the office boundary is active.');
    } finally {
      setLoading(false);
    }
  };

  const vertices = office?.activePolygon?.vertices ?? [];
  const probePoint =
    result && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))
      ? {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          isInside: result.isInside,
          label: result.isInside ? 'Inside Boundary' : 'Outside Boundary',
        }
      : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Geofence Verification Probe — {office?.name}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Test whether GPS coordinates are recognized inside the office polygon boundary.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Latitude"
            type="number"
            size="small"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            fullWidth
          />
          <TextField
            label="Longitude"
            type="number"
            size="small"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            fullWidth
          />
          <TextField
            label="Altitude (m, optional)"
            type="number"
            size="small"
            value={altitude}
            onChange={(e) => setAltitude(e.target.value)}
            fullWidth
          />
        </Stack>

        <Box sx={{ mb: 2.5, display: 'flex', gap: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<MyLocationIcon />}
            onClick={handleUseCurrentLocation}
            disabled={geoLoading}
          >
            {geoLoading ? 'Acquiring GPS...' : 'Use Browser GPS'}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleRunVerify}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify Coordinates'}
          </Button>
        </Box>

        {/* Verification Result Display */}
        {result && (
          <Card
            variant="outlined"
            sx={{
              p: 2,
              mb: 2.5,
              borderColor: result.isInside ? 'success.main' : 'error.main',
              bgcolor: result.isInside ? 'rgba(46, 125, 50, 0.04)' : 'rgba(198, 40, 40, 0.04)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              {result.isInside ? (
                <CheckCircleIcon color="success" fontSize="medium" />
              ) : (
                <CancelIcon color="error" fontSize="medium" />
              )}
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {result.isInside ? 'Inside Geofence Boundary' : 'Outside Geofence Boundary'}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Distance to nearest boundary edge: <strong>{result.distanceToBoundaryMeters.toFixed(1)} meters</strong>
            </Typography>
            {result.altitudeValid !== undefined && (
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={result.altitudeValid ? 'Altitude Valid' : 'Altitude Exceeded Limits'}
                  color={result.altitudeValid ? 'success' : 'warning'}
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}
          </Card>
        )}

        {/* Visual Map / SVG Display */}
        {vertices.length >= 3 && (
          <PolygonPreviewSvg
            vertices={vertices}
            width={480}
            height={260}
            probePoint={probePoint}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
