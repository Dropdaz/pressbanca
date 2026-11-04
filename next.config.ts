import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A lockfile in a parent folder confuses workspace-root detection; this project is self-contained.
  outputFileTracingRoot: __dirname,
  experimental: {
    // Keep visited profiles in the client router cache, so going back from a game breakdown
    // doesn't re-render every tab. Background sync calls router.refresh() when data changes.
    staleTimes: { dynamic: 300 },
  },
};

export default nextConfig;
