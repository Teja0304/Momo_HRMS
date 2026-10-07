import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import TimerOffOutlinedIcon from '@mui/icons-material/TimerOffOutlined';

export interface OverviewMetrics {
  totalEmployees: number;
  present: number;
  working: number;
  paused: number;
  checkedOut: number;
  absent: number;
  autoCheckout: number;
}

interface HrOverviewCardsProps {
  metrics: OverviewMetrics;
  loading?: boolean;
}

export const HrOverviewCards: React.FC<HrOverviewCardsProps> = ({ metrics, loading = false }) => {
  const cards = [
    {
      id: 'total',
      label: 'Total Employees',
      value: metrics.totalEmployees,
      icon: <PeopleAltOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#2563eb',
      bgColor: '#eff6ff',
      borderColor: '#dbeafe',
    },
    {
      id: 'present',
      label: 'Present',
      value: metrics.present,
      icon: <CheckCircleOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#10b981',
      bgColor: '#ecfdf5',
      borderColor: '#d1fae5',
    },
    {
      id: 'working',
      label: 'Working',
      value: metrics.working,
      icon: <PlayCircleOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#059669',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
    },
    {
      id: 'paused',
      label: 'Paused',
      value: metrics.paused,
      icon: <PauseCircleOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#d97706',
      bgColor: '#fffbeb',
      borderColor: '#fef3c7',
    },
    {
      id: 'checked-out',
      label: 'Checked Out',
      value: metrics.checkedOut,
      icon: <ExitToAppIcon sx={{ fontSize: 20 }} />,
      color: '#0284c7',
      bgColor: '#f0f9ff',
      borderColor: '#e0f2fe',
    },
    {
      id: 'absent',
      label: 'Absent',
      value: metrics.absent,
      icon: <PersonOffOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#e11d48',
      bgColor: '#fff1f2',
      borderColor: '#ffe4e6',
    },
    {
      id: 'auto-checkout',
      label: 'Auto Checkout',
      value: metrics.autoCheckout,
      icon: <TimerOffOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#7c3aed',
      bgColor: '#f5f3ff',
      borderColor: '#ede9fe',
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(4, 1fr)',
          lg: 'repeat(7, 1fr)',
        },
        gap: 2,
        mb: 3,
      }}
    >
      {cards.map((c) => (
        <Card
          key={c.id}
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)',
              borderColor: c.color,
              transform: 'translateY(-2px)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.68rem',
              }}
            >
              {c.label}
            </Typography>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 2,
                bgcolor: c.bgColor,
                color: c.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {c.icon}
            </Box>
          </Box>

          {loading ? (
            <Skeleton variant="text" width={48} height={40} />
          ) : (
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.1,
                fontSize: '1.75rem',
              }}
            >
              {c.value}
            </Typography>
          )}
        </Card>
      ))}
    </Box>
  );
};
