import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SaveIcon from '@mui/icons-material/Save';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { getCurrentCoordinates } from '../../attendance/services/attendanceService';
import { fetchOfficeById, setOfficePolygon, verifyLocation } from '../services/geofenceService';
import type { Office, VerifyLocationResponse } from '../types/geofence';
import { PolygonPreviewSvg } from '../components/PolygonPreviewSvg';

interface EditableVertex {
  id: string;
  latitude: string;
  longitude: string;
}

function createSquareVertices(centerLat = 18.5204, centerLng = 73.8567): EditableVertex[] {
  const delta = 0.0015; // ~150 meters
  return [
    { id: 't1', latitude: (centerLat + delta).toFixed(6), longitude: (centerLng - delta).toFixed(6) },
    { id: 't2', latitude: (centerLat + delta).toFixed(6), longitude: (centerLng + delta).toFixed(6) },
    { id: 't3', latitude: (centerLat - delta).toFixed(6), longitude: (centerLng + delta).toFixed(6) },
    { id: 't4', latitude: (centerLat - delta).toFixed(6), longitude: (centerLng - delta).toFixed(6) },
  ];
}

export default function EditOfficePolygonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [office, setOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [boundaryName, setBoundaryName] = useState('Main Office Perimeter');
  const [vertices, setVertices] = useState<EditableVertex[]>([]);

  // Verification probe state
  const [testLat, setTestLat] = useState('18.5204');
  const [testLng, setTestLng] = useState('73.8567');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<VerifyLocationResponse | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficeById(id)
      .then((data) => {
        if (!active) return;
        setOffice(data);
        if (data.activePolygon && data.activePolygon.vertices?.length > 0) {
          setBoundaryName(data.activePolygon.name || 'Main Office Perimeter');
          setVertices(
            data.activePolygon.vertices.map((v, i) => ({
              id: `v-${i}`,
              latitude: String(v.latitude),
              longitude: String(v.longitude),
            })),
          );
          if (data.activePolygon.vertices[0]) {
            setTestLat(String(data.activePolygon.vertices[0].latitude));
            setTestLng(String(data.activePolygon.vertices[0].longitude));
          }
        } else {
          setVertices(createSquareVertices(18.5204, 73.8567));
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg =
          axios.isAxiosError(err) && err.response?.data?.message
            ? String(err.response.data.message)
            : 'Unable to load office details.';
        setError(msg);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleApplySquareTemplate = (centerLat = 18.5204, centerLng = 73.8567) => {
    setVertices(createSquareVertices(centerLat, centerLng));
  };

  const handleUseCurrentLocationTemplate = async () => {
    try {
      const coords = await getCurrentCoordinates();
      handleApplySquareTemplate(coords.latitude, coords.longitude);
      setTestLat(String(coords.latitude));
      setTestLng(String(coords.longitude));
      setFeedback('Square perimeter generated around your current GPS coordinates.');
    } catch {
      handleApplySquareTemplate(18.5204, 73.8567);
    }
  };

  const handleAddVertex = () => {
    const last = vertices[vertices.length - 1];
    const newLat = last ? (parseFloat(last.latitude) + 0.0005).toFixed(6) : '18.520000';
    const newLng = last ? (parseFloat(last.longitude) + 0.0005).toFixed(6) : '73.856000';

    setVertices([...vertices, { id: `v-${Date.now()}`, latitude: newLat, longitude: newLng }]);
  };

  const handleRemoveVertex = (index: number) => {
    if (vertices.length <= 3) {
      setError('A polygon requires a minimum of 3 vertices to form a closed geofence.');
      return;
    }
    setVertices(vertices.filter((_, i) => i !== index));
  };

  const handleVertexChange = (index: number, field: 'latitude' | 'longitude', value: string) => {
    const updated = [...vertices];
    updated[index][field] = value;
    setVertices(updated);
  };

  // Convert string vertices to numbers for SVG preview and payload
  const numericVertices = vertices.map((v, i) => ({
    sequence: i + 1,
    latitude: parseFloat(v.latitude) || 0,
    longitude: parseFloat(v.longitude) || 0,
  }));

  const handleSavePolygon = async () => {
    if (!id) return;
    if (vertices.length < 3) {
      setError('You must specify at least 3 vertices to create a geofence polygon.');
      return;
    }

    for (let i = 0; i < vertices.length; i++) {
      const lat = parseFloat(vertices[i].latitude);
      const lng = parseFloat(vertices[i].longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setError(`Vertex #${i + 1} has invalid latitude/longitude coordinates.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await setOfficePolygon(id, {
        name: boundaryName.trim() || 'Office Perimeter',
        vertices: numericVertices.map((v) => ({ latitude: v.latitude, longitude: v.longitude })),
      });
      setFeedback('Geofence polygon boundary saved and activated successfully!');
      // Refresh office info
      const refreshed = await fetchOfficeById(id);
      setOffice(refreshed);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to update geofence polygon.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRunVerificationProbe = async () => {
    if (!id) return;
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid coordinates for test probe.');
      return;
    }

    setProbing(true);
    setError(null);
    try {
      const res = await verifyLocation({
        officeId: id,
        latitude: lat,
        longitude: lng,
      });
      setProbeResult(res);
    } catch {
      setError('Probe test failed. Ensure the polygon boundary has been saved.');
    } finally {
      setProbing(false);
    }
  };

  const probePointForSvg =
    probeResult && !isNaN(parseFloat(testLat)) && !isNaN(parseFloat(testLng))
      ? {
          latitude: parseFloat(testLat),
          longitude: parseFloat(testLng),
          isInside: probeResult.isInside,
        }
      : undefined;

  return (
    <DashboardLayout
      title={`Boundary Polygon — ${office?.name ?? 'Office'}`}
      subtitle={`Configure vertices and verify geofence perimeter for office ${office?.code ?? ''}.`}
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 3,
            }}
          >
            {/* Left: Vertex Editor Table & Controls */}
            <Card variant="outlined">
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Boundary Coordinates
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutoFixHighIcon />}
                      onClick={handleUseCurrentLocationTemplate}
                    >
                      Template from GPS
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddVertex}
                    >
                      Add Point
                    </Button>
                  </Stack>
                </Box>

                <TextField
                  label="Polygon Boundary Version Name"
                  size="small"
                  value={boundaryName}
                  onChange={(e) => setBoundaryName(e.target.value)}
                  fullWidth
                  sx={{ mb: 2.5 }}
                />

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 60 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Latitude</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Longitude</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, width: 60 }}>Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vertices.map((v, idx) => (
                        <TableRow key={v.id}>
                          <TableCell sx={{ fontWeight: 700 }}>P{idx + 1}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={v.latitude}
                              onChange={(e) => handleVertexChange(idx, 'latitude', e.target.value)}
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={v.longitude}
                              onChange={(e) => handleVertexChange(idx, 'longitude', e.target.value)}
                              fullWidth
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveVertex(idx)}
                              disabled={vertices.length <= 3}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={handleSavePolygon}
                    disabled={saving || vertices.length < 3}
                    sx={{ px: 3 }}
                  >
                    {saving ? 'Saving Polygon...' : 'Save & Activate Boundary'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => navigate('/geofences')}
                  >
                    Cancel
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Right: SVG Polygon Visualizer & Interactive Verification Probe */}
            <Stack spacing={3}>
              <Card variant="outlined">
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                    Real-Time Polygon Visualization
                  </Typography>

                  <PolygonPreviewSvg
                    vertices={numericVertices}
                    width={480}
                    height={300}
                    probePoint={probePointForSvg}
                  />
                </CardContent>
              </Card>

              {/* In-Page Quick Location Verification Tester */}
              <Card variant="outlined">
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                    Test Location Probe (Inside/Outside Verification)
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                    <TextField
                      label="Test Latitude"
                      size="small"
                      type="number"
                      value={testLat}
                      onChange={(e) => setTestLat(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Test Longitude"
                      size="small"
                      type="number"
                      value={testLng}
                      onChange={(e) => setTestLng(e.target.value)}
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<MyLocationIcon />}
                      onClick={handleRunVerificationProbe}
                      disabled={probing}
                      sx={{ whiteSpace: 'nowrap', px: 2.5 }}
                    >
                      {probing ? 'Probing...' : 'Probe'}
                    </Button>
                  </Stack>

                  {probeResult && (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: probeResult.isInside ? 'rgba(46, 125, 50, 0.08)' : 'rgba(198, 40, 40, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {probeResult.isInside ? (
                          <CheckCircleIcon color="success" />
                        ) : (
                          <CancelIcon color="error" />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {probeResult.isInside ? 'Location is INSIDE geofence' : 'Location is OUTSIDE geofence'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Edge distance: {probeResult.distanceToBoundaryMeters.toFixed(1)}m
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Stack>
      )}

      <Snackbar open={Boolean(feedback)} autoHideDuration={4000} onClose={() => setFeedback(null)}>
        <Alert severity="success" variant="filled" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
