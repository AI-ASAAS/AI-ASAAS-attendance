import type { ReactNode } from 'react';
import { kitText } from '../lib/i18n';
import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon = 'file',
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Skeleton({ height = 64, count = 1 }: { height?: number; count?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label={kitText('loading')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState icon="alert" title={kitText('loadError')}>
      <p className="subtle">{error instanceof Error ? error.message : kitText('unexpectedError')}</p>
      {onRetry && (
        <button type="button" className="btn btn--glass btn--sm" onClick={onRetry}>
          {kitText('retry')}
        </button>
      )}
    </EmptyState>
  );
}
