import Image from 'next/image';

export default function Logo({ size = 44, showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <img
          src="/logo-dark.png"
          alt="أساس"
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'contain' }}
        />
      </div>
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span
            style={{
              fontFamily: 'var(--font-display, "Thmanyah Serif Display", serif)',
              fontWeight: 700,
              color: 'var(--text, #221f1f)',
              fontSize: size * 0.42
            }}
          >
            أساس
          </span>
          <span
            style={{
              fontFamily: 'var(--font, "Thmanyah Sans", sans-serif)',
              fontWeight: 600,
              letterSpacing: '1px',
              color: 'var(--accent, #ba9555)',
              fontSize: size * 0.22
            }}
          >
            نظام الحضور الذكي
          </span>
        </div>
      )}
    </div>
  );
}
