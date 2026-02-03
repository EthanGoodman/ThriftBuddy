const nextConfig = {
  async rewrites() {
    const apiOrigin = process.env.FASTAPI_ORIGIN;
    if (!apiOrigin) return [];
    return [
      { source: "/api/py/:path*", destination: `${apiOrigin}/:path*` },
      { source: "/docs", destination: `${apiOrigin}/docs` },
      { source: "/openapi.json", destination: `${apiOrigin}/openapi.json` },
    ];
  },

   experimental: {
    proxyClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
