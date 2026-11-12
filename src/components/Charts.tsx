// ===== src/components/Charts.tsx =====
// Lightweight dependency-free SVG charts used by dashboards, the product
// details modal (price forecast) and analytics. Pure presentational
// components — they accept plain numbers and render with CSS variables so
// dark/light themes are handled automatically.
import React from 'react';

interface SeriesPoint {
  label: string;
  value: number;
}

// ---------- Sparkline ----------
// Tiny inline trend line with a soft area fill. Used for price history.
export const Sparkline: React.FC<{ points: number[]; width?: number; height?: number; stroke?: string }> = ({
  points,
  width = 140,
  height = 40,
  stroke = 'var(--secondary)',
}) => {
  if (!points || points.length < 2) {
    return <div className="chart-sparkline chart-sparkline-empty">—</div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: i * step,
    y: height - 4 - ((p - min) / range) * (height - 8),
  }));
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg className="chart-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Price trend" role="img">
      <path d={area} fill={stroke} opacity={0.18} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={3} fill={stroke} />
    </svg>
  );
};

// ---------- MiniBarChart ----------
// Small vertical bar chart for monthly totals (revenue / spend).
export const MiniBarChart: React.FC<{
  data: SeriesPoint[];
  height?: number;
  valueFormatter?: (v: number) => string;
}> = ({ data, height = 120, valueFormatter }) => {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data yet</div>;
  }
  const max = Math.max(...data.map(d => d.value), 1);
  const bw = 100 / data.length;
  const fmt = valueFormatter || ((v: number) => String(Math.round(v)));
  return (
    <div className="chart-bars" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="chart-bar-col" style={{ width: `${bw}%` }}>
          <div className="chart-bar-track">
            <div
              className="chart-bar-fill"
              style={{ height: `${Math.max((d.value / max) * 100, 2)}%`, transitionDelay: `${i * 40}ms` }}
              title={fmt(d.value)}
            />
          </div>
          <span className="chart-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ---------- LineChart ----------
// Responsive multi-series trend chart. Used for revenue / spend and order
// volume so each role gets a readable time-series instead of one tiny bar row.
export interface LineSeries {
  label: string;
  color: string;
  data: SeriesPoint[];
}

export const LineChart: React.FC<{
  series: LineSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
  showArea?: boolean;
}> = ({ series, height = 170, valueFormatter, showArea = true }) => {
  const nonEmpty = series.filter(s => s.data.length > 0);
  if (nonEmpty.length === 0 || nonEmpty.every(s => s.data.every(p => p.value === 0))) {
    return <div className="chart-empty">No data yet</div>;
  }
  const labels = nonEmpty[0].data.map(p => p.label);
  const max = Math.max(...nonEmpty.flatMap(s => s.data.map(p => p.value)), 1);
  const width = 360;
  const left = 6;
  const right = 6;
  const top = 12;
  const bottom = height - 24;
  const plotWidth = width - left - right;
  const plotHeight = bottom - top;
  const step = labels.length > 1 ? plotWidth / (labels.length - 1) : plotWidth;
  const fmt = valueFormatter || ((v: number) => String(Math.round(v)));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="chart-line">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
        {gridLines.map((g, i) => {
          const y = top + plotHeight * g;
          return (
            <line
              key={i}
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
              className="chart-line-grid"
            />
          );
        })}
        {nonEmpty.map(seriesItem => {
          const points = seriesItem.data.map((p, i) => ({
            x: left + (labels.length > 1 ? i * step : plotWidth / 2),
            y: bottom - (p.value / max) * plotHeight,
            value: p.value,
            label: p.label,
          }));
          const path = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' ');
          const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${bottom} L${points[0].x.toFixed(1)},${bottom} Z`;
          return (
            <g key={seriesItem.label}>
              {showArea && (
                <path d={areaPath} fill={seriesItem.color} opacity={0.12} />
              )}
              <path
                d={path}
                fill="none"
                stroke={seriesItem.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.2} fill={seriesItem.color}>
                  <title>{`${seriesItem.label} · ${p.label}: ${fmt(p.value)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((label, i) => {
          const x = left + (labels.length > 1 ? i * step : plotWidth / 2);
          return (
            <text key={label + i} x={x} y={height - 6} textAnchor="middle" className="chart-line-label">
              {label}
            </text>
          );
        })}
      </svg>
      {nonEmpty.length > 1 && (
        <div className="chart-line-legend">
          {nonEmpty.map(s => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- HorizontalBarChart ----------
// Label-first bars are much easier to scan than rotated vertical bars when the
// categories are long (city names, product categories, supplier names).
export const HorizontalBarChart: React.FC<{
  data: SeriesPoint[];
  valueFormatter?: (v: number) => string;
  color?: string;
  maxItems?: number;
}> = ({ data, valueFormatter, color = 'var(--secondary)', maxItems = 8 }) => {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data yet</div>;
  }
  const rows = data.slice(0, maxItems);
  const max = Math.max(...rows.map(d => d.value), 1);
  const fmt = valueFormatter || ((v: number) => String(Math.round(v)));
  return (
    <div className="chart-hbars">
      {rows.map((d, i) => (
        <div key={d.label + i} className="chart-hbar-row">
          <span className="chart-hbar-label" title={d.label}>{d.label}</span>
          <span className="chart-hbar-track">
            <span
              className="chart-hbar-fill"
              style={{
                width: `${Math.max((d.value / max) * 100, 2)}%`,
                background: color,
                transitionDelay: `${i * 35}ms`,
              }}
            />
          </span>
          <strong className="chart-hbar-value">{fmt(d.value)}</strong>
        </div>
      ))}
    </div>
  );
};

// ---------- DonutChart ----------
// Small circular status breakdown with a center total.
export const DonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
}> = ({ data, size = 150, centerLabel }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return <div className="chart-empty">No data yet</div>;
  }
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="chart-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Breakdown">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={16} />
        {data.map((d, i) => {
          if (d.value <= 0) return null;
          const frac = d.value / total;
          const len = frac * circ;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={16}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="chart-donut-center">
          {centerLabel || total}
        </text>
      </svg>
      <div className="chart-legend">
        {data.filter(d => d.value > 0).map((d, i) => (
          <div key={i} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: d.color }} />
            <span>{d.label}</span>
            <strong>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- StarRating (input + read-only display) ----------
export const StarRatingDisplay: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => {
  const full = Math.round(value);
  return (
    <span className="star-row" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: size }} className={i <= full ? 'star on' : 'star'}>
          ★
        </span>
      ))}
    </span>
  );
};

export const StarRatingInput: React.FC<{ value: number; onChange: (v: number) => void; size?: number }> = ({
  value,
  onChange,
  size = 26,
}) => (
  <div className="star-input" role="radiogroup" aria-label="Rate">
    {[1, 2, 3, 4, 5].map(i => (
      <button
        key={i}
        type="button"
        className={'star-input-btn' + (i <= value ? ' on' : '')}
        onClick={() => onChange(i)}
        style={{ fontSize: size }}
        aria-label={`${i} stars`}
        role="radio"
        aria-checked={i <= value}
      >
        ★
      </button>
    ))}
  </div>
);