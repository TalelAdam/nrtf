import net from 'net';

/**
 * Probe whether a TCP port is listening on localhost.
 * Used to auto-detect backend port when BACKEND_URL is not set.
 */
function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host: '127.0.0.1', port });
    s.once('connect',  () => { s.destroy(); resolve(true);  });
    s.once('error',    () => { s.destroy(); resolve(false); });
    s.setTimeout(300,  () => { s.destroy(); resolve(false); });
  });
}

async function resolveBackendUrl() {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  // Try preferred port first, then fallback range
  for (const port of [3000, 3001, 3002, 3003]) {
    if (await portOpen(port)) return `http://localhost:${port}`;
  }
  return 'http://localhost:3000'; // last-resort
}

/** @type {import('next').NextConfig} */
const backendUrl = await resolveBackendUrl();
console.log(`[next.config] Backend proxy → ${backendUrl}`);

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ["@nrtf/types", "@nrtf/utils", "@nrtf/api-client"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
