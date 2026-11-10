import type { SVGProps } from 'react';
import { cx } from '../lib/cx';

/** Line icons in the brand style: rounded caps, 1.75 stroke. */
const paths = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
      <rect x="3" y="15" width="7.5" height="6" rx="2" />
    </>
  ),
  collect: (
    <>
      <path d="M12 3v4" />
      <circle cx="12" cy="11" r="4" />
      <path d="M12 9.6v2.8M10.6 11h2.8" />
      <path d="M3 17.5c2.4 0 3.6-1.5 6-1.5h4.5a1.5 1.5 0 0 1 0 3H10" />
      <path d="M13.5 19h3l4.2-2.6a1.4 1.4 0 0 0-1.5-2.4L15 16" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.3 3.2-5.5 6.5-5.5s5.9 2.2 6.5 5.5" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.2 2.6 3.5 5.2" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12.5h18M11 12.5h2" />
    </>
  ),
  vault: (
    <>
      <rect x="3" y="4" width="18" height="15" rx="3" />
      <circle cx="12" cy="11.5" r="3.5" />
      <path d="M12 8v1M12 14v1M15.5 11.5h-1M9.5 11.5h-1M6 19v2M18 19v2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.8 2.8L16.2 9.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  wallet: (
    <>
      <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H6a3 3 0 0 0 0 6h13a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V7" />
      <path d="M16.5 14.5h.01" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.4 3.3M6.6 6.6A16.4 16.4 0 0 0 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16l-4-4 4-4M6 12h9" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 3.5 12.9 8.6 18 10.5l-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z" />
      <path d="M18.5 15.5 19.3 17.7 21.5 18.5l-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  send: (
    <>
      <path d="M3 3l18 9-18 9 3.5-9z" />
      <path d="M6.5 12H13" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.1-3.8 3.9-6 7.5-6s6.4 2.2 7.5 6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V7.5a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="14.5" r="3.5" />
      <path d="m10.5 11.5 8-8M16 6l2.5 2.5M14 8l2 2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4.2 1.8 6 2.5 6.8H3.5C4.2 15.5 6 13.7 6 9.5Z" />
      <path d="M9.8 18.5a2.4 2.4 0 0 0 4.4 0" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s6.5-5.8 6.5-11.2a6.5 6.5 0 1 0-13 0C5.5 15.2 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </>
  ),
  qrCode: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h3v3M21 14v4M14 21h4M21 21h.01" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M12 3.2 4.5 6.2v5.4c0 4.8 3.2 8.4 7.5 9.6 4.3-1.2 7.5-4.8 7.5-9.6V6.2z" />
      <path d="m8.8 12.2 2.2 2.2 4.4-4.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.2 13.5v-3l-2-.6a5.8 5.8 0 0 0-.7-1.6l1-1.8-2.1-2.1-1.8 1a5.8 5.8 0 0 0-1.6-.7l-.5-2h-3l-.5 2a5.8 5.8 0 0 0-1.6.7l-1.8-1L4.5 6.5l1 1.8a5.8 5.8 0 0 0-.7 1.6l-2 .6v3l2 .6a5.8 5.8 0 0 0 .7 1.6l-1 1.8 2.1 2.1 1.8-1c.5.3 1 .5 1.6.7l.5 2h3l.5-2c.6-.2 1.1-.4 1.6-.7l1.8 1 2.1-2.1-1-1.8c.3-.5.5-1 .7-1.6z" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11A8.1 8.1 0 0 0 6.5 5.6L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 13.5 5.4L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.4-2h4.2l1.4 2h2A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V4h10v5" />
      <rect x="4" y="9" width="16" height="8" rx="2" />
      <path d="M7 14h10v6H7z" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  fileSpreadsheet: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M8 12h8M8 16h8M12 12v4" />
    </>
  ),
  logIn: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="m10 16 4-4-4-4M14 12H4" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5V21" />
      <path d="M16 10h3.5a1.5 1.5 0 0 1 1.5 1.5V21M3 21h18" />
      <path d="M8 8h4M8 12h4M8 16h4" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m9 13.8-1.2 7.2 4.2-2.2 4.2 2.2-1.2-7.2" />
    </>
  ),
  remoteIn: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M2 20h20M9.5 10.5l2 2 3.5-4" />
    </>
  ),
  remoteOut: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M2 20h20M9.5 8l5 5M14.5 8l-5 5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  wifi: (
    <path d="M3.5 9.5a13 13 0 0 1 17 0M6.8 13a8.5 8.5 0 0 1 10.4 0M10.2 16.5a3.5 3.5 0 0 1 3.6 0M12 19.5v.01" />
  ),
  fingerprint: (
    <path d="M6.5 11.5a5.5 5.5 0 0 1 11 0M9 11.5a3 3 0 0 1 6 0v3.5a4 4 0 0 1-.8 2.4M12 11.5v5.5M5.5 15.5c.8 1.8 1.5 3.2 2.5 4.2M18.5 15.5c-.3 1.2-.8 2.3-1.5 3.2" />
  ),
} as const;

export type IconName = keyof typeof paths;

/**
 * Icons that point along the reading direction. They are drawn for Arabic
 * (chevronLeft = "next/forward") and mirror themselves when `<html dir="ltr">`.
 */
const DIRECTIONAL = new Set<IconName>(['chevronLeft', 'chevronRight']);

export function Icon({ name, className, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(DIRECTIONAL.has(name) && 'icon--dir', className)}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
