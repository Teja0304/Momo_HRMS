import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';

export interface DepartmentStat {
  id: string;
  name: string;
  code: string;
  total: number;
  present: number;
  absent: number;
}

interface HrDepartmentChartProps {
  data: DepartmentStat[];
  loading?: boolean;
}

export const HrDepartmentChart: React.FC<HrDepartmentChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <Card
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          height: '100%',
        }}
      >
        <Skeleton variant="text" width={180} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={220} sx={{ borderRadius: 2 }} />
      </Card>
    );
  }

  // Calculate highest count for scale
  const maxDeptCount = Math.max(
    ...data.map((d) => Math.max(d.total, d.present, 1)),
    10,
  );
  const xMax = Math.ceil(maxDeptCount / 7) * 7;
  const xTicks = [0, Math.round(xMax * 0.25), Math.round(xMax * 0.5), Math.round(xMax * 0.75), xMax];

  return (
    <Card
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
          By Department — Today
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
          Real Department Distribution
        </Typography>
      </Box>

      {data.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No department data available.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', py: 1 }}>
          {data.map((dept) => {
            const presentPercent = Math.min(100, Math.max(0, (dept.present / xMax) * 100));
            const absentPercent = Math.min(100, Math.max(0, (dept.absent / xMax) * 100));
            const shortLabel = dept.code || dept.name.slice(0, 4);

            return (
              <Box key={dept.id} sx={{ mb: 2 }}>
                {/* Department Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {/* Label */}
                  <Typography
                    variant="caption"
                    sx={{
                      width: 50,
                      fontWeight: 700,
                      color: '#64748b',
                      textAlign: 'right',
                      flexShrink: 0,
                      fontSize: '0.75rem',
                    }}
                  >
                    {shortLabel}
                  </Typography>

                  {/* Horizontal Bars */}
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {/* Primary Bar: Present (Blue) */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: `${Math.max(presentPercent, 3)}%`,
                          height: 14,
                          bgcolor: '#2563eb',
                          borderRadius: '3px',
                          transition: 'width 0.4s ease',
                          minWidth: 4,
                        }}
                      />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>
                        {dept.present}
                      </Typography>
                    </Box>

                    {/* Secondary Bar: Absent (Light Red / Coral) */}
                    {dept.absent > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: `${Math.max(absentPercent, 3)}%`,
                            height: 10,
                            bgcolor: '#fca5a5',
                            borderRadius: '3px',
                            transition: 'width 0.4s ease',
                            minWidth: 4,
                          }}
                        />
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#dc2626' }}>
                          {dept.absent}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}

          {/* Scale Axis along bottom */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              pl: '56px',
              pt: 1,
              borderTop: '1px solid #f1f5f9',
            }}
          >
            {xTicks.map((tick) => (
              <Typography
                key={tick}
                variant="caption"
                sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}
              >
                {tick}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {/* Footer Legend */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          pt: 1.5,
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 8, borderRadius: '2px', bgcolor: '#2563eb' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>
            Present / Active
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 8, borderRadius: '2px', bgcolor: '#fca5a5' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>
            Absent
          </Typography>
        </Box>
      </Box>
    </Card>
  );
};
