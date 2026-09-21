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
      <AppHeader title="Access denied" showLogo={false} />
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        You do not have permission to view that page.
      </Typography>
      {target ? (
        <Button component={RouterLink} to={target} variant="contained" fullWidth disableElevation sx={{ mb: 1 }}>
          Go to my dashboard
        </Button>
      ) : null}
      <Button fullWidth onClick={() => void logout()}>
        Log out
      </Button>
    </AuthLayout>
  );
}
