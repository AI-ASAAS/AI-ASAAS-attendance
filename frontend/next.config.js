/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  turbopack: {},
  async redirects() {
    return [
      { source: '/admin/:path*', destination: '/', permanent: false },
      { source: '/login', destination: '/', permanent: false },
      { source: '/employee/:path*', destination: '/', permanent: false },
    ];
  },
  async rewrites() {
    let raw = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:6500').trim();
    raw = raw.replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
    }
    return [{ source: '/api/:path*', destination: `${raw}/api/:path*` }];
  },
  // Enable PWA service worker in production & enforce security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
      ],
    },
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      ],
    },
  ],
  // Allow face-api.js model files
  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};
module.exports = nextConfig;
