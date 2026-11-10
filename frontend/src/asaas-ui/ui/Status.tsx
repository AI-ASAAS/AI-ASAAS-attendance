import type { CSSProperties } from 'react';
import { initials } from '../lib/format';
import { type KitTextKey, kitText } from '../lib/i18n';
import { Icon, type IconName } from './Icon';

/** Paid / partly paid / not paid: the three states the status colours are for. */
export type ContributionStatus = 'paid' | 'partial' | 'unpaid';

/** `label` is a kit text key, so the pill reads in the page language. */
export const STATUS_META: Record<ContributionStatus, { label: KitTextKey; icon: IconName }> = {
  paid: { label: 'statusPaid', icon: 'checkCircle' },
  partial: { label: 'statusPartial', icon: 'clock' },
  unpaid: { label: 'statusUnpaid', icon: 'alert' },
};

/** Status is always icon + label, never color alone. */
export function StatusPill({ status }: { status: ContributionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`pill pill--${status}`}>
      <Icon name={meta.icon} />
      {kitText(meta.label)}
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
