import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  /** Icon-only button; `label` becomes the accessible name. */
  label?: string;
  loading?: boolean;
}

export function Button({
  variant = 'glass',
  size = 'md',
  icon,
  label,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const iconOnly = !children && Boolean(label);
  return (
    <button
      type={type}
      className={cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', iconOnly && 'btn--icon', className)}
      disabled={disabled || loading}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      {...props}
    >
      {icon && <Icon name={icon} />}
      {loading ? 'جارٍ الحفظ…' : children}
    </button>
  );
}
