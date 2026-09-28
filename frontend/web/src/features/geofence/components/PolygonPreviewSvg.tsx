import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { Vertex } from '../types/geofence';

interface Props {
  vertices: Vertex[];
  width?: number;
  height?: number;
  probePoint?: {
    latitude: number;
    longitude: number;
    isInside?: boolean;
    label?: string;
  };
}

export function PolygonPreviewSvg({
  vertices,
  width = 500,
  height = 340,
  probePoint,
}: Props) {
  const { pathData, points, probeSvgCoord, boundingBox, hasValidPolygon } = useMemo(() => {
    if (!vertices || vertices.length < 3) {
      return {
        pathData: '',
        points: [],
        probeSvgCoord: null,
        boundingBox: null,
        hasValidPolygon: false,
      };
    }

    const allLats = vertices.map((v) => v.latitude);
    const allLngs = vertices.map((v) => v.longitude);

    if (probePoint) {
      allLats.push(probePoint.latitude);
      allLngs.push(probePoint.longitude);
    }

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    const latSpan = Math.max(maxLat - minLat, 0.0001);
    const lngSpan = Math.max(maxLng - minLng, 0.0001);

    const padding = 45;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const toSvgX = (lng: number) => padding + ((lng - minLng) / lngSpan) * innerW;
    // Latitude increases northwards, so top of SVG corresponds to maxLat
    const toSvgY = (lat: number) => padding + ((maxLat - lat) / latSpan) * innerH;

    const svgPoints = vertices.map((v, i) => ({
      x: toSvgX(v.longitude),
      y: toSvgY(v.latitude),
      sequence: v.sequence ?? i + 1,
      lat: v.latitude,
      lng: v.longitude,
    }));

    const path = svgPoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '') + ' Z';

    let probeCoord = null;
    if (probePoint) {
      probeCoord = {
        x: toSvgX(probePoint.longitude),
        y: toSvgY(probePoint.latitude),
        isInside: probePoint.isInside,
        label: probePoint.label,
      };
    }

    return {
      pathData: path,
      points: svgPoints,
      probeSvgCoord: probeCoord,
      boundingBox: { minLat, maxLat, minLng, maxLng },
      hasValidPolygon: true,
    };
  }, [vertices, probePoint, width, height]);

  if (!hasValidPolygon) {
    return (
      <Paper
        variant="outlined"
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          p: 3,
        }}
      >
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          Geofence Boundary Preview
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          At least 3 valid coordinate vertices are required to render an office polygon preview.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', bgcolor: '#F8FAFC' }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
          SVG Polygon Boundary Visualizer ({vertices.length} vertices)
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Bounding Box: [{boundingBox?.minLat.toFixed(4)}, {boundingBox?.minLng.toFixed(4)}] to [{boundingBox?.maxLat.toFixed(4)}, {boundingBox?.maxLng.toFixed(4)}]
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="polyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1B4B8F" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.15" />
            </linearGradient>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width={width} height={height} fill="url(#grid)" />

          {/* Polygon area */}
          <path
            d={pathData}
            fill="url(#polyGrad)"
            stroke="#1B4B8F"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeDasharray="none"
          />

          {/* Vertices */}
          {points.map((pt) => (
            <g key={pt.sequence}>
              <circle cx={pt.x} cy={pt.y} r="6" fill="#1B4B8F" stroke="#ffffff" strokeWidth="2" />
              <text
                x={pt.x}
                y={pt.y - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#14213D"
              >
                P{pt.sequence}
              </text>
            </g>
          ))}

          {/* Probe Test Point */}
          {probeSvgCoord && (
            <g>
              <circle
                cx={probeSvgCoord.x}
                cy={probeSvgCoord.y}
                r="14"
                fill={probeSvgCoord.isInside ? 'rgba(46, 125, 50, 0.25)' : 'rgba(198, 40, 40, 0.25)'}
              />
              <circle
                cx={probeSvgCoord.x}
                cy={probeSvgCoord.y}
                r="7"
                fill={probeSvgCoord.isInside ? '#2E7D32' : '#C62828'}
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x={probeSvgCoord.x}
                y={probeSvgCoord.y + 22}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fill={probeSvgCoord.isInside ? '#2E7D32' : '#C62828'}
              >
                {probeSvgCoord.label ?? (probeSvgCoord.isInside ? 'Inside Office' : 'Outside Office')}
              </text>
            </g>
          )}
        </svg>
      </Box>
    </Paper>
  );
}
