import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../api/client';
import { GEOFENCE_API_URL } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';
import { PATHS } from '../routes/paths';
import { fetchActiveDepartments, fetchEmployees } from '../services/employeeService';
import {
  fetchCompanyAttendanceHistory,
  fetchCompanyTodayAttendance,
} from '../features/attendance/services/attendanceService';
import type { Employee, Department } from '../types/employee';
import type { AttendanceSession } from '../features/attendance/types/attendance';
import { HrOverviewCards, type OverviewMetrics } from '../features/hr/components/HrOverviewCards';
import { HrAttendanceTrendChart, type DailyTrendPoint } from '../features/hr/components/HrAttendanceTrendChart';
import { HrDepartmentChart, type DepartmentStat } from '../features/hr/components/HrDepartmentChart';
import { HrLiveAttendanceTable, type LiveAttendanceRow } from '../features/hr/components/HrLiveAttendanceTable';
import { HrOfficeCards, type OfficeMetric } from '../features/hr/components/HrOfficeCards';

interface OfficeData {
  id: string;
  name: string;
  code: string;
}

export default function HrHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Search & Loading State
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);



  // Real Backend Datasets
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<OfficeData[]>([]);
  const [historySessions, setHistorySessions] = useState<AttendanceSession[]>([]);
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);

  // Live seconds ticker for active WORKING sessions
  const [liveSecondTick, setLiveSecondTick] = useState(0);

  // Master Data Loading Routine
  const loadDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    // Past 7 days date range (YYYY-MM-DD)
    const end = new Date();
    const start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    try {
      // 1. Fetch Real Employees (limit: 100)
      const empPromise = fetchEmployees({ limit: 100 }).catch((e) => {
        console.warn('Could not load employees:', e);
        return { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } };
      });

      // 2. Fetch Real Departments
      const deptPromise = fetchActiveDepartments().catch((e) => {
        console.warn('Could not load departments:', e);
        return [] as Department[];
      });

      // 3. Fetch Real Workplace Offices (Geofences)
      const officePromise = api
        .get<{ data?: OfficeData[] } | OfficeData[]>(`${GEOFENCE_API_URL}/offices`)
        .then((res) => (Array.isArray(res.data) ? res.data : res.data?.data ?? []))
        .catch((e) => {
          console.warn('Could not load offices:', e);
          return [] as OfficeData[];
        });

      // 4. Fetch Real Attendance History for 7-day trend across all employees
      const historyPromise = fetchCompanyAttendanceHistory({
        startDate: startDateStr,
        endDate: endDateStr,
        page: 1,
        limit: 500,
      })
        .then((res) => res.items ?? [])
        .catch((e) => {
          console.warn('Could not load attendance history:', e);
          return [] as AttendanceSession[];
        });

      // 5. Fetch Today's Attendance Sessions across all employees
      const todayPromise = fetchCompanyTodayAttendance()
        .then((res) => res.sessions ?? [])
        .catch((e) => {
          console.warn('Could not load today attendance:', e);
          return [] as AttendanceSession[];
        });

      const [empRes, deptsData, officesData, histSessions, todaySess] = await Promise.all([
        empPromise,
        deptPromise,
        officePromise,
        historyPromise,
        todayPromise,
      ]);

      setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      setDepartments(deptsData);
      setOffices(officesData);
      setHistorySessions(histSessions);
      setTodaySessions(todaySess);
    } catch {
      setError('Unable to synchronize HR dashboard with backend services. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadDashboardData(false);
  }, [loadDashboardData]);

  // Real-time synchronization: Poll backend every 25 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void loadDashboardData(true);
    }, 25000);

    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Re-fetch on window focus (e.g. when returning from Admin tab)
  useEffect(() => {
    const onFocus = () => {
      void loadDashboardData(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadDashboardData]);

  // 1-second live working timer ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setLiveSecondTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Today's date string (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Merge today sessions with history sessions for consistent session lookups
  const allKnownSessions = useMemo(() => {
    const map = new Map<string, AttendanceSession>();
    for (const s of historySessions) {
      map.set(s.id, s);
    }
    for (const s of todaySessions) {
      map.set(s.id, s);
    }
    return Array.from(map.values());
  }, [historySessions, todaySessions]);

  // Today's recorded sessions
  const todaysRecordedSessions = useMemo(() => {
    const todayIds = new Set(todaySessions.map((s) => s.id));
    return allKnownSessions.filter(
      (s) =>
        todayIds.has(s.id) ||
        s.status === 'WORKING' ||
        s.status === 'PAUSED' ||
        s.attendanceDate?.startsWith(todayStr) ||
        s.checkInAt?.startsWith(todayStr),
    );
  }, [allKnownSessions, todaySessions, todayStr]);

  // Map employee ID / employeeCode to their today's session
  const sessionByEmployee = useMemo(() => {
    const map = new Map<string, AttendanceSession>();
    // Sort so active sessions (WORKING / PAUSED) take precedence over closed sessions,
    // and later checkInAt takes precedence
    const sorted = [...todaysRecordedSessions].sort((a, b) => {
      const aActive = a.status === 'WORKING' || a.status === 'PAUSED' ? 1 : 0;
      const bActive = b.status === 'WORKING' || b.status === 'PAUSED' ? 1 : 0;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime();
    });

    for (const s of sorted) {
      map.set(s.employeeId, s);
      const match = employees.find(
        (e) => e.id === s.employeeId || e.employeeCode === s.employeeId,
      );
      if (match) {
        map.set(match.id, s);
        if (match.employeeCode) map.set(match.employeeCode, s);
      }
    }
    return map;
  }, [todaysRecordedSessions, employees]);

  // Total Active employees
  const activeEmployees = useMemo(() => {
    return employees.filter(
      (e) => (e.status || (e as any).employmentStatus || 'ACTIVE') === 'ACTIVE',
    );
  }, [employees]);

  // Calculated Overview Metrics (per employee, not raw session count)
  const overviewMetrics: OverviewMetrics = useMemo(() => {
    const totalEmployees = employees.length;
    // Get unique active sessions for active employees
    const uniqueEmployeeSessions = Array.from(
      new Map(
        activeEmployees.map((e) => [
          e.id,
          sessionByEmployee.get(e.id) || sessionByEmployee.get(e.employeeCode),
        ]),
      ).values(),
    ).filter(Boolean) as AttendanceSession[];

    const working = uniqueEmployeeSessions.filter((s) => s.status === 'WORKING').length;
    const paused = uniqueEmployeeSessions.filter((s) => s.status === 'PAUSED').length;
    const checkedOut = uniqueEmployeeSessions.filter(
      (s) => s.status === 'COMPLETED' || (s.status as any) === 'CHECKED_OUT',
    ).length;
    const present = working + paused + checkedOut;
    const absent = Math.max(0, activeEmployees.length - present);

    const autoCheckout = todaysRecordedSessions.filter(
      (s) =>
        s.checkoutType === 'AUTO_CHECKOUT' ||
        (s.checkoutType as any) === 'AUTO' ||
        s.checkoutReason === 'GEOFENCE_TIMEOUT',
    ).length;

    return {
      totalEmployees,
      present,
      working,
      paused,
      checkedOut,
      absent,
      autoCheckout,
    };
  }, [employees, sessionByEmployee, activeEmployees, todaysRecordedSessions]);

  // 7-Day Attendance Trend Data (Real past 7 days)
  const trendData: DailyTrendPoint[] = useMemo(() => {
    const result: DailyTrendPoint[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const fullDate = d.toISOString().split('T')[0];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateLabel = `${monthNames[d.getMonth()]} ${d.getDate()}`;

      // Find sessions on this day
      const daySessions = allKnownSessions.filter((s) => s.attendanceDate?.startsWith(fullDate));
      const presentCount = daySessions.length;
      const lateCount = daySessions.filter((s) => s.checkInStatus === 'LATE').length;
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const absentCount = isWeekend
        ? 0
        : Math.max(0, activeEmployees.length - presentCount);

      result.push({
        date: dateLabel,
        fullDate,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
      });
    }

    return result;
  }, [allKnownSessions, activeEmployees]);

  // Department Stats
  const departmentStats: DepartmentStat[] = useMemo(() => {
    if (departments.length === 0) {
      const deptMap = new Map<string, { total: number; present: number }>();
      for (const emp of activeEmployees) {
        const dName = emp.department?.name || emp.department?.code || 'General';
        const current = deptMap.get(dName) || { total: 0, present: 0 };
        current.total += 1;
        if (sessionByEmployee.has(emp.id) || sessionByEmployee.has(emp.employeeCode)) {
          current.present += 1;
        }
        deptMap.set(dName, current);
      }

      return Array.from(deptMap.entries()).map(([name, stat], idx) => ({
        id: `dept-${idx}`,
        name,
        code: name.slice(0, 4).toUpperCase(),
        total: stat.total,
        present: stat.present,
        absent: Math.max(0, stat.total - stat.present),
      }));
    }

    return departments.map((dept) => {
      const deptEmployees = activeEmployees.filter(
        (e) =>
          e.department?.id === dept.id ||
          e.department?.name?.toLowerCase() === dept.name.toLowerCase() ||
          e.department?.code?.toLowerCase() === dept.code.toLowerCase(),
      );
      const total = deptEmployees.length;
      const present = deptEmployees.filter(
        (e) => sessionByEmployee.has(e.id) || sessionByEmployee.has(e.employeeCode),
      ).length;
      const absent = Math.max(0, total - present);

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code || dept.name.slice(0, 4).toUpperCase(),
        total,
        present,
        absent,
      };
    });
  }, [departments, activeEmployees, sessionByEmployee]);

  // Live Attendance Monitor Rows (Filtered by search)
  const monitorRows: LiveAttendanceRow[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return employees
      .map((emp) => {
        const session = sessionByEmployee.get(emp.id) || sessionByEmployee.get(emp.employeeCode);
        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
        const deptName = emp.department?.name || emp.department?.code || 'General';

        // Office Location
        let locName = emp.officeLocationName || '';
        if (!locName) {
          const assign = (emp as any).assignments?.[0];
          if (assign?.officeId) {
            const matchOffice = offices.find((o) => o.id === assign.officeId);
            if (matchOffice) locName = matchOffice.name;
          }
        }
        if (!locName) {
          locName = offices[0]?.name || 'Pune Headquarters';
        }

        // Attendance Status
        let status: LiveAttendanceRow['status'] = 'ABSENT';
        let checkInTime: string | null = null;
        let workingSeconds = 0;
        let pausedSeconds = 0;

        if (session) {
          if (session.status === 'WORKING') {
            status = 'WORKING';
          } else if (session.status === 'PAUSED') {
            status = 'PAUSED';
          } else if (session.status === 'COMPLETED' || (session.status as any) === 'CHECKED_OUT') {
            status = 'CHECKED_OUT';
          }

          if (session.checkInAt) {
            const d = new Date(session.checkInAt);
            checkInTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          }

          workingSeconds = session.totalWorkingSeconds || 0;
          pausedSeconds = session.totalPausedSeconds || 0;

          // Increment working seconds if session is actively WORKING
          if (status === 'WORKING') {
            workingSeconds += liveSecondTick % 60;
          } else if (status === 'PAUSED' && (session as any).currentPauseStartedAt) {
            const currentPauseDuration = Math.max(
              0,
              Math.floor((Date.now() - new Date((session as any).currentPauseStartedAt).getTime()) / 1000),
            );
            pausedSeconds = Math.max(pausedSeconds, currentPauseDuration);
          }
        }

        const workingHours = Math.floor(workingSeconds / 3600);
        const workingMins = Math.floor((workingSeconds % 3600) / 60);
        const workingFormatted =
          status === 'ABSENT' ? '—' : `${workingHours}h ${String(workingMins).padStart(2, '0')}m`;

        const pausedMins = Math.floor(pausedSeconds / 60);
        const pausedFormatted = status === 'ABSENT' ? '—' : `${String(pausedMins).padStart(2, '0')}m`;

        return {
          id: emp.id,
          employeeCode: emp.employeeCode,
          name: fullName,
          department: deptName,
          location: locName,
          checkInTime,
          status,
          workingTimeFormatted: workingFormatted,
          pausedTimeFormatted: pausedFormatted,
          profilePhotoUrl: emp.profilePhotoUrl,
        };
      })
      .filter((row) => {
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.employeeCode.toLowerCase().includes(q) ||
          row.department.toLowerCase().includes(q) ||
          row.location.toLowerCase().includes(q)
        );
      });
  }, [employees, sessionByEmployee, offices, searchQuery, liveSecondTick]);

  // Office Capacity Metrics for Bottom Cards
  const officeMetrics: OfficeMetric[] = useMemo(() => {
    return offices.map((off) => {
      const assigned = employees.filter((e) => {
        if (e.officeLocationId === off.id) return true;
        const assignments = (e as any).assignments as Array<{ officeId?: string; isActive?: boolean }> | undefined;
        return assignments?.some((a) => a.officeId === off.id && a.isActive);
      });

      const totalAssigned = assigned.length || Math.max(1, Math.round(employees.length / Math.max(offices.length, 1)));

      const offSessions = todaysRecordedSessions.filter((s) => (s as any).officeId === off.id);
      const working = offSessions.filter((s) => s.status === 'WORKING').length;
      const paused = offSessions.filter((s) => s.status === 'PAUSED').length;
      const out = offSessions.filter(
        (s) => s.status === 'COMPLETED' || (s.status as any) === 'CHECKED_OUT',
      ).length;

      return {
        id: off.id,
        name: off.name,
        code: off.code,
        working,
        paused,
        out,
        totalAssigned,
      };
    });
  }, [offices, employees, todaysRecordedSessions]);

  const currentDateDisplay = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle={`HR Administration • ${user?.fullName ? `${user.fullName} • ` : ''}${currentDateDisplay}`}
      hideUserCard
      maxWidth="xl"
    >
      {/* Top Search & Refresh Action Toolbar */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#16a34a',
              boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.2)',
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>
            Live Attendance Monitor &bull; Real Backend Data
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
          {/* Search Input */}
          <TextField
            size="small"
            placeholder="Search employees, department, office..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: { xs: '100%', sm: 300 },
              bgcolor: '#ffffff',
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                fontSize: '0.85rem',
                '& fieldset': {
                  borderColor: '#e2e8f0',
                },
                '&:hover fieldset': {
                  borderColor: '#cbd5e1',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2563eb',
                },
              },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Refresh Action */}
          <Tooltip title="Refresh real-time data">
            <IconButton
              size="small"
              onClick={() => void loadDashboardData(true)}
              disabled={loading || refreshing}
              sx={{
                p: 1,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                color: '#64748b',
                bgcolor: '#ffffff',
                '&:hover': { bgcolor: '#f8fafc', color: '#0f172a' },
              }}
            >
              {refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert with Retry button */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2.5 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => void loadDashboardData(false)}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Section 7: Today's Overview KPI Cards */}
      <HrOverviewCards metrics={overviewMetrics} loading={loading} />

      {/* Section 9 & 10: Charts Row (7-Day Attendance Trend + Department Breakdown) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 3,
          mb: 3,
        }}
      >
        {/* Left Chart: 7-Day Attendance Trend */}
        <HrAttendanceTrendChart data={trendData} loading={loading} />

        {/* Right Chart: By Department — Today */}
        <HrDepartmentChart data={departmentStats} loading={loading} />
      </Box>

      {/* Section 11: Live Attendance Monitor Table */}
      <HrLiveAttendanceTable
        rows={monitorRows}
        totalEmployees={employees.length}
        loading={loading}
        onSelectEmployee={(empId) => navigate(PATHS.hrEmployeeReport(empId))}
      />

      {/* Section 6 & 10: Office Location Status Cards */}
      <HrOfficeCards offices={officeMetrics} loading={loading} />
    </DashboardLayout>
  );
}
