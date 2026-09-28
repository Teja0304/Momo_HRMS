import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import NoAccountsOutlinedIcon from '@mui/icons-material/NoAccountsOutlined';

interface Props {
  hasAccount?: boolean;
  credentialsSentAt?: string | null;
  size?: 'small' | 'medium';
}

export function AccountStatusBadge({ hasAccount, credentialsSentAt, size = 'small' }: Props) {
  if (hasAccount) {
    const sentText = credentialsSentAt
      ? `Provisioned & sent on ${new Date(credentialsSentAt).toLocaleDateString()}`
      : 'Portal login account provisioned';

    return (
      <Tooltip title={sentText} arrow>
        <Chip
          icon={<VpnKeyOutlinedIcon sx={{ fontSize: '14px !important' }} />}
          label="Account Active"
          size={size}
          color="success"
          variant="outlined"
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            borderColor: 'success.light',
            backgroundColor: 'rgba(46, 125, 50, 0.06)',
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="No portal login account provisioned yet" arrow>
      <Chip
        icon={<NoAccountsOutlinedIcon sx={{ fontSize: '14px !important' }} />}
        label="No Account"
        size={size}
        color="default"
        variant="outlined"
        sx={{
          fontWeight: 500,
          fontSize: '0.75rem',
          color: 'text.secondary',
        }}
      />
    </Tooltip>
  );
}
