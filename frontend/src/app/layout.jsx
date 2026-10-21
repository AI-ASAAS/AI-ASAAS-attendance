import '../asaas-ui/styles/index.css';
import './globals.css';
import './asas.css';
import Providers from '@/components/shared/Providers';

export const metadata = {
  title: 'أساس | نظام إدارة الحضور والانصراف الذكي',
  description: 'نظام الحضور والدوام السيادي لشركة أساس الذكاء الاصطناعي - AI-ASAAS Sovereign Attendance',
  icons: {
    icon: [
      { url: '/brand/attendance_icon_user_check.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/brand/attendance_icon_user_check.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/icon-192.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'أساس حضور' },
};
export const viewport = {
  themeColor: '#221f1f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" type="image/svg+xml" href="/brand/attendance_icon_user_check.svg" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
