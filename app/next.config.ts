import type { NextConfig } from 'next'

// Pinned so Next does not infer a workspace root from ~/pnpm-lock.yaml.
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
}

export default nextConfig
