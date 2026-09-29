import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/dashboard/calendar',
        destination: '/dashboard/scheduling',
        permanent: true,
      },
      {
        source: '/dashboard/calendar/:path*',
        destination: '/dashboard/scheduling',
        permanent: true,
      }
    ];
  },
};

export default nextConfig;
