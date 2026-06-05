import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
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
  hideSourceMaps: true,
  // Automatically tree-shake Sentry logger statements in production
  disableLogger: true,
});
