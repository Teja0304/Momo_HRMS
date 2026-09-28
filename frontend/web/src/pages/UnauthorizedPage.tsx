import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { AppHeader } from '../components/AppHeader';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { homePathForUser } from '../routes/paths';

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const target = user?.appRole ? homePathForUser(user) : null;

  return (
    <AuthLayout>
      <AppHeader title="Access Restricted" showLogo={false} />
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {user?.appRole === 'EMPLOYEE'
          ? 'The web portal is reserved for Admin and HR administrators. Standard employees must log in using the Momo HRMS mobile app on Android or iOS.'
          : 'You do not have permission to view that page.'}
      </Typography>
      {target && target !== '/unauthorized' ? (
        <Button component={RouterLink} to={target} variant="contained" fullWidth disableElevation sx={{ mb: 1 }}>
          Go to my dashboard
        </Button>
      ) : null}
      <Button fullWidth variant="outlined" onClick={() => void logout()}>
        Log out
      </Button>
    </AuthLayout>
  );
}
