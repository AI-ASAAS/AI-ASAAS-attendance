/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source:'/admin/:path*', destination:'/asas', permanent:false },
      { source:'/login', destination:'/asas', permanent:false },
      { source:'/employee/:path*', destination:'/asas', permanent:false },
    ];
  },
  async rewrites() { return [{source:'/api/:path*',destination:`${process.env.API_INTERNAL_URL || 'http://127.0.0.1:5000'}/api/:path*`}]; },
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
