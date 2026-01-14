const nextConfig = {
  async rewrites() {
    const apiOrigin = process.env.FASTAPI_ORIGIN;
    if (!apiOrigin) return [];
    return [
      { source: "/api/py/:path*", destination: `${apiOrigin}/api/py/:path*` },
      { source: "/docs", destination: `${apiOrigin}/api/py/docs` },
      { source: "/openapi.json", destination: `${apiOrigin}/api/py/openapi.json` },
    ];
  },

   experimental: {
    proxyClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
