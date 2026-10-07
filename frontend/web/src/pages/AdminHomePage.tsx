import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import TableChartIcon from '@mui/icons-material/TableChart';
import SecurityIcon from '@mui/icons-material/Security';
import { DashboardLayout } from '../components/DashboardLayout';
import { PATHS } from '../routes/paths';
import { fetchActiveDepartments, fetchEmployees } from '../services/employeeService';
import { fetchOffices } from '../features/geofence/services/geofenceService';

export default function AdminHomePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    employeeCount: 0,
    officeCount: 0,
    departmentCount: 0,
  });

  const loadMetrics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [empRes, officesRes, deptsRes] = await Promise.all([
        fetchEmployees({ limit: 1 }).catch(() => ({ meta: { total: 0 } })),
        fetchOffices().catch(() => []),
        fetchActiveDepartments().catch(() => []),
      ]);

      setStats({
        employeeCount: empRes.meta?.total || 0,
        officeCount: Array.isArray(officesRes) ? officesRes.length : 0,
        departmentCount: Array.isArray(deptsRes) ? deptsRes.length : 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Workforce Administration, Workplace Geofences, System Controls & Live Operations"
    >
      {/* Top Action Bar & Quick Shortcuts */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={<SecurityIcon fontSize="small" />}
            label="Administrator Privileges Active"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600, py: 1.5 }}
          />
          <Button
            size="small"
            startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={() => void loadMetrics(true)}
            disabled={refreshing}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PersonAddIcon />}
            onClick={() => navigate(PATHS.addEmployee)}
          >
            Add Employee
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={() => navigate(PATHS.importEmployees)}
          >
            Bulk Import CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddLocationAltIcon />}
            onClick={() => navigate(PATHS.addGeofence)}
          >
            New Office
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<AssessmentIcon />}
            onClick={() => navigate(PATHS.hr)}
          >
            Live Monitor (HR)
          </Button>
        </Box>
      </Box>

      {/* KPI Summary Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2.5,
          mb: 4,
        }}
      >
        {/* KPI 1: Employees */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Total Employees
            </Typography>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(27, 75, 143, 0.08)', color: '#1B4B8F' }}>
              <PeopleIcon fontSize="small" />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
            {loading ? <CircularProgress size={24} /> : stats.employeeCount}
          </Typography>
          <Button
            size="small"
            endIcon={<ArrowForwardIcon fontSize="small" />}
            onClick={() => navigate(PATHS.employees)}
            sx={{ alignSelf: 'flex-start', p: 0, textTransform: 'none', fontWeight: 600 }}
          >
            Manage staff profiles
          </Button>
        </Paper>

        {/* KPI 2: Offices & Geofences */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Workplace Offices
            </Typography>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(46, 125, 50, 0.08)', color: '#2e7d32' }}>
              <LocationOnIcon fontSize="small" />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
            {loading ? <CircularProgress size={24} /> : stats.officeCount}
          </Typography>
          <Button
            size="small"
            endIcon={<ArrowForwardIcon fontSize="small" />}
            onClick={() => navigate(PATHS.geofences)}
            sx={{ alignSelf: 'flex-start', p: 0, textTransform: 'none', fontWeight: 600, color: '#2e7d32' }}
          >
            Geofence boundaries
          </Button>
        </Paper>

        {/* KPI 3: Departments */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Active Departments
            </Typography>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(156, 39, 176, 0.08)', color: '#9c27b0' }}>
              <CorporateFareIcon fontSize="small" />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
            {loading ? <CircularProgress size={24} /> : stats.departmentCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Structured business units
          </Typography>
        </Paper>

        {/* KPI 4: System Status */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
              System Status
            </Typography>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(2, 136, 209, 0.08)', color: '#0288d1' }}>
              <CheckCircleIcon fontSize="small" />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4caf50' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
              Operational
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            All microservices online
          </Typography>
        </Paper>
      </Box>

      {/* Main Administrative Modules Grid */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Management Modules
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        {/* Module 1: Employee Management */}
        <Card variant="outlined" sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1, p: 3, pb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main', opacity: 0.9 }}>
                <PeopleIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Employee Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Workforce directory, accounts & roles
                </Typography>
              </Box>
            </Box>
          </CardContent>
          <CardActions sx={{ p: 3, pt: 1, gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={() => navigate(PATHS.employees)}
            >
              Employee Directory
            </Button>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => navigate(PATHS.addEmployee)}
            >
              Add Employee
            </Button>
            <Button
              variant="text"
              startIcon={<CloudUploadIcon />}
              onClick={() => navigate(PATHS.importEmployees)}
            >
              Bulk Import
            </Button>
          </CardActions>
        </Card>

        {/* Module 2: Geofences & Workplace Boundaries */}
        <Card variant="outlined" sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1, p: 3, pb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(46, 125, 50, 0.1)', color: '#2e7d32' }}>
                <LocationOnIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Geofences & Office Boundaries
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Office locations & boundary perimeters
                </Typography>
              </Box>
            </Box>
          </CardContent>
          <CardActions sx={{ p: 3, pt: 1, gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="success"
              onClick={() => navigate(PATHS.geofences)}
            >
              Manage Geofences
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddLocationAltIcon />}
              onClick={() => navigate(PATHS.addGeofence)}
            >
              New Office Location
            </Button>
          </CardActions>
        </Card>

        {/* Module 3: HR Dashboard & Live Attendance */}
        <Card variant="outlined" sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1, p: 3, pb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(156, 39, 176, 0.1)', color: '#9c27b0' }}>
                <AssessmentIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  HR Live Monitor & Attendance
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Real-time attendance tracking & logs
                </Typography>
              </Box>
            </Box>
          </CardContent>
          <CardActions sx={{ p: 3, pt: 1, gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => navigate(PATHS.hr)}
            >
              Open HR Live Dashboard
            </Button>
            <Button
              variant="outlined"
              startIcon={<TableChartIcon />}
              onClick={() => navigate(PATHS.attendanceReports)}
            >
              Attendance Reports
            </Button>
          </CardActions>
        </Card>

        {/* Module 4: Notifications & Broadcasts */}
        <Card variant="outlined" sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1, p: 3, pb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(237, 108, 2, 0.1)', color: '#ed6c02' }}>
                <NotificationsIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Notifications & Broadcasts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Company alerts & event notifications
                </Typography>
              </Box>
            </Box>
          </CardContent>
          <CardActions sx={{ p: 3, pt: 1, gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => navigate(PATHS.notifications)}
            >
              Notification Center
            </Button>
          </CardActions>
        </Card>
      </Box>
    </DashboardLayout>
  );
}
