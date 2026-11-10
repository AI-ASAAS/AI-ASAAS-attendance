import { type MouseEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { kitText } from '../lib/i18n';
import { Glass } from './Glass';
import { Icon } from './Icon';

export interface SiteHeaderProps {
  /** Logo and name, usually a link to the home page. */
  brand: ReactNode;
  /** The site's links (`<NavLink>` or `<a>`), rendered once: inline on desktop, in the menu on phones. */
  nav: ReactNode;
  /** Controls that stay visible at every width: theme, language, sign-in. Keep it to two or three. */
  actions?: ReactNode;
}

const PHONE_MENU = '(max-width: 900px)';

/**
 * Sticky glass header. Above 900px the links sit in the bar; at 900px and below
 * they fold into a panel behind a menu button. The panel closes on a link tap,
 * on Escape, on a tap outside, and when the window grows past the breakpoint.
 */
export function SiteHeader({ brand, nav, actions }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const navId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia(PHONE_MENU);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      menuButton.current?.focus();
    };
    const onResize = () => !media.matches && setOpen(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onResize);
    };
  }, [open]);

  // Any link tapped inside the menu closes it (the router changes the page).
  const onNavClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  };

  return (
    <header className="site-header" data-open={open}>
      <div className="site-header__scrim" aria-hidden="true" onClick={() => setOpen(false)} />
      <div className="container">
        <Glass thick pill className="site-header__bar">
          <div className="site-header__brand">{brand}</div>
          <nav id={navId} className="site-nav" aria-label={kitText('mainNav')} onClick={onNavClick}>
            {nav}
          </nav>
          <div className="site-header__actions">
            {actions}
            <button
              ref={menuButton}
              type="button"
              className="btn btn--ghost btn--icon site-header__menu"
              aria-label={kitText('menu')}
              aria-expanded={open}
              aria-controls={navId}
              onClick={() => setOpen((value) => !value)}
            >
              <Icon name={open ? 'close' : 'menu'} />
            </button>
          </div>
        </Glass>
      </div>
    </header>
  );
}

/**
 * Bottom tab bar for apps with three to five main sections; shown at 900px and
 * below. Pass `<NavLink>`s, each with an `<Icon>` and a short label.
 */
export function TabBar({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Glass as="nav" thick pill className="tabbar" aria-label={label ?? kitText('mainNav')}>
      {children}
    </Glass>
  );
}
