import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

interface Props {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onReset: () => void;
}

export function AttendanceFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onReset,
}: Props) {
  const setPresetDays = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));

    onStartDateChange(start.toISOString().split('T')[0]);
    onEndDateChange(end.toISOString().split('T')[0]);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FilterAltIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Filter Attendance Records
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          label="From Date"
          type="date"
          size="small"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />

        <TextField
          label="To Date"
          type="date"
          size="small"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />

        <Button
          variant="outlined"
          color="inherit"
          size="medium"
          startIcon={<RestartAltIcon />}
          onClick={onReset}
          sx={{ minHeight: 40 }}
        >
          Reset
        </Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5 }}>
          Quick Ranges:
        </Typography>
        <Button size="small" variant="text" onClick={() => setPresetDays(1)}>
          Today
        </Button>
        <Button size="small" variant="text" onClick={() => setPresetDays(7)}>
          Last 7 Days
        </Button>
        <Button size="small" variant="text" onClick={() => setPresetDays(30)}>
          Last 30 Days
        </Button>
      </Stack>
    </Paper>
  );
}
