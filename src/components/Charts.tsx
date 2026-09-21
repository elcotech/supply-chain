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