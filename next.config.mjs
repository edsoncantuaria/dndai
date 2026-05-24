/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    // Tipos legados ainda em correção; build Docker/CI não bloqueia
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === 'true' || process.env.NODE_ENV === 'production',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    allowedDevOrigins: ['rpg.edsin-server.space'],
  },
};

export default nextConfig;
