/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve server-side modules on the client
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        async_hooks: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
