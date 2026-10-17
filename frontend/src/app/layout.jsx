import './globals.css';
import './asas.css';
import Providers from '@/components/shared/Providers';

export const metadata = {
  title: 'AI-ASAAS-attendance | نظام أساس لإدارة الحضور',
  description: 'نظام حضور شركة أساس - AI-ASAAS Attendance System',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AI-ASAAS-attendance' },
};
export const viewport = {
  themeColor: '#231F20',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/logo.jpeg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
