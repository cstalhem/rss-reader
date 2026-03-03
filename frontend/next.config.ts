import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
