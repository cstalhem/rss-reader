import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
