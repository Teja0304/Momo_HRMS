import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import BusinessIcon from '@mui/icons-material/Business';

export interface OfficeMetric {
  id: string;
  name: string;
  code: string;
  working: number;
  paused: number;
  out: number;
  totalAssigned: number;
}

interface HrOfficeCardsProps {
  offices: OfficeMetric[];
  loading?: boolean;
}

export const HrOfficeCards: React.FC<HrOfficeCardsProps> = ({ offices, loading = false }) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2.5,
        }}
      >
        {[1, 2, 3].map((n) => (
          <Card key={n} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="80%" height={18} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 1 }} />
          </Card>
        ))}
      </Box>
    );
  }

  if (offices.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: `repeat(${Math.min(offices.length, 3)}, 1fr)` },
        gap: 2.5,
      }}
    >
      {offices.map((office) => {
        const activeCount = office.working + office.paused;
        const total = Math.max(office.totalAssigned, activeCount, 1);
        const percent = Math.min(100, Math.round((activeCount / total) * 100));

        return (
          <Card
            key={office.id}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)',
                borderColor: '#cbd5e1',
                transform: 'translateY(-2px)',
              },
            }}
          >
            {/* Office Title and Icon */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                  {office.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    display: 'block',
                    mt: 0.3,
                  }}
                >
                  Working: {office.working} &bull; Paused: {office.paused} &bull; Out: {office.out}
                </Typography>
              </Box>

              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BusinessIcon fontSize="small" />
              </Box>
            </Box>

            {/* Capacity Progress Bar & Numbers */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={percent}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: '#f1f5f9',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: '#2563eb',
                    },
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                }}
              >
                {activeCount}/{office.totalAssigned}
              </Typography>
            </Box>
          </Card>
        );
      })}
    </Box>
  );
};
