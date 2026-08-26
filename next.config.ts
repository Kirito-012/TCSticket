import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Comment image uploads go through a Server Action as multipart/form-data; the 8MB
      // per-image cap (see MAX_IMAGE_BYTES in ticket.actions.ts) plus multipart overhead
      // needs headroom above Next's 1MB default.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
