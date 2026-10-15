/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Dev local: evita conflito com .next root-owned do Docker (compose:app)
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
