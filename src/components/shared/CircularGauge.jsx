const R = 42
const CIRC = 2 * Math.PI * R

export default function CircularGauge({ value, max, color, trackColor, label, unit = '', size = 140 }) {
  const pct    = max > 0 ? Math.min(value / max, 1) : 0
  const filled = pct * CIRC
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="gauge-wrap" style={{ width: size, height: size + 28 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={trackColor || 'var(--gray-100)'}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Arc */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC}`}
          strokeDashoffset="0"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Valeur centrale */}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--gray-800)">
          {value}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--gray-400)">
          {unit}
        </text>
      </svg>
      <p className="gauge-label">{label}</p>
    </div>
  )
}
