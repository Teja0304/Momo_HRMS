import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { DashboardLayout } from '../components/DashboardLayout';
import { PATHS } from '../routes/paths';

export default function AdminHomePage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout
      title="Admin Management"
      subtitle="Manage users, employees, attendance, geofences, and organizational communications."
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 3,
        }}
      >
        <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <PeopleIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Employee Directory
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Search, filter, view employee profiles, review assigned roles, and manage employment status (activate/deactivate).
            </Typography>
          </CardContent>
          <CardActions sx={{ p: 2, pt: 0 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate(PATHS.employees)}
            >
              Manage Employees
            </Button>
          </CardActions>
        </Card>

        <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <PersonAddIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Add New Employee
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Onboard a new employee by registering their profile, department assignment, job title, and organizational role.
            </Typography>
          </CardContent>
          <CardActions sx={{ p: 2, pt: 0 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate(PATHS.addEmployee)}
            >
              Add Employee
            </Button>
          </CardActions>
        </Card>

        <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <AccessTimeIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Attendance & Time Tracking
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Monitor real-time employee attendance sessions, check-in punctuality, geofence pauses, and generate comprehensive reports.
            </Typography>
          </CardContent>
          <CardActions sx={{ p: 2, pt: 0 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate(PATHS.attendance)}
            >
              Attendance Dashboard
            </Button>
          </CardActions>
        </Card>

        <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <LocationOnIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Geofences & Office Boundaries
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Establish workplace office locations, configure polygon perimeter vertices, and test coordinate verification probes.
            </Typography>
          </CardContent>
          <CardActions sx={{ p: 2, pt: 0 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate(PATHS.geofences)}
            >
              Manage Geofences
            </Button>
          </CardActions>
        </Card>

        <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardContent sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <NotificationsIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Notifications & Broadcasts
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Send organizational announcements, track system alerts, and review real-time event streams and delivery status.
            </Typography>
          </CardContent>
          <CardActions sx={{ p: 2, pt: 0 }}>
            <Button
              variant="outlined"
              fullWidth
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
