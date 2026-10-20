import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

interface GlassProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  thick?: boolean;
  pill?: boolean;
}

/** A liquid-glass surface. */
export function Glass({ as: Tag = 'div', thick, pill, className, ...props }: GlassProps) {
  return <Tag className={cx('glass', thick && 'glass--thick', pill && 'glass--pill', className)} {...props} />;
}

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
}

export function Card({ title, icon, actions, children, className, ...props }: CardProps) {
  return (
    <Glass as="section" className={cx('card', className)} {...props}>
      {(title || actions) && (
        <header className="card__header">
          <h2 className="card__title">
            {icon && <Icon name={icon} />}
            {title}
          </h2>
          {actions}
        </header>
      )}
      {children}
    </Glass>
  );
}
