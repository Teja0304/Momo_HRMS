import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import PanToolAltIcon from '@mui/icons-material/PanToolAlt';
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
  editable?: boolean;
  onVertexDrag?: (index: number, latitude: number, longitude: number) => void;
  onVertexDragEnd?: (index: number, latitude: number, longitude: number) => void;
}

export function PolygonPreviewSvg({
  vertices,
  width = 500,
  height = 340,
  probePoint,
  editable = false,
  onVertexDrag,
  onVertexDragEnd,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragLivePos, setDragLivePos] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

  // Geometry and projection memo
  const { pathData, points, probeSvgCoord, boundingBox, hasValidPolygon, toGeoLat, toGeoLng, padding } = useMemo(() => {
    if (!vertices || vertices.length < 3) {
      return {
        pathData: '',
        points: [],
        probeSvgCoord: null,
        boundingBox: null,
        hasValidPolygon: false,
        toGeoLat: (_: number) => 0,
        toGeoLng: (_: number) => 0,
        padding: 45,
      };
    }

    const allLats = vertices.map((v) => v.latitude);
    const allLngs = vertices.map((v) => v.longitude);

    if (probePoint) {
      allLats.push(probePoint.latitude);
      allLngs.push(probePoint.longitude);
    }

    const rawMinLat = Math.min(...allLats);
    const rawMaxLat = Math.max(...allLats);
    const rawMinLng = Math.min(...allLngs);
    const rawMaxLng = Math.max(...allLngs);

    const rawLatSpan = Math.max(rawMaxLat - rawMinLat, 0.0001);
    const rawLngSpan = Math.max(rawMaxLng - rawMinLng, 0.0001);

    // Provide 15% margin around the bounding box so vertices aren't pushed directly against SVG edges
    const latMargin = rawLatSpan * 0.15;
    const lngMargin = rawLngSpan * 0.15;

    const minLat = rawMinLat - latMargin;
    const maxLat = rawMaxLat + latMargin;
    const minLng = rawMinLng - lngMargin;
    const maxLng = rawMaxLng + lngMargin;

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    const pad = 42;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    const toSvgX = (lng: number) => pad + ((lng - minLng) / lngSpan) * innerW;
    // Latitude increases northwards, so top of SVG corresponds to maxLat
    const toSvgY = (lat: number) => pad + ((maxLat - lat) / latSpan) * innerH;

    const geoLng = (x: number) => {
      const clampedX = Math.max(pad * 0.4, Math.min(width - pad * 0.4, x));
      return minLng + ((clampedX - pad) / innerW) * lngSpan;
    };

    const geoLat = (y: number) => {
      const clampedY = Math.max(pad * 0.4, Math.min(height - pad * 0.4, y));
      return maxLat - ((clampedY - pad) / innerH) * latSpan;
    };

    const svgPoints = vertices.map((v, i) => ({
      x: toSvgX(v.longitude),
      y: toSvgY(v.latitude),
      sequence: v.sequence ?? i + 1,
      lat: v.latitude,
      lng: v.longitude,
    }));

    const path =
      svgPoints.reduce((acc, pt, idx) => {
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
      boundingBox: { minLat: rawMinLat, maxLat: rawMaxLat, minLng: rawMinLng, maxLng: rawMaxLng },
      hasValidPolygon: true,
      toGeoLat: geoLat,
      toGeoLng: geoLng,
      padding: pad,
    };
  }, [vertices, probePoint, width, height]);

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, index: number) => {
    if (!editable || !onVertexDrag) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);

    setActiveDragIndex(index);
    const pt = points[index];
    if (pt) {
      setDragLivePos({ x: pt.x, y: pt.y, lat: pt.lat, lng: pt.lng });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (activeDragIndex === null || !svgRef.current || !onVertexDrag) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Clamping within visible canvas buffer
    const clampedX = Math.max(padding * 0.4, Math.min(width - padding * 0.4, mouseX));
    const clampedY = Math.max(padding * 0.4, Math.min(height - padding * 0.4, mouseY));

    const newLng = toGeoLng(clampedX);
    const newLat = toGeoLat(clampedY);

    setDragLivePos({ x: clampedX, y: clampedY, lat: newLat, lng: newLng });
    onVertexDrag(activeDragIndex, newLat, newLng);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (activeDragIndex !== null) {
      try {
        (e.currentTarget as SVGGElement).releasePointerCapture(e.pointerId);
      } catch {}
      if (dragLivePos && onVertexDragEnd) {
        onVertexDragEnd(activeDragIndex, dragLivePos.lat, dragLivePos.lng);
      }
      setActiveDragIndex(null);
      setDragLivePos(null);
    }
  };

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
      {/* Visualizer Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            SVG Polygon Boundary Visualizer ({vertices.length} vertices)
          </Typography>
          {editable && (
            <Chip
              icon={<PanToolAltIcon sx={{ fontSize: '13px !important' }} />}
              label="Drag & Drop Active"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          Bounding Box: [{boundingBox?.minLat.toFixed(4)}, {boundingBox?.minLng.toFixed(4)}] to [
          {boundingBox?.maxLat.toFixed(4)}, {boundingBox?.maxLng.toFixed(4)}]
        </Typography>
      </Box>

      {/* Helpful instruction banner */}
      {editable && (
        <Box
          sx={{
            py: 0.6,
            px: 1.5,
            bgcolor: 'rgba(37, 99, 235, 0.05)',
            borderBottom: '1px dashed #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: '#1B4B8F', fontWeight: 600 }}>
            💡 Tip: Click and drag any point handle (P1, P2...) directly on the canvas to reshape the perimeter.
          </Typography>
        </Box>
      )}

      {/* SVG Canvas */}
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 1, userSelect: 'none' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: 'visible', maxWidth: '100%', height: 'auto' }}
        >
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
          <rect width={width} height={height} fill="url(#grid)" rx="4" />

          {/* Polygon area */}
          <path
            d={pathData}
            fill="url(#polyGrad)"
            stroke="#1B4B8F"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeDasharray="none"
          />

          {/* Vertices (Draggable handles) */}
          {points.map((pt, i) => {
            const isDragging = activeDragIndex === i;
            const isHovered = hoveredIndex === i;
            const currentX = isDragging && dragLivePos ? dragLivePos.x : pt.x;
            const currentY = isDragging && dragLivePos ? dragLivePos.y : pt.y;
            const currentLat = isDragging && dragLivePos ? dragLivePos.lat : pt.lat;
            const currentLng = isDragging && dragLivePos ? dragLivePos.lng : pt.lng;

            return (
              <g
                key={pt.sequence}
                style={{
                  cursor: editable ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => handlePointerDown(e, i)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Invisible larger hit target (34px diameter) for easy grabbing */}
                <circle cx={currentX} cy={currentY} r="17" fill="transparent" />

                {/* Hover / Dragging glow halo */}
                {(isHovered || isDragging) && (
                  <circle
                    cx={currentX}
                    cy={currentY}
                    r={isDragging ? '17' : '13'}
                    fill={isDragging ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.12)'}
                    stroke="#2563eb"
                    strokeWidth={isDragging ? '2' : '1.5'}
                    strokeDasharray={isDragging ? 'none' : '3 3'}
                  />
                )}

                {/* Main vertex circle */}
                <circle
                  cx={currentX}
                  cy={currentY}
                  r={isDragging ? '8' : isHovered ? '7.5' : '6.5'}
                  fill="#1B4B8F"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />

                {/* Vertex label (P1, P2...) */}
                <text
                  x={currentX}
                  y={currentY - (isDragging ? 18 : 12)}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="800"
                  fill="#0f172a"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  P{pt.sequence}
                </text>

                {/* Live coordinates floating badge during drag */}
                {isDragging && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={currentX - 78}
                      y={currentY + 12}
                      width="156"
                      height="24"
                      rx="6"
                      fill="#0f172a"
                      opacity="0.94"
                    />
                    <text
                      x={currentX}
                      y={currentY + 28}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="700"
                      fill="#38bdf8"
                      fontFamily="monospace"
                    >
                      {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

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
