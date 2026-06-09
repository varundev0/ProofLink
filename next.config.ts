import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-inline/eval needed for Next.js runtime — tighten after removing inline scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: *.supabase.co images.unsplash.com",
      "connect-src 'self' *.supabase.co api.razorpay.com",
      "frame-src checkout.razorpay.com",
      "font-src 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage public bucket (proofs)
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses the Sentry CLI update check on every build
  silent: true,
  // Hides source maps from the browser bundle (uploaded to Sentry instead)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
