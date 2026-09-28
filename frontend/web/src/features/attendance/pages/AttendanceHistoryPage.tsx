import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { fetchAttendanceHistory } from '../services/attendanceService';
import type { AttendanceSession } from '../types/attendance';
import { AttendanceFilters } from '../components/AttendanceFilters';
import { AttendanceTable } from '../components/AttendanceTable';

export default function AttendanceHistoryPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state (default: last 30 days)
  const [startDate, setStartDate] = useState(() =>
    new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().split('T')[0],
  );

  const loadHistory = useCallback(
    async (pageToLoad = page) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAttendanceHistory({
          page: pageToLoad,
          limit,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        setSessions(res.items ?? []);
        setPage(res.page);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.message
            ? String(err.response.data.message)
            : 'Unable to load attendance history.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, startDate, endDate],
  );

  useEffect(() => {
    let active = true;
    fetchAttendanceHistory({
      page: 1,
      limit,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
      .then((res) => {
        if (active) {
          setSessions(res.items ?? []);
          setPage(res.page);
          setTotal(res.total);
          setTotalPages(res.totalPages);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Unable to load attendance history.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [startDate, endDate, limit]);

  const handleResetFilters = () => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
  };

  const handleViewDetails = (session: AttendanceSession) => {
    navigate(`/attendance/${session.id}`);
  };

  return (
    <DashboardLayout
      title="Attendance Records"
      subtitle="View, filter, and audit attendance log history and working hours."
    >
      <Box sx={{ mb: 3 }}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/attendance')}
          sx={{ mb: 2 }}
        >
          Back to Attendance Dashboard
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <AttendanceFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onReset={handleResetFilters}
      />

      <AttendanceTable
        sessions={sessions}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(newPage) => {
          setPage(newPage);
          void loadHistory(newPage);
        }}
        onViewDetails={handleViewDetails}
      />
    </DashboardLayout>
  );
}
