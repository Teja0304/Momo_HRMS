import Chip from '@mui/material/Chip';

interface Props {
  isActive: boolean;
}

export function GeofenceStatusBadge({ isActive }: Props) {
  return isActive ? (
    <Chip label="Active" color="success" size="small" variant="filled" sx={{ fontWeight: 600 }} />
  ) : (
    <Chip label="Inactive" color="default" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
  );
}

export function PolygonConfiguredBadge({ hasPolygon, vertexCount }: { hasPolygon: boolean; vertexCount?: number }) {
  return hasPolygon ? (
    <Chip
      label={`Boundary Configured (${vertexCount ?? 0} pts)`}
      color="primary"
      size="small"
      variant="outlined"
      sx={{ fontWeight: 600 }}
    />
  ) : (
    <Chip
      label="Boundary Not Configured"
      color="warning"
      size="small"
      variant="outlined"
      sx={{ fontWeight: 600 }}
    />
  );
}
