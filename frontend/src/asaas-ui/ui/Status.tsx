import type { CSSProperties } from 'react';
import { initials } from '../lib/format';
import { Icon, type IconName } from './Icon';

/** Paid / partly paid / not paid: the three states the status colours are for. */
export type ContributionStatus = 'paid' | 'partial' | 'unpaid';

export const STATUS_META: Record<ContributionStatus, { label: string; icon: IconName }> = {
  paid: { label: 'مدفوع', icon: 'checkCircle' },
  partial: { label: 'جزئي', icon: 'clock' },
  unpaid: { label: 'لم يدفع', icon: 'alert' },
};

/** Status is always icon + label, never color alone. */
export function StatusPill({ status }: { status: ContributionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`pill pill--${status}`}>
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  );
}

export function Avatar({ name, status, size }: { name: string; status?: ContributionStatus | null; size?: number }) {
  return (
    <span
      className="avatar"
      data-status={status ?? undefined}
      style={size ? ({ '--size': `${size}px` } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
