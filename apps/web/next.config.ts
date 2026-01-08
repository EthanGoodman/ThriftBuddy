import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiOrigin = process.env.FASTAPI_ORIGIN;

    if (!apiOrigin) return [];

    return [
      {
        source: "/api/py/:path*",
        destination: `${apiOrigin}/api/py/:path*`,
      },
      // optional convenience aliases:
      {
        source: "/docs",
        destination: `${apiOrigin}/api/py/docs`,
      },
      {
        source: "/openapi.json",
        destination: `${apiOrigin}/api/py/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
