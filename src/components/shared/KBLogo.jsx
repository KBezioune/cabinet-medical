// Logo KB — hex + dégradé médical. size contrôle la taille, variant 'hex'|'circle'|'rounded'
export default function KBLogo({ size = 80, variant = 'hex', className = '' }) {
  if (size <= 42) {
    const r = variant === 'circle' ? '50%' : variant === 'hex' ? '30%' : '28%'
    return (
      <div
        className={className}
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: r, flexShrink: 0,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #0891b2 100%)',
          boxShadow: '0 3px 12px rgba(29,78,216,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 900, fontStyle: 'italic',
          fontSize: Math.round(size * 0.34), letterSpacing: '-0.04em',
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >KB</div>
    )
  }

  // Version grande : SVG hexagonale
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="kbg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#1e3a8a"/>
          <stop offset="52%"  stopColor="#2563eb"/>
          <stop offset="100%" stopColor="#0891b2"/>
        </linearGradient>
        <linearGradient id="kbg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.22)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <filter id="kbshadow">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="rgba(29,78,216,0.4)"/>
        </filter>
      </defs>

      {/* Hexagone principal */}
      <polygon
        points="40,3 71.2,21 71.2,57 40,75 8.8,57 8.8,21"
        fill="url(#kbg1)"
        filter="url(#kbshadow)"
      />
      {/* Reflet glossy */}
      <polygon points="40,3 71.2,21 71.2,42 8.8,42 8.8,21" fill="url(#kbg2)"/>
      {/* Anneau intérieur */}
      <polygon
        points="40,9 65.8,24 65.8,54 40,69 14.2,54 14.2,24"
        fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1"
      />

      {/* Croix médicale subtile en arrière-plan */}
      <rect x="37" y="15" width="6" height="13" rx="2" fill="rgba(255,255,255,0.09)"/>
      <rect x="31" y="19" width="18" height="5" rx="2" fill="rgba(255,255,255,0.09)"/>

      {/* Initiales KB */}
      <text
        x="40" y="55"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="27"
        fill="#ffffff"
        letterSpacing="-1"
      >KB</text>
    </svg>
  )
}
