/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ["@nrtf/types", "@nrtf/utils", "@nrtf/api-client"],
  // For local dev with backend at :3000
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.BACKEND_URL
          ? `${process.env.BACKEND_URL}/api/:path*`
          : "http://localhost:3000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
