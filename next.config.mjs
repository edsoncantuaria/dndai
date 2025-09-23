/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // This is the correct way to add a fallback for server-side modules
    // that should not be included in the client-side bundle.
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}), // Spread existing fallbacks
        'async_hooks': false,
        'fs': false,
        'tls': false,
        'net': false,
      };
    }

    return config;
  },
};

export default nextConfig;
