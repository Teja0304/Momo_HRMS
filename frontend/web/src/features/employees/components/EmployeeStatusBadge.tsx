import Chip, { type ChipProps } from '@mui/material/Chip';
import type { EmploymentStatus } from '../../../types/employee';

interface Props {
  status: EmploymentStatus;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<
  EmploymentStatus,
  { label: string; color: ChipProps['color']; variant?: ChipProps['variant'] }
> = {
  ACTIVE: { label: 'Active', color: 'success' },
  INACTIVE: { label: 'Inactive', color: 'default', variant: 'outlined' },
  ON_LEAVE: { label: 'On Leave', color: 'warning' },
  SUSPENDED: { label: 'Suspended', color: 'warning', variant: 'filled' },
  TERMINATED: { label: 'Terminated', color: 'error', variant: 'filled' },
};

export function EmployeeStatusBadge({ status, size = 'small' }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'default' };

  return (
    <Chip
      size={size}
      label={config.label}
      color={config.color}
      variant={config.variant ?? 'filled'}
      sx={{ fontWeight: 600, fontSize: size === 'small' ? '0.75rem' : '0.85rem' }}
    />
  );
}
