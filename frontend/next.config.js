/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  swcMinify: true,
  async redirects() {
    return [
      { source:'/admin/:path*', destination:'/asas', permanent:false },
      { source:'/login', destination:'/asas', permanent:false },
      { source:'/employee/:path*', destination:'/asas', permanent:false },
    ];
  },
  async rewrites() {
    let raw = (process.env.API_INTERNAL_URL || 'http://backend:5000').trim();
    raw = raw.replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
    }
    return [{ source: '/api/:path*', destination: `${raw}/api/:path*` }];
  },
  // Enable PWA service worker in production
  headers: async () => [
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
