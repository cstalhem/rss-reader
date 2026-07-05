import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

const baseConfig: NextConfig = {
  output: 'standalone',
}

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...baseConfig,
      // Dev-only reverse-proxy emulation: same-origin /api like production
      // (Traefik routes PathPrefix(/api) to the backend before Next sees it).
      // Dev-gated deliberately — external rewrites in standalone builds have
      // known issues, and Next's proxy buffers streaming (matters if SSE ever lands).
      async rewrites() {
        return [{ source: '/api/:path*', destination: 'http://localhost:8912/api/:path*' }]
      },
    }
  }
  return baseConfig
}
