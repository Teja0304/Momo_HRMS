import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';

export interface DailyTrendPoint {
  date: string; // e.g. "Sep 28"
  fullDate: string; // "2026-09-28"
  present: number;
  absent: number;
  late: number;
}

interface HrAttendanceTrendChartProps {
  data: DailyTrendPoint[];
  loading?: boolean;
}

export const HrAttendanceTrendChart: React.FC<HrAttendanceTrendChartProps> = ({
  data,
  loading = false,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={220} sx={{ borderRadius: 2 }} />
      </Card>
    );
  }

  // Find max value across all series to scale the Y-axis
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.present, d.absent, d.late, 1)),
    10,
  );
  // Round up to nice number
  const yMax = Math.ceil(maxVal / 10) * 10;
  const yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];

  // SVG dimensions
  const svgWidth = 560;
  const svgHeight = 220;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 35;
  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  const pointsCount = Math.max(data.length, 1);
  const getX = (idx: number) => padLeft + (idx / Math.max(pointsCount - 1, 1)) * chartWidth;
  const getY = (val: number) => padTop + chartHeight - (val / yMax) * chartHeight;

  // Build SVG path string for smooth curve
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    if (values.length === 1) return `M ${getX(0)} ${getY(values[0])} L ${getX(0) + 1} ${getY(values[0])}`;

    const points = values.map((val, idx) => ({ x: getX(idx), y: getY(val) }));
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const presentPath = buildSmoothPath(data.map((d) => d.present));
  const absentPath = buildSmoothPath(data.map((d) => d.absent));
  const latePath = buildSmoothPath(data.map((d) => d.late));

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

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
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
          7-Day Attendance Trend
        </Typography>
        {hoveredData && (
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
            {hoveredData.fullDate}: {hoveredData.present} Present &bull; {hoveredData.absent} Absent &bull; {hoveredData.late} Late
          </Typography>
        )}
      </Box>

      {/* Responsive SVG Chart */}
      <Box sx={{ width: '100%', position: 'relative', my: 1 }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', overflow: 'visible' }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Horizontal Grid lines & Y-Axis labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* X-Axis labels */}
          {data.map((pt, idx) => {
            const x = getX(idx);
            return (
              <text
                key={pt.date + idx}
                x={x}
                y={svgHeight - 10}
                fill={hoverIndex === idx ? '#0f172a' : '#94a3b8'}
                fontSize="11"
                fontWeight={hoverIndex === idx ? '800' : '600'}
                textAnchor="middle"
              >
                {pt.date}
              </text>
            );
          })}

          {/* Hover guideline */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={padTop + chartHeight}
              stroke="#cbd5e1"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
          )}

          {/* Line series */}
          {/* Late line (Amber) */}
          <path d={latePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          {/* Absent line (Coral/Red) */}
          <path d={absentPath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          {/* Present line (Blue) */}
          <path d={presentPath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

          {/* Data point markers */}
          {data.map((pt, idx) => {
            const x = getX(idx);
            return (
              <g key={idx}>
                {/* Present circle */}
                <circle
                  cx={x}
                  cy={getY(pt.present)}
                  r={hoverIndex === idx ? 5 : 3.5}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {/* Absent circle */}
                <circle
                  cx={x}
                  cy={getY(pt.absent)}
                  r={hoverIndex === idx ? 5 : 3.5}
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {/* Late circle */}
                <circle
                  cx={x}
                  cy={getY(pt.late)}
                  r={hoverIndex === idx ? 5 : 3.5}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {/* Invisible hover trigger column */}
                <rect
                  x={x - chartWidth / (pointsCount * 2)}
                  y={padTop}
                  width={chartWidth / pointsCount}
                  height={chartHeight}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverIndex(idx)}
                />
              </g>
            );
          })}
        </svg>
      </Box>

      {/* Legend matching screenshot: Absent (red), Late (amber), Present (blue) */}
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
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>
            Absent
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>
            Late
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563eb' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>
            Present
          </Typography>
        </Box>
      </Box>
    </Card>
  );
};
