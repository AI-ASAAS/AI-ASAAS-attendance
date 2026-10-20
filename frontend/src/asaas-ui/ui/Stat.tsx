import type { ReactNode } from 'react';
import { CURRENCY, formatNumber } from '../lib/format';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';

interface StatProps {
  label: string;
  icon: IconName;
  amount: number;
  foot?: ReactNode;
  tone?: 'default' | 'negative';
}

/** Headline number tile (amount in rials). */
export function Stat({ label, icon, amount, foot, tone = 'default' }: StatProps) {
  return (
    <Glass className="stat">
      <span className="stat__label">
        <span className="stat__icon">
          <Icon name={icon} />
        </span>
        {label}
      </span>
      <span className="stat__value" style={tone === 'negative' ? { color: 'var(--unpaid)' } : undefined}>
        <span className="num">{formatNumber(amount)}</span>
        <small>{CURRENCY}</small>
      </span>
      {foot && <span className="stat__foot">{foot}</span>}
    </Glass>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ value, max, size = 168, children }: { value: number; max: number; size?: number; children?: ReactNode }) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#dcc08a" />
            <stop offset="55%" stopColor="#ba9555" />
            <stop offset="100%" stopColor="#8f6a2e" />
          </linearGradient>
        </defs>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="ring__label">{children}</div>
    </div>
  );
}
