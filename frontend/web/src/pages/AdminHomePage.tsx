import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { DashboardLayout } from '../components/DashboardLayout';
import { PATHS } from '../routes/paths';

export default function AdminHomePage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout
      title="Admin Management"
      subtitle="Manage users, employees, roles, and organizational settings."
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
      </Box>
    </DashboardLayout>
  );
}
