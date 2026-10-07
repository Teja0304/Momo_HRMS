import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Badge from '@mui/material/Badge';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';


import {
  fetchAttendanceHistory,
  fetchTodayAttendance,
  fetchEmployeeExceptions,
} from '../../attendance/services/attendanceService';
import { fetchEmployeeById, fetchEmployeeProfile } from '../../../services/employeeService';
import type { AttendanceSession } from '../../attendance/types/attendance';
import type { Employee } from '../../../types/employee';

interface EmployeeAttendanceReportViewProps {
  employeeId: string;
  allEmployees: Employee[];
  onSelectEmployee: (id: string) => void;
  onBack: () => void;
}

type DatePreset = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'PREV_MONTH' | 'CUSTOM';

function formatSecondsToHours(seconds: number): string {
  if (!seconds || seconds <= 0) return '0h 00m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatTimeToHhMm(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatDateString(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return 'EM';
}

function getAvatarColor(name: string): string {
  const colors = [
    '#059669', '#2563eb', '#dc2626', '#16a34a',
    '#0891b2', '#7c3aed', '#d97706', '#db2777',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const EmployeeAttendanceReportView: React.FC<EmployeeAttendanceReportViewProps> = ({
  employeeId,
  allEmployees,
  onSelectEmployee,
  onBack,
}) => {
  // Active Tab: 0 = Overview & Analytics, 1 = Daily Attendance, 2 = Calendar, 3 = Special & Exceptions, 4 = Policies
  const [activeTab, setActiveTab] = useState(0);

  // Date Preset & Range State
  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');

  const getPresetRange = (type: DatePreset) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (type === 'TODAY') {
      return { start: todayStr, end: todayStr };
    }
    if (type === 'THIS_WEEK') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      return {
        start: monday.toISOString().split('T')[0],
        end: todayStr,
      };
    }
    if (type === 'THIS_MONTH') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: firstOfMonth.toISOString().split('T')[0],
        end: todayStr,
      };
    }
    if (type === 'PREV_MONTH') {
      const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: firstOfPrevMonth.toISOString().split('T')[0],
        end: lastOfPrevMonth.toISOString().split('T')[0],
      };
    }
    return {
      start: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: todayStr,
    };
  };

  const initialRange = useMemo(() => getPresetRange('THIS_MONTH'), []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  // Employee Profile & Attendance State
  const [employee, setEmployee] = useState<Employee | null | undefined>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded daily timeline rows & selected calendar date
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Load employee details and real attendance history
  const loadReportData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        let empObj: Employee | undefined = allEmployees.find(
          (e) => e.id === employeeId || e.employeeCode === employeeId,
        );
        if (!empObj) {
          try {
            const profileRes = await fetchEmployeeProfile(employeeId);
            empObj = profileRes?.employee;
          } catch {
            const fetched = await fetchEmployeeById(employeeId).catch(() => null);
            empObj = fetched || undefined;
          }
        }
        setEmployee(empObj || undefined);

        const targetId = empObj?.id || employeeId;
        const targetCode = empObj?.employeeCode;

        const historyPromise = fetchAttendanceHistory({
          employeeId: targetId,
          startDate,
          endDate,
          page: 1,
          limit: 500,
        }).catch(async () => {
          if (targetCode && targetCode !== targetId) {
            return fetchAttendanceHistory({
              employeeId: targetCode,
              startDate,
              endDate,
              page: 1,
              limit: 500,
            });
          }
          return { items: [], page: 1, limit: 500, total: 0, totalPages: 1 };
        });

        const todayPromise = fetchTodayAttendance({
          employeeId: targetId,
        }).catch(() => null);

        const exceptionsPromise = fetchEmployeeExceptions(targetId).catch(() => []);

        const [historyRes, todayRes, exRes] = await Promise.all([
          historyPromise,
          todayPromise,
          exceptionsPromise,
        ]);

        const historyItems = historyRes?.items || [];
        const todaySessions = todayRes?.sessions || [];

        const mergedMap = new Map<string, AttendanceSession>();
        for (const s of historyItems) {
          mergedMap.set(s.id, s);
        }
        for (const s of todaySessions) {
          if (!mergedMap.has(s.id)) {
            mergedMap.set(s.id, s);
          }
        }

        const sortedSessions = Array.from(mergedMap.values()).sort((a, b) => {
          const dCompare = b.attendanceDate.localeCompare(a.attendanceDate);
          if (dCompare !== 0) return dCompare;
          return new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime();
        });

        setSessions(sortedSessions);
        setExceptions(Array.isArray(exRes) ? exRes : []);
      } catch (err) {
        console.error('Failed to load employee attendance report:', err);
        setError('Unable to load attendance data. Please check connection and retry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [employeeId, allEmployees, startDate, endDate],
  );

  useEffect(() => {
    void loadReportData(false);
  }, [loadReportData]);

  const handleSelectPreset = (type: DatePreset) => {
    setPreset(type);
    if (type !== 'CUSTOM') {
      const range = getPresetRange(type);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setPreset('CUSTOM');
    setStartDate(start);
    setEndDate(end);
  };

  const toggleSessionTimeline = (sessionId: string) => {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  // --- Aggregate Metrics (100% Real Backend Data) ---
  const metrics = useMemo(() => {
    const uniqueDatesWithAttendance = new Set(sessions.map((s) => s.attendanceDate));
    const presentDays = uniqueDatesWithAttendance.size;

    const totalWorkingSeconds = sessions.reduce((acc, s) => acc + (s.totalWorkingSeconds || 0), 0);
    const regularWorkingSeconds = sessions.reduce(
      (acc, s) => acc + (s.regularWorkingSeconds ?? (s.totalWorkingSeconds - (s.specialConditionSeconds || 0))),
      0,
    );
    const specialConditionSeconds = sessions.reduce((acc, s) => acc + (s.specialConditionSeconds || 0), 0);
    const avgWorkingSeconds = presentDays > 0 ? Math.round(totalWorkingSeconds / presentDays) : 0;

    const lateSessions = sessions.filter((s) => s.checkInStatus === 'LATE');
    const lateDays = new Set(lateSessions.map((s) => s.attendanceDate)).size;

    const autoCheckoutSessions = sessions.filter(
      (s) =>
        s.checkoutType === 'AUTO_CHECKOUT' ||
        (s.checkoutType as any) === 'AUTO' ||
        s.checkoutReason === 'GEOFENCE_TIMEOUT',
    );
    const autoCheckoutDays = new Set(autoCheckoutSessions.map((s) => s.attendanceDate)).size;

    const approvedSpecialExceptions = exceptions.filter(
      (ex) => ex.type === 'WORKING_TIME_ADJUSTMENT' && ex.status === 'APPROVED',
    );

    let totalCalendarDays = 1;
    try {
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        totalCalendarDays = Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
      }
    } catch {
      totalCalendarDays = 1;
    }

    const attendanceRate = totalCalendarDays > 0 ? Math.min(100, Math.round((presentDays / totalCalendarDays) * 100)) : 0;

    return {
      presentDays,
      totalWorkingSeconds,
      regularWorkingSeconds,
      specialConditionSeconds,
      avgWorkingSeconds,
      lateDays,
      autoCheckoutDays,
      approvedSpecialExceptions,
      totalCalendarDays,
      attendanceRate,
    };
  }, [sessions, exceptions, startDate, endDate]);

  // --- Weekly Working Hours Bar Chart Data ---
  const weeklyChartData = useMemo(() => {
    const end = new Date(endDate);
    const result: Array<{
      dayName: string;
      dateStr: string;
      regularHours: number;
      specialHours: number;
      totalHours: number;
      isLate: boolean;
      sessionCount: number;
    }> = [];

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = d.toISOString().split('T')[0];
      const dayName = `${dayLabels[d.getDay()]} ${d.getDate()}`;

      const daySessions = sessions.filter((s) => s.attendanceDate === dStr);
      const regSec = daySessions.reduce(
        (acc, s) => acc + (s.regularWorkingSeconds ?? (s.totalWorkingSeconds - (s.specialConditionSeconds || 0))),
        0,
      );
      const spSec = daySessions.reduce((acc, s) => acc + (s.specialConditionSeconds || 0), 0);
      const totSec = daySessions.reduce((acc, s) => acc + (s.totalWorkingSeconds || 0), 0);
      const isLate = daySessions.some((s) => s.checkInStatus === 'LATE');

      result.push({
        dayName,
        dateStr: dStr,
        regularHours: parseFloat((regSec / 3600).toFixed(1)),
        specialHours: parseFloat((spSec / 3600).toFixed(1)),
        totalHours: parseFloat((totSec / 3600).toFixed(1)),
        isLate,
        sessionCount: daySessions.length,
      });
    }

    return result;
  }, [sessions, endDate]);

  // --- Monthly Working Hours Trend Data ---
  const monthlyTrendData = useMemo(() => {
    const datesMap = new Map<string, { regularHours: number; specialHours: number; totalHours: number; isLate: boolean }>();

    for (const s of sessions) {
      const prev = datesMap.get(s.attendanceDate) || { regularHours: 0, specialHours: 0, totalHours: 0, isLate: false };
      const reg = (s.regularWorkingSeconds ?? (s.totalWorkingSeconds - (s.specialConditionSeconds || 0))) / 3600;
      const sp = (s.specialConditionSeconds || 0) / 3600;
      const tot = (s.totalWorkingSeconds || 0) / 3600;
      prev.regularHours += reg;
      prev.specialHours += sp;
      prev.totalHours += tot;
      if (s.checkInStatus === 'LATE') prev.isLate = true;
      datesMap.set(s.attendanceDate, prev);
    }

    const sortedDates = Array.from(datesMap.keys()).sort();
    return sortedDates.map((dStr) => {
      const stat = datesMap.get(dStr)!;
      const d = new Date(dStr);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
      return {
        dateStr: dStr,
        label,
        regularHours: parseFloat(stat.regularHours.toFixed(1)),
        specialHours: parseFloat(stat.specialHours.toFixed(1)),
        totalHours: parseFloat(stat.totalHours.toFixed(1)),
        isLate: stat.isLate,
      };
    });
  }, [sessions]);

  // --- Calendar Grid for Selected Month ---
  const calendarDays = useMemo(() => {
    const activeDate = selectedCalendarDate ? new Date(selectedCalendarDate) : new Date(endDate);
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      session?: AttendanceSession;
      hasSpecialCondition: boolean;
      isLate: boolean;
      totalHours: string;
    }> = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, 1 - (startingDayOfWeek - i));
      days.push({
        dateStr: prevDate.toISOString().split('T')[0],
        dayNumber: prevDate.getDate(),
        isCurrentMonth: false,
        hasSpecialCondition: false,
        isLate: false,
        totalHours: '0h',
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dStr = curDate.toISOString().split('T')[0];
      const matchSession = sessions.find((s) => s.attendanceDate === dStr);
      const hasSpecial = matchSession?.hasSpecialCondition || (matchSession?.specialConditionSeconds || 0) > 0;
      const isLate = matchSession?.checkInStatus === 'LATE';
      const hoursStr = matchSession ? formatSecondsToHours(matchSession.totalWorkingSeconds) : '—';

      days.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: true,
        session: matchSession,
        hasSpecialCondition: !!hasSpecial,
        isLate,
        totalHours: hoursStr,
      });
    }

    return {
      monthLabel: activeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      days,
    };
  }, [selectedCalendarDate, endDate, sessions]);

  // Selected Day Sessions for Calendar Day Inspection
  const selectedDaySessions = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return sessions.filter((s) => s.attendanceDate === selectedCalendarDate);
  }, [selectedCalendarDate, sessions]);

  // Client-Side CSV Export
  const handleExportCsv = () => {

    if (sessions.length === 0) return;

    const headers = [
      'Date',
      'Employee Code',
      'Employee Name',
      'Check-In Time',
      'Check-Out Time',
      'Regular Working Hours',
      'Special Condition Hours',
      'Total Working Hours',
      'Attendance Status',
      'Punctuality',
      'Checkout Type',
      'Checkout Reason',
      'Special Condition Reason',
    ];

    const empName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Employee';
    const empCode = employee?.employeeCode || employeeId;

    const rows = sessions.map((s) => {
      const regHours = (
        (s.regularWorkingSeconds ?? (s.totalWorkingSeconds - (s.specialConditionSeconds || 0))) / 3600
      ).toFixed(2);
      const spHours = ((s.specialConditionSeconds || 0) / 3600).toFixed(2);
      const totHours = (s.totalWorkingSeconds / 3600).toFixed(2);

      return [
        `"${s.attendanceDate}"`,
        `"${empCode}"`,
        `"${empName}"`,
        `"${formatTimeToHhMm(s.checkInAt)}"`,
        `"${formatTimeToHhMm(s.checkOutAt)}"`,
        `"${regHours}h"`,
        `"${spHours}h"`,
        `"${totHours}h"`,
        `"${s.status}"`,
        `"${s.checkInStatus}"`,
        `"${s.checkoutType || 'NORMAL'}"`,
        `"${s.checkoutReason || '—'}"`,
        `"${(s.specialConditionReason || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Report_${empCode}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const employeeFullName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Employee';
  const employeeCode = employee?.employeeCode || employeeId;
  const departmentName = employee?.department?.name || employee?.department?.code || 'General';
  const designationTitle = (employee as any)?.designation?.title || (employee as any)?.jobTitle || 'Associate';
  const employmentStatus = (employee as any)?.employmentStatus || (employee as any)?.status || 'ACTIVE';
  const officeLocation = (employee as any)?.officeLocationName || 'Pune Headquarters';

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      {/* 1. Compact Executive Banner & Integrated Controls */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          mb: 2.5,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Top Control Bar: Back Button, Switcher, Export */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            pb: 2,
            borderBottom: '1px solid #f1f5f9',
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={onBack}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                color: '#475569',
                borderColor: '#cbd5e1',
                bgcolor: '#f8fafc',
                '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' },
              }}
            >
              Back to Dashboard
            </Button>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
              HR Dashboard &bull; Attendance Analytics
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="select-emp-label">Switch Employee</InputLabel>
              <Select
                labelId="select-emp-label"
                value={employee?.id || employeeId}
                label="Switch Employee"
                onChange={(e) => onSelectEmployee(e.target.value)}
                sx={{ borderRadius: 2, fontSize: '0.84rem' }}
              >
                {allEmployees.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tooltip title="Download CSV Report">
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportCsv}
                disabled={loading || sessions.length === 0}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#059669',
                  borderColor: '#a7f3d0',
                  bgcolor: '#f0fdf4',
                  '&:hover': { bgcolor: '#dcfce7', borderColor: '#34d399' },
                }}
              >
                Export CSV
              </Button>
            </Tooltip>

            <Tooltip title="Refresh Attendance Data">
              <IconButton
                size="small"
                onClick={() => void loadReportData(true)}
                disabled={loading || refreshing}
                sx={{
                  p: 0.8,
                  border: '1px solid #e2e8f0',
                  borderRadius: 2,
                  color: '#64748b',
                  '&:hover': { bgcolor: '#f8fafc', color: '#0f172a' },
                }}
              >
                <RefreshIcon fontSize="small" sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Profile + Date Filters in ONE Horizontal Row */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            alignItems: { xs: 'flex-start', lg: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Employee Avatar + Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={employee?.profilePhotoUrl || undefined}
              sx={{
                width: 48,
                height: 48,
                bgcolor: getAvatarColor(employeeFullName),
                fontWeight: 800,
                fontSize: '1.1rem',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              {getInitials(employee?.firstName, employee?.lastName)}
            </Avatar>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.15rem', lineHeight: 1.2 }}>
                  {employeeFullName}
                </Typography>
                <Chip
                  label={employeeCode}
                  size="small"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    bgcolor: '#f1f5f9',
                    color: '#334155',
                    fontSize: '0.72rem',
                    height: 22,
                  }}
                />
                <Chip
                  label={employmentStatus}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: employmentStatus === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                    color: employmentStatus === 'ACTIVE' ? '#15803d' : '#b91c1c',
                    fontSize: '0.68rem',
                    height: 22,
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mt: 0.3, display: 'block' }}>
                {designationTitle} &bull; {departmentName} &bull; {officeLocation}
              </Typography>
            </Box>
          </Box>

          {/* Integrated Date Filter Strip */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
              bgcolor: '#f8fafc',
              p: 1,
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {(['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'PREV_MONTH', 'CUSTOM'] as DatePreset[]).map((p) => {
                const labelMap: Record<DatePreset, string> = {
                  TODAY: 'Today',
                  THIS_WEEK: 'Week',
                  THIS_MONTH: 'This Month',
                  PREV_MONTH: 'Prev Month',
                  CUSTOM: 'Custom',
                };
                const isSelected = preset === p;
                return (
                  <Button
                    key={p}
                    size="small"
                    onClick={() => handleSelectPreset(p)}
                    sx={{
                      borderRadius: 1.8,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      py: 0.3,
                      px: 1.2,
                      minWidth: 'auto',
                      bgcolor: isSelected ? '#0f172a' : 'transparent',
                      color: isSelected ? '#ffffff' : '#64748b',
                      '&:hover': {
                        bgcolor: isSelected ? '#1e293b' : '#f1f5f9',
                      },
                    }}
                  >
                    {labelMap[p]}
                  </Button>
                );
              })}
            </Box>

            {/* Compact Dates */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <TextField
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
                sx={{
                  width: 135,
                  '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.78rem' },
                }}
              />
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                &ndash;
              </Typography>
              <TextField
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
                sx={{
                  width: 135,
                  '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.78rem' },
                }}
              />
            </Box>
          </Box>
        </Box>
      </Card>

      {/* 2. Modern Segmented Tab Bar (Eliminating Endless Scrolling) */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          mb: 2.5,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1.5,
            borderBottom: '1px solid #f1f5f9',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.86rem',
              py: 1.8,
              minHeight: 52,
              color: '#64748b',
              '&.Mui-selected': {
                color: '#2563eb',
              },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              bgcolor: '#2563eb',
            },
          }}
        >
          <Tab
            icon={<AssessmentOutlinedIcon sx={{ fontSize: '1.1rem' }} />}
            iconPosition="start"
            label="Overview & Analytics"
          />
          <Tab
            icon={
              <Badge
                badgeContent={sessions.length}
                color="primary"
                max={99}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
              >
                <TableChartOutlinedIcon sx={{ fontSize: '1.1rem' }} />
              </Badge>
            }
            iconPosition="start"
            label="Daily Attendance"
          />
          <Tab
            icon={<CalendarMonthOutlinedIcon sx={{ fontSize: '1.1rem' }} />}
            iconPosition="start"
            label="Attendance Calendar"
          />
          <Tab
            icon={
              <Badge
                badgeContent={metrics.approvedSpecialExceptions.length}
                color="secondary"
                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
              >
                <VerifiedOutlinedIcon sx={{ fontSize: '1.1rem' }} />
              </Badge>
            }
            iconPosition="start"
            label="Special Conditions & Exceptions"
          />
          <Tab
            icon={<InfoOutlinedIcon sx={{ fontSize: '1.1rem' }} />}
            iconPosition="start"
            label="Policy & Leave Info"
          />
        </Tabs>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5, borderRadius: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => void loadReportData(false)}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* =========================================================================
          TAB 0: OVERVIEW & ANALYTICS
          ========================================================================= */}
      {activeTab === 0 && (
        <Box>
          {/* Compact 4 KPI Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 2.5,
            }}
          >
            {/* Card 1: Attendance Rate */}
            <Card
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Attendance Rate
                </Typography>
                <Box sx={{ p: 0.6, borderRadius: 1.5, bgcolor: '#ecfdf5', color: '#059669' }}>
                  <CheckCircleOutlinedIcon sx={{ fontSize: '1rem' }} />
                </Box>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={80} height={36} />
              ) : (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {metrics.attendanceRate}%
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>
                    <strong>{metrics.presentDays}</strong> present of {metrics.totalCalendarDays} days
                  </Typography>
                </>
              )}
            </Card>

            {/* Card 2: Total Working Hours */}
            <Card
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Working Hours
                </Typography>
                <Box sx={{ p: 0.6, borderRadius: 1.5, bgcolor: '#eff6ff', color: '#2563eb' }}>
                  <WorkHistoryOutlinedIcon sx={{ fontSize: '1rem' }} />
                </Box>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={80} height={36} />
              ) : (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {formatSecondsToHours(metrics.totalWorkingSeconds)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>
                    Avg: <strong>{formatSecondsToHours(metrics.avgWorkingSeconds)}</strong> / present day
                  </Typography>
                </>
              )}
            </Card>

            {/* Card 3: Special Condition */}
            <Card
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Special Condition
                </Typography>
                <Box sx={{ p: 0.6, borderRadius: 1.5, bgcolor: '#fdf4ff', color: '#9333ea' }}>
                  <VerifiedOutlinedIcon sx={{ fontSize: '1rem' }} />
                </Box>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={80} height={36} />
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#7e22ce' }}>
                      +{formatSecondsToHours(metrics.specialConditionSeconds)}
                    </Typography>
                    <Chip
                      label="HR Approved"
                      size="small"
                      sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: '#f3e8ff', color: '#7e22ce' }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>
                    Regular: {formatSecondsToHours(metrics.regularWorkingSeconds)} &bull; {metrics.approvedSpecialExceptions.length} request(s)
                  </Typography>
                </>
              )}
            </Card>

            {/* Card 4: Punctuality & Exceptions */}
            <Card
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Punctuality & Auto-Out
                </Typography>
                <Box sx={{ p: 0.6, borderRadius: 1.5, bgcolor: '#fffbeb', color: '#d97706' }}>
                  <ScheduleIcon sx={{ fontSize: '1rem' }} />
                </Box>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={80} height={36} />
              ) : (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: metrics.lateDays > 0 ? '#d97706' : '#15803d' }}>
                    {metrics.lateDays} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>late day(s)</span>
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>
                    Auto-Checkouts: <strong>{metrics.autoCheckoutDays}</strong> session(s)
                  </Typography>
                </>
              )}
            </Card>
          </Box>

          {/* Working Hours Visuals Row: Weekly Distribution & Monthly Trend */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {/* Left: Weekly Bar Chart */}
            <Card
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                Weekly Working Hours (Mon &ndash; Sun)
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 2 }}>
                Real working hours calculated from checked-in and approved sessions
              </Typography>

              {loading ? (
                <Skeleton variant="rectangular" width="100%" height={150} sx={{ borderRadius: 2 }} />
              ) : (
                <Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${weeklyChartData.length}, 1fr)`,
                      gap: 1,
                      height: 140,
                      alignItems: 'flex-end',
                      pb: 1,
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {weeklyChartData.map((bar) => {
                      const maxBarHours = Math.max(...weeklyChartData.map((b) => b.totalHours), 10);
                      const heightPercent = Math.max(8, Math.min(100, Math.round((bar.totalHours / maxBarHours) * 100)));
                      const hasHours = bar.totalHours > 0;

                      return (
                        <Box
                          key={bar.dateStr}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              color: hasHours ? '#0f172a' : '#cbd5e1',
                              mb: 0.5,
                            }}
                          >
                            {hasHours ? `${bar.totalHours}h` : '—'}
                          </Typography>

                          <Box
                            sx={{
                              width: '100%',
                              maxWidth: 32,
                              height: `${heightPercent}%`,
                              borderRadius: '4px 4px 0 0',
                              bgcolor: !hasHours
                                ? '#f1f5f9'
                                : bar.specialHours > 0
                                ? '#7e22ce'
                                : bar.isLate
                                ? '#d97706'
                                : '#16a34a',
                              transition: 'height 0.3s ease',
                            }}
                          />

                          <Typography
                            variant="caption"
                            sx={{
                              mt: 0.8,
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              color: '#64748b',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {bar.dayName}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Chart Legend */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#16a34a' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.72rem' }}>
                        On-Time
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#d97706' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.72rem' }}>
                        Late Arrival
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#7e22ce' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.72rem' }}>
                        Special Condition (+Xh)
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </Card>

            {/* Right: Monthly Working Hours Trend Line */}
            <Card
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                Working Hours Trend Across Period
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 2 }}>
                Consistency of daily attendance hours in the selected range
              </Typography>

              {loading ? (
                <Skeleton variant="rectangular" width="100%" height={150} sx={{ borderRadius: 2 }} />
              ) : monthlyTrendData.length === 0 ? (
                <Box
                  sx={{
                    height: 140,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f8fafc',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                    No sessions recorded in this period to plot trend.
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5 }}>
                    Select "Previous Month" or "Custom Range" to inspect past attendance records.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ height: 160, width: '100%' }}>
                  {(() => {
                    const maxH = Math.max(...monthlyTrendData.map((d) => d.totalHours), 10);
                    const yMax = Math.ceil(maxH / 2) * 2;
                    const w = 450;
                    const h = 140;
                    const padL = 30;
                    const padR = 15;
                    const padT = 15;
                    const padB = 25;
                    const cw = w - padL - padR;
                    const ch = h - padT - padB;

                    const getX = (idx: number) => padL + (idx / Math.max(monthlyTrendData.length - 1, 1)) * cw;
                    const getY = (val: number) => padT + ch - (val / yMax) * ch;

                    let pathD = `M ${getX(0)} ${getY(monthlyTrendData[0].totalHours)}`;
                    for (let i = 1; i < monthlyTrendData.length; i++) {
                      pathD += ` L ${getX(i)} ${getY(monthlyTrendData[i].totalHours)}`;
                    }

                    return (
                      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }}>
                        {[0, yMax / 2, yMax].map((tick) => (
                          <g key={tick}>
                            <line
                              x1={padL}
                              y1={getY(tick)}
                              x2={w - padR}
                              y2={getY(tick)}
                              stroke="#f1f5f9"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={padL - 6}
                              y={getY(tick) + 3}
                              textAnchor="end"
                              fill="#94a3b8"
                              fontSize="8"
                              fontWeight="600"
                            >
                              {tick}h
                            </text>
                          </g>
                        ))}
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {monthlyTrendData.map((pt, idx) => (
                          <g key={pt.dateStr}>
                            <circle
                              cx={getX(idx)}
                              cy={getY(pt.totalHours)}
                              r={3.5}
                              fill={pt.specialHours > 0 ? '#9333ea' : '#2563eb'}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                            <text
                              x={getX(idx)}
                              y={h - 6}
                              textAnchor="middle"
                              fill="#64748b"
                              fontSize="8"
                              fontWeight="600"
                            >
                              {pt.label}
                            </text>
                          </g>
                        ))}
                      </svg>
                    );
                  })()}
                </Box>
              )}
            </Card>
          </Box>
        </Box>
      )}

      {/* =========================================================================
          TAB 1: DAILY ATTENDANCE & VISUAL TIMELINE
          ========================================================================= */}
      {activeTab === 1 && (
        <Card
          elevation={0}
          sx={{
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              p: 2,
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Daily Attendance Records ({sessions.length})
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              Click row arrow to inspect daily check-in, pauses & return timeline
            </Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Date</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Check-In</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Check-Out</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Regular</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Special Condition</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Final Hours</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Punctuality</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Status</TableCell>
                  <TableCell align="right" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', py: 1.2 }}>Timeline</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  [1, 2, 3].map((n) => (
                    <TableRow key={n}>
                      <TableCell><Skeleton variant="text" width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" width={50} /></TableCell>
                      <TableCell><Skeleton variant="text" width={50} /></TableCell>
                      <TableCell><Skeleton variant="text" width={50} /></TableCell>
                      <TableCell><Skeleton variant="text" width={60} /></TableCell>
                      <TableCell><Skeleton variant="text" width={50} /></TableCell>
                      <TableCell><Skeleton variant="text" width={60} /></TableCell>
                      <TableCell><Skeleton variant="text" width={60} /></TableCell>
                      <TableCell align="right"><Skeleton variant="circular" width={20} height={20} sx={{ ml: 'auto' }} /></TableCell>
                    </TableRow>
                  ))
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                        No attendance records found for this period.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => {
                    const isExpanded = expandedSessionIds.has(session.id);
                    const hasSpecial = session.hasSpecialCondition || (session.specialConditionSeconds || 0) > 0;
                    const regSec =
                      session.regularWorkingSeconds ??
                      session.totalWorkingSeconds - (session.specialConditionSeconds || 0);
                    const spSec = session.specialConditionSeconds || 0;
                    const isAutoCheckout =
                      session.checkoutType === 'AUTO_CHECKOUT' ||
                      (session.checkoutType as any) === 'AUTO' ||
                      session.checkoutReason === 'GEOFENCE_TIMEOUT';

                    return (
                      <React.Fragment key={session.id}>
                        <TableRow
                          hover
                          sx={{
                            '&:last-child td, &:last-child th': { border: 0 },
                            bgcolor: isExpanded ? '#f8fafc' : 'transparent',
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                            {formatDateString(session.attendanceDate)}
                          </TableCell>
                          <TableCell sx={{ color: '#0f172a', fontWeight: 600, fontSize: '0.82rem' }}>
                            {formatTimeToHhMm(session.checkInAt)}
                          </TableCell>
                          <TableCell sx={{ color: session.checkOutAt ? '#0f172a' : '#94a3b8', fontWeight: 600, fontSize: '0.82rem' }}>
                            {formatTimeToHhMm(session.checkOutAt)}
                            {isAutoCheckout && (
                              <Chip
                                label="Auto"
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.58rem',
                                  fontWeight: 700,
                                  bgcolor: '#fee2e2',
                                  color: '#b91c1c',
                                  ml: 0.5,
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ color: '#475569', fontWeight: 600, fontSize: '0.82rem' }}>
                            {formatSecondsToHours(regSec)}
                          </TableCell>
                          <TableCell>
                            {hasSpecial ? (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#7e22ce' }}>
                                  +{formatSecondsToHours(spSec)}
                                </Typography>
                                <Chip
                                  label="Approved"
                                  size="small"
                                  sx={{
                                    height: 16,
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    bgcolor: '#f3e8ff',
                                    color: '#7e22ce',
                                  }}
                                />
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                            {formatSecondsToHours(session.totalWorkingSeconds)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={session.checkInStatus === 'LATE' ? 'Late' : 'On-Time'}
                              size="small"
                              sx={{
                                height: 20,
                                fontWeight: 700,
                                fontSize: '0.68rem',
                                bgcolor: session.checkInStatus === 'LATE' ? '#fef3c7' : '#dcfce7',
                                color: session.checkInStatus === 'LATE' ? '#b45309' : '#15803d',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={session.status}
                              size="small"
                              sx={{
                                height: 20,
                                fontWeight: 700,
                                fontSize: '0.68rem',
                                bgcolor:
                                  session.status === 'WORKING'
                                    ? '#dcfce7'
                                    : session.status === 'PAUSED'
                                    ? '#fef3c7'
                                    : '#f1f5f9',
                                color:
                                  session.status === 'WORKING'
                                    ? '#15803d'
                                    : session.status === 'PAUSED'
                                    ? '#b45309'
                                    : '#334155',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => toggleSessionTimeline(session.id)}
                              sx={{ color: '#64748b' }}
                            >
                              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                        </TableRow>

                        {/* Collapsible Daily Visual Timeline */}
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 2, px: 2.5, bgcolor: '#f8fafc', borderRadius: 2, my: 1, border: '1px solid #e2e8f0' }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a', display: 'block', mb: 1 }}>
                                  Timeline &bull; {formatDateString(session.attendanceDate)}
                                </Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, position: 'relative', pl: 2, borderLeft: '2px solid #cbd5e1' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#16a34a', ml: -2.4 }} />
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                      {formatTimeToHhMm(session.checkInAt)} &mdash; CHECK-IN ({session.checkInStatus === 'LATE' ? 'Late Arrival' : 'On-Time'})
                                    </Typography>
                                  </Box>

                                  {session.pauses && session.pauses.length > 0 ? (
                                    session.pauses.map((pause, pIdx) => (
                                      <Box key={pause.id || pIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#d97706', ml: -2.3 }} />
                                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                                          {formatTimeToHhMm(pause.startedAt)} to {formatTimeToHhMm(pause.endedAt)} &mdash; Geofence Exit / Pause ({formatSecondsToHours(pause.durationSeconds || 0)})
                                        </Typography>
                                      </Box>
                                    ))
                                  ) : null}

                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: session.checkOutAt ? '#2563eb' : '#94a3b8', ml: -2.4 }} />
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                      {formatTimeToHhMm(session.checkOutAt)} &mdash;{' '}
                                      {session.checkOutAt
                                        ? isAutoCheckout
                                          ? 'AUTO CHECK-OUT (Geofence Timeout)'
                                          : 'CHECK-OUT'
                                        : 'SESSION ACTIVE'}
                                    </Typography>
                                  </Box>

                                  {hasSpecial && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#9333ea', ml: -2.4 }} />
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#7e22ce' }}>
                                        +{formatSecondsToHours(spSec)} &mdash; Special Condition Working Hours (HR Approved)
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* =========================================================================
          TAB 2: ATTENDANCE CALENDAR (Compact Grid + Sidebar)
          ========================================================================= */}
      {activeTab === 2 && (
        <Card
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '7fr 3fr' },
              gap: 2.5,
            }}
          >
            {/* Left: Compact Calendar */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                Monthly Calendar &bull; {calendarDays.monthLabel}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 2 }}>
                Click a day to view that day's session details on the right panel
              </Typography>

              {/* Day Labels */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.8, textAlign: 'center', mb: 0.8 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <Typography key={d} variant="caption" sx={{ fontWeight: 800, color: '#94a3b8', fontSize: '0.72rem' }}>
                    {d}
                  </Typography>
                ))}
              </Box>

              {/* Calendar Cells */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.8 }}>
                {calendarDays.days.map((day, idx) => {
                  const hasSession = !!day.session;
                  const isSelected = selectedCalendarDate === day.dateStr;

                  return (
                    <Box
                      key={`${day.dateStr}-${idx}`}
                      onClick={() => {
                        if (hasSession) {
                          setSelectedCalendarDate((prev) => (prev === day.dateStr ? null : day.dateStr));
                        }
                      }}
                      sx={{
                        minHeight: 46,
                        p: 0.8,
                        borderRadius: 2,
                        border: isSelected ? '2px solid #2563eb' : '1px solid #f1f5f9',
                        bgcolor: isSelected
                          ? '#eff6ff'
                          : hasSession
                          ? day.hasSpecialCondition
                            ? '#faf5ff'
                            : day.isLate
                            ? '#fffbeb'
                            : '#f0fdf4'
                          : '#ffffff',
                        opacity: day.isCurrentMonth ? 1 : 0.4,
                        cursor: hasSession ? 'pointer' : 'default',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                        '&:hover': hasSession ? { borderColor: '#93c5fd' } : {},
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: hasSession ? '#0f172a' : '#94a3b8', fontSize: '0.75rem' }}>
                          {day.dayNumber}
                        </Typography>
                        {hasSession && (
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: day.hasSpecialCondition ? '#9333ea' : day.isLate ? '#d97706' : '#16a34a',
                            }}
                          />
                        )}
                      </Box>
                      {hasSession && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: day.hasSpecialCondition ? '#7e22ce' : day.isLate ? '#b45309' : '#15803d',
                          }}
                        >
                          {day.totalHours}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Right: Selected Day Inspection Panel */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #e2e8f0', minHeight: 260 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5 }}>
                {selectedCalendarDate ? formatDateString(selectedCalendarDate) : 'Day Details'}
              </Typography>

              {!selectedCalendarDate ? (
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 2 }}>
                  Click any highlighted date tile on the calendar to inspect that day's session breakdown and timeline.
                </Typography>
              ) : selectedDaySessions.length === 0 ? (
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  No sessions on this date.
                </Typography>
              ) : (
                selectedDaySessions.map((s) => (
                  <Box key={s.id} sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0', mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', display: 'block' }}>
                      Check-In: {formatTimeToHhMm(s.checkInAt)} &bull; Out: {formatTimeToHhMm(s.checkOutAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3 }}>
                      Total Hours: <strong>{formatSecondsToHours(s.totalWorkingSeconds)}</strong>
                    </Typography>
                    <Chip
                      size="small"
                      label={s.checkInStatus === 'LATE' ? 'Late Arrival' : 'On-Time'}
                      color={s.checkInStatus === 'LATE' ? 'warning' : 'success'}
                      sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, mt: 0.8 }}
                    />
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Card>
      )}

      {/* =========================================================================
          TAB 3: SPECIAL CONDITIONS & EXCEPTIONS
          ========================================================================= */}
      {activeTab === 3 && (
        <Card
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                HR Approved Special Working Hours ({exceptions.filter((ex) => ex.type === 'WORKING_TIME_ADJUSTMENT').length})
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                Approved adjustments added exactly once into total working hours without double counting
              </Typography>
            </Box>
            <Chip
              label="Single-Addition Policy Active"
              size="small"
              sx={{ fontWeight: 700, bgcolor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', height: 22 }}
              variant="outlined"
            />
          </Box>

          {exceptions.filter((ex) => ex.type === 'WORKING_TIME_ADJUSTMENT').length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>
                No special condition working-hours requests found for this employee.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem' }}>Date</TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem' }}>Added Hours</TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem' }}>Employee Reason</TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem' }}>Decision</TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem' }}>Approval Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exceptions
                    .filter((ex) => ex.type === 'WORKING_TIME_ADJUSTMENT')
                    .map((ex) => {
                      const meta = (ex.metadata as any) || {};
                      const addHours =
                        meta.additionalHours ||
                        (meta.additionalSeconds ? (meta.additionalSeconds / 3600).toFixed(1) : '1');

                      return (
                        <TableRow key={ex.id}>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{formatDateString(ex.attendanceDate)}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#7e22ce', fontSize: '0.85rem' }}>+{addHours}h</TableCell>
                          <TableCell sx={{ color: '#475569', maxWidth: 280, fontSize: '0.82rem' }}>{ex.reason || '—'}</TableCell>
                          <TableCell>
                            <Chip
                              label={ex.status}
                              size="small"
                              sx={{
                                height: 20,
                                fontWeight: 700,
                                fontSize: '0.68rem',
                                bgcolor: ex.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                                color: ex.status === 'APPROVED' ? '#15803d' : '#b91c1c',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', fontSize: '0.78rem' }}>{formatDateString(ex.approvedAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      {/* =========================================================================
          TAB 4: POLICY & LEAVE INFO
          ========================================================================= */}
      {activeTab === 4 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
              <Box sx={{ p: 0.6, borderRadius: 1.5, bgcolor: '#f1f5f9', color: '#64748b' }}>
                <EventBusyOutlinedIcon sx={{ fontSize: '1rem' }} />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Leave Tracking & Balances
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.5, display: 'block' }}>
              Leave application records and leave balances (Casual, Sick, Annual) are not maintained in the current backend database. In accordance with Momo HRMS data integrity rules, no simulated or placeholder leave values are displayed.
            </Typography>
          </Card>

          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
              <Box sx={{ p: 0.6, borderRadius: 1.5, bgcolor: '#f1f5f9', color: '#64748b' }}>
                <InfoOutlinedIcon sx={{ fontSize: '1rem' }} />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Holidays & Days Off
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.5, display: 'block' }}>
              Company holiday rosters are not configured in the backend service. Days with no attendance session are strictly categorized as <strong>"No Attendance Record"</strong> rather than an unexcused absence.
            </Typography>
          </Card>
        </Box>
      )}
    </Box>
  );
};
